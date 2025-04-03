import { InjectorBase, InjectorConfig } from './InjectorBase';

/**
 * Webview脚本注入器
 * 用于注入脚本到webview中（如electron应用）
 */
export class WebviewInjector extends InjectorBase {
    private logger = this.createLogger('[WebviewInjector]');
    private observedWebviews: WeakSet<HTMLElement> = new WeakSet();
    private observer: MutationObserver | null = null;

    constructor(config: InjectorConfig) {
        super(config);
    }

    /**
     * 注入脚本到目标窗口的所有webview
     * @param targetWindow 目标窗口对象
     */
    public inject(targetWindow: Window): void {
        this.logger.info('初始化webview注入...');
        
        try {
            // 立即注入到已存在的webview
            this.injectToExistingWebviews(targetWindow);
            
            // 设置观察者以处理新增的webview
            this.setupWebviewObserver(targetWindow);
            
            this.logger.info('webview注入器初始化成功');
        } catch (error) {
            this.logger.error('webview注入器初始化失败:', error);
        }
    }

    /**
     * 注入到已存在的所有webview
     * @param targetWindow 目标窗口
     */
    private injectToExistingWebviews(targetWindow: Window): void {
        const webviews = targetWindow.document.querySelectorAll('webview');
        
        this.logger.info(`发现${webviews.length}个已存在的webview`);
        
        webviews.forEach(webview => {
            this.injectToWebview(webview as HTMLElement);
        });
    }

    /**
     * 设置webview观察者
     * @param targetWindow 目标窗口
     */
    private setupWebviewObserver(targetWindow: Window): void {
        // 如果已经有observer，先断开连接
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // 创建新的observer
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        // 检查是否是webview
                        if (node.nodeName === 'WEBVIEW') {
                            this.injectToWebview(node as HTMLElement);
                        }
                        
                        // 检查添加的节点内是否包含webview
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const webviews = (node as Element).querySelectorAll('webview');
                            webviews.forEach(webview => {
                                this.injectToWebview(webview as HTMLElement);
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
     * 注入脚本到单个webview
     * @param webview webview元素
     */
    private injectToWebview(webview: HTMLElement): void {
        // 如果已经注入过，跳过
        if (this.observedWebviews.has(webview)) {
            return;
        }
        
        this.observedWebviews.add(webview);
        
        try {
            const handleDOMReady = () => {
                this.performInjection(webview);
                webview.removeEventListener('dom-ready', handleDOMReady);
            };
            
            if ((webview as any).getWebContents) {
                // electron webview已加载
                this.performInjection(webview);
            } else {
                // 等待webview加载完成
                webview.addEventListener('dom-ready', handleDOMReady);
            }
        } catch (error) {
            this.logger.warn('无法访问webview内容:', error);
        }
    }

    /**
     * 执行实际的注入操作
     * @param webview webview元素
     */
    private performInjection(webview: HTMLElement): void {
        try {
            // 准备注入代码
            const wrappedScript = this.wrapUserScript(this.config.sourceCode, window);
            
            // 创建注入脚本
            const injectionScript = `
                // 注入GM API
                (function() {
                    ${this.createAPIInjectionCode()}
                    
                    // 注入用户脚本
                    ${wrappedScript}
                })();
            `;
            
            // 使用executeJavaScript注入
            if ((webview as any).executeJavaScript) {
                (webview as any).executeJavaScript(injectionScript)
                    .then(() => {
                        this.logger.info(`成功注入脚本到webview: ${(webview as any).src || '(无src)'}`);
                    })
                    .catch((error: any) => {
                        this.logger.error('webview脚本注入失败:', error);
                    });
            } else {
                this.logger.error('webview不支持executeJavaScript方法');
            }
        } catch (error) {
            this.logger.error('注入到webview失败:', error);
        }
    }

    /**
     * 创建API注入代码
     */
    private createAPIInjectionCode(): string {
        const gmAPI = this.apiFactory.createAPI();
        
        // 序列化API函数
        return Object.entries(gmAPI)
            .map(([key, value]) => {
                if (typeof value === 'function') {
                    return `window['${key}'] = ${value.toString()};`;
                } else if (key === 'unsafeWindow') {
                    return `window['${key}'] = window;`;
                } else if (typeof value === 'object' && value !== null) {
                    return `window['${key}'] = ${JSON.stringify(value)};`;
                } else {
                    return `window['${key}'] = ${JSON.stringify(value)};`;
                }
            })
            .join('\n');
    }

    /**
     * 停止观察webview
     */
    public disconnect(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}