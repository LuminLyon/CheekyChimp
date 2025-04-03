import { InjectorBase, InjectorConfig } from './InjectorBase';

/**
 * Iframe脚本注入器
 * 用于注入脚本到iframe中
 */
export class IframeInjector extends InjectorBase {
    private logger = this.createLogger('[IframeInjector]');
    private observedIframes: WeakSet<HTMLIFrameElement> = new WeakSet();
    private observer: MutationObserver | null = null;

    constructor(config: InjectorConfig) {
        super(config);
    }

    /**
     * 注入脚本到目标窗口的所有iframe
     * @param targetWindow 目标窗口对象
     */
    public inject(targetWindow: Window): void {
        this.logger.info('初始化iframe注入...');
        
        try {
            // 立即注入到已存在的iframe
            this.injectToExistingIframes(targetWindow);
            
            // 设置观察者以处理新增的iframe
            this.setupIframeObserver(targetWindow);
            
            this.logger.info('iframe注入器初始化成功');
        } catch (error) {
            this.logger.error('iframe注入器初始化失败:', error);
        }
    }

    /**
     * 注入到已存在的所有iframe
     * @param targetWindow 目标窗口
     */
    private injectToExistingIframes(targetWindow: Window): void {
        const iframes = targetWindow.document.querySelectorAll('iframe');
        
        this.logger.info(`发现${iframes.length}个已存在的iframe`);
        
        iframes.forEach(iframe => {
            this.injectToIframe(iframe);
        });
    }

    /**
     * 设置iframe观察者
     * @param targetWindow 目标窗口
     */
    private setupIframeObserver(targetWindow: Window): void {
        // 如果已经有observer，先断开连接
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // 创建新的observer
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        // 检查是否是iframe
                        if (node.nodeName === 'IFRAME') {
                            this.injectToIframe(node as HTMLIFrameElement);
                        }
                        
                        // 检查添加的节点内是否包含iframe
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const iframes = (node as Element).querySelectorAll('iframe');
                            iframes.forEach(iframe => {
                                this.injectToIframe(iframe);
                            });
                        }
                    });
                }
            }
        });
        
        // 开始观察DOM变化
        this.observer.observe(targetWindow.document.documentElement, {
            childList: true,
            subtree: true
        });
        
        // 页面卸载时断开observer
        targetWindow.addEventListener('unload', () => {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        });
    }

    /**
     * 注入脚本到单个iframe
     * @param iframe iframe元素
     */
    private injectToIframe(iframe: HTMLIFrameElement): void {
        // 如果已经注入过，跳过
        if (this.observedIframes.has(iframe)) {
            return;
        }
        
        this.observedIframes.add(iframe);
        
        try {
            // 等待iframe加载完成
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                this.performInjection(iframe);
            } else {
                iframe.addEventListener('load', () => {
                    this.performInjection(iframe);
                });
            }
        } catch (error) {
            // 跨域iframe会抛出错误
            this.logger.warn('无法访问iframe内容(可能是跨域限制):', error);
        }
    }

    /**
     * 执行实际的注入操作
     * @param iframe iframe元素
     */
    private performInjection(iframe: HTMLIFrameElement): void {
        try {
            const iframeWindow = iframe.contentWindow;
            
            if (!iframeWindow) {
                throw new Error('无法访问iframe的window对象');
            }
            
            // 准备API
            this.prepareInjection(iframeWindow);
            
            // 包装用户脚本
            const wrappedScript = this.wrapUserScript(this.config.sourceCode, iframeWindow);
            
            // 注入脚本
            this.injectScriptElement(wrappedScript, iframeWindow);
            
            this.logger.info(`成功注入脚本到iframe: ${iframe.src || '(无src)'}`);
            
            // 递归处理iframe内的iframe
            this.injectToExistingIframes(iframeWindow);
            this.setupIframeObserver(iframeWindow);
            
        } catch (error) {
            this.logger.error(`注入到iframe失败: ${iframe.src || '(无src)'}`, error);
        }
    }

    /**
     * 停止观察iframe
     */
    public disconnect(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
} 