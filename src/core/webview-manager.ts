import { WorkspaceLeaf, App } from 'obsidian';
import { SiteAdapterFactory } from '../services/injection/site-adapters/site-adapter-factory';
import { logPrefix } from '../services/injection/utils';
import { BackupScriptInjector } from '../services/backup-script-injector';

/**
 * WebView管理器 - 负责处理Obsidian中的webview/iframe元素
 */
export class WebViewManager {
    // 注入记录Map：webviewId -> Set<scriptId>
    private injectionRecords = new Map<string, Set<string>>();
    
    constructor(
        private app: App,
        private scriptInjector: BackupScriptInjector
    ) {}

    /**
     * 初始化WebView监听
     */
    initialize(): void {
        // 添加MutationObserver来监控整个文档中的iframe/webview变化
        this.setupDOMObserver();
        
        // 监听Obsidian布局变化
        this.app.workspace.on('layout-change', () => {
            this.checkForWebViews();
        });
        
        // 初始检查当前打开的叶子
        this.checkForWebViews();
        
        // 监听新创建的叶子
        this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
            if (leaf) {
                this.handlePotentialWebViewLeaf(leaf);
            }
        });
    }
    
    /**
     * 设置DOM观察器，监视整个文档中的iframe/webview变化
     */
    private setupDOMObserver(): void {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName === 'IFRAME' || node.nodeName === 'WEBVIEW') {
                        this.setupIframe(node as HTMLIFrameElement);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
    }

    /**
     * 检查所有打开的窗格中的 webview
     */
    private checkForWebViews(): void {
        this.app.workspace.iterateAllLeaves((leaf) => {
            this.handlePotentialWebViewLeaf(leaf);
        });
    }

    /**
     * 处理可能包含 webview 的叶子
     */
    private handlePotentialWebViewLeaf(leaf: WorkspaceLeaf): void {
        if (!leaf || !leaf.view) return;
        
        // 检查是否是内容包含 iframe 或 webview 的视图
        // 这里需要适配不同的插件如 Surfing, Omnisearch 等
        setTimeout(() => {
            const containerEl = leaf.view.containerEl;
            if (!containerEl) return;
            
            // 查找 iframe 或 webview 元素
            const webviews = containerEl.querySelectorAll('iframe, webview');
            webviews.forEach(webview => {
                if (webview instanceof HTMLIFrameElement || webview instanceof HTMLElement) {
                    this.setupWebViewListeners(webview);
                }
            });
        }, 500); // 延迟一点时间以确保 DOM 已经完全加载
    }
    
    /**
     * 为iframe设置事件监听
     */
    private setupIframe(iframe: HTMLIFrameElement): void {
        try {
            // 设置iframe的事件监听器
            iframe.addEventListener('load', () => {
                const url = iframe.src || '';
                if (url) {
                    // 生成当前状态标识（URL+时间戳）
                    const currentState = url + "_" + Date.now();
                    
                    // 无论URL是否改变，都尝试重新注入脚本
                    console.log(`${logPrefix('WebviewManager')} iframe加载或刷新，URL: ${url}`);
                    
                    // 清除注入记录，确保刷新时重新注入
                    const webviewId = this.getWebviewId(iframe);
                    this.clearInjectionRecords(webviewId);
                    
                    // 延迟一小段时间注入，确保页面已经完全加载
                    setTimeout(() => {
                        this.injectScriptsForUrl(url, iframe);
                    }, 300);
                }
            });
            
            // 尝试监控更复杂的刷新行为
            try {
                if (iframe.contentWindow && iframe.contentDocument) {
                    // 监听页面可见性变化，可能表示用户返回页面
                    iframe.contentWindow.addEventListener('visibilitychange', () => {
                        if (iframe.contentWindow && iframe.contentDocument && 
                            !iframe.contentDocument.hidden) {
                            console.log(`${logPrefix('WebviewManager')} 检测到iframe可见性变化，可能需要重新注入`);
                            const url = iframe.src || '';
                            if (url) {
                                this.refreshInjection(iframe, url);
                            }
                        }
                    });
                }
            } catch (e) {
                // 可能因跨域限制无法添加事件监听，忽略错误
                console.log(`${logPrefix('WebviewManager')} 无法添加额外iframe事件监听器: ${e.message}`);
            }

            // 立即处理当前URL
            const currentUrl = iframe.src || '';
            if (currentUrl) {
                this.injectScriptsForUrl(currentUrl, iframe);
            }
        } catch (error) {
            console.error(`${logPrefix('WebviewManager')} 设置iframe监听器失败:`, error);
        }
    }
    
    /**
     * 设置webview监听器
     */
    private setupWebViewListeners(webview: HTMLElement): void {
        try {
            // 使用备份版本时，输出更详细的调试信息
            console.log(`${logPrefix('WebviewManager')} 为 ${webview.tagName} 设置事件监听器`);
            console.log(`${logPrefix('WebviewManager')} webview属性:`, 
                '宽度:', webview.clientWidth, 
                '高度:', webview.clientHeight, 
                'ID:', webview.id, 
                'class:', webview.className
            );
            
            // 检查是否已经设置过监听器
            if (webview.hasAttribute('data-cheekychimp-monitored')) {
                console.log(`${logPrefix('WebviewManager')} 该webview已经设置过监听器，跳过`);
                return;
            }
            
            // 标记为已监控
            webview.setAttribute('data-cheekychimp-monitored', 'true');
            
            // 获取iframe/webview的当前URL
            let currentUrl = '';
            
            // 获取站点适配器工厂
            const adapterFactory = SiteAdapterFactory.getInstance();
            
            // 针对iframe的处理
            if (webview instanceof HTMLIFrameElement) {
                console.log(`${logPrefix('WebviewManager')} 处理iframe元素`);
                currentUrl = webview.src || '';
                
                // 监听iframe的load事件
                webview.addEventListener('load', () => {
                    try {
                        // 获取iframe当前URL
                        const iframeUrl = webview.src || '';
                        if (iframeUrl) {
                            console.log(`${logPrefix('WebviewManager')} iframe加载完成, URL:`, iframeUrl);
                            
                            // 清除旧的注入记录
                            const webviewId = this.getWebviewId(webview);
                            this.clearInjectionRecords(webviewId);
                            
                            // 获取合适的站点适配器
                            const siteAdapter = adapterFactory.getAdapter(iframeUrl);
                            
                            // 设置网站适配器
                            siteAdapter.setupSupport(webview);
                            
                            // 注入脚本
                            this.injectScriptsForUrl(iframeUrl, webview);
                        }
                    } catch(e) {
                        console.error(`${logPrefix('WebviewManager')} 处理iframe load事件出错`, e);
                    }
                });
                
                // 监听iframe内容可见性变化
                this.setupVisibilityPolling(webview);
                
                // 立即处理当前URL
                if (currentUrl) {
                    // 获取合适的站点适配器
                    const siteAdapter = adapterFactory.getAdapter(currentUrl);
                    
                    console.log(`${logPrefix('WebviewManager')} 立即设置iframe适配器:`, currentUrl);
                    siteAdapter.setupSupport(webview);
                    
                    console.log(`${logPrefix('WebviewManager')} 立即注入脚本到iframe:`, currentUrl);
                    this.injectScriptsForUrl(currentUrl, webview);
                }
            } 
            // 其他处理逻辑省略，可根据需要添加...
        } catch (error) {
            console.error(`${logPrefix('WebviewManager')} 设置webview监听器失败`, error);
        }
    }
    
    // 其他需要的辅助方法
    
    /**
     * 获取webview的唯一ID
     */
    private getWebviewId(webview: HTMLElement): string {
        try {
            // 检查是否已有ID
            if (webview.hasAttribute('data-cheekychimp-id')) {
                return webview.getAttribute('data-cheekychimp-id') || '';
            }
            
            // 生成新ID
            const id = `cheekychimp-webview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // 设置ID属性
            webview.setAttribute('data-cheekychimp-id', id);
            
            console.log(`${logPrefix('WebviewManager')} 为webview生成新ID: ${id}`);
            return id;
        } catch (error) {
            // 如果无法设置属性，则使用内置id或生成临时id
            const fallbackId = webview.id || `temp-${Date.now()}`;
            console.warn(`${logPrefix('WebviewManager')} 无法设置webview ID，使用回退ID: ${fallbackId}`);
            return fallbackId;
        }
    }

    /**
     * 为指定URL注入脚本
     */
    private injectScriptsForUrl(url: string, webview: HTMLElement): void {
        this.scriptInjector.injectScriptsForUrl(webview, url);
    }
    
    /**
     * 清除特定webview的注入记录
     */
    private clearInjectionRecords(webviewId: string): void {
        console.log(`${logPrefix('InjectionManager')} 清除注入记录 ${webviewId}`);
        
        if (this.injectionRecords.has(webviewId)) {
            const count = this.injectionRecords.get(webviewId)?.size || 0;
            this.injectionRecords.delete(webviewId);
            console.log(`${logPrefix('InjectionManager')} 已清除 ${count} 条注入记录`);
        }
    }
    
    /**
     * 刷新注入，用于处理URL的hash变化等轻微变化
     */
    private refreshInjection(webview: HTMLElement, url: string): void {
        // 简化实现，直接调用注入方法
        this.injectScriptsForUrl(url, webview);
    }
    
    /**
     * 设置iframe可见性轮询
     */
    private setupVisibilityPolling(iframe: HTMLIFrameElement): void {
        let lastContent = '';
        let lastUrl = iframe.src || '';
        let reloadCounter = 0;
        
        // 防止多次设置轮询
        if (iframe.hasAttribute('data-cheekychimp-polling')) {
            return;
        }
        iframe.setAttribute('data-cheekychimp-polling', 'true');
        
        const interval = setInterval(() => {
            try {
                // 检查iframe是否仍在DOM中，如果不在则停止轮询
                if (!document.contains(iframe)) {
                    console.log(`${logPrefix('VisibilityPolling')} iframe已从DOM中移除，停止轮询`);
                    clearInterval(interval);
                    return;
                }
                
                // 获取当前URL
                const currentUrl = iframe.src || '';
                
                // 尝试获取内部document的信息（可能因跨域而失败）
                let currentContent = '';
                
                try {
                    if (iframe.contentDocument) {
                        currentContent = iframe.contentDocument.documentElement.outerHTML || '';
                    }
                } catch (e) {
                    // 跨域限制，忽略
                }
                
                // 检测变化
                const urlChanged = currentUrl !== lastUrl;
                const contentChanged = currentContent && currentContent !== lastContent && currentContent.length > 50;
                
                // 如果任何一项发生变化，可能是页面刷新或内容更新
                if (urlChanged || contentChanged) {
                    console.log(`${logPrefix('VisibilityPolling')} 检测到iframe变化:`, 
                        urlChanged ? '地址变化' : '', 
                        contentChanged ? '内容变化' : ''
                    );
                    
                    // 更新上次状态
                    lastUrl = currentUrl;
                    if (currentContent) lastContent = currentContent;
                    
                    // 重新注入脚本
                    this.injectScriptsForUrl(currentUrl, iframe);
                    
                    // 重置重新加载计数器
                    reloadCounter = 0;
                } else {
                    // 周期性地强制检查是否需要重新注入（处理无法检测的刷新）
                    reloadCounter++;
                    
                    // 每30秒强制检查一次
                    if (reloadCounter >= 30) {
                        console.log(`${logPrefix('VisibilityPolling')} 定期检查是否需要重新注入脚本`);
                        this.injectScriptsForUrl(currentUrl, iframe);
                        reloadCounter = 0;
                    }
                }
            } catch (e) {
                console.error(`${logPrefix('VisibilityPolling')} 轮询出错:`, e);
                clearInterval(interval);
            }
        }, 1000);
        
        // 存储interval ID，以便可以在适当的时候清除
        iframe.setAttribute('data-cheekychimp-polling-id', String(interval));
    }
} 