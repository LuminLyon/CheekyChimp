import { GM_API, GMInfo, GMXmlHttpRequestDetails, GMNotificationDetails } from './GMApiTypes';
import { ResourceLoader } from '../resources/ResourceLoader';
import { StorageService } from '../storage/StorageService';

/**
 * GM API工厂类，用于创建油猴API实例
 */
export class GMApiFactory {
    private scriptInfo: GMInfo;
    private resourceLoader: ResourceLoader;
    private storageService: StorageService;
    private window: Window;
    private menuCommands: Map<number, { name: string; callback: Function; accessKey?: string }> = new Map();
    private menuCommandId = 0;

    constructor(
        scriptInfo: GMInfo,
        resourceLoader: ResourceLoader,
        storageService: StorageService,
        window: Window
    ) {
        this.scriptInfo = scriptInfo;
        this.resourceLoader = resourceLoader;
        this.storageService = storageService;
        this.window = window;
    }

    /**
     * 创建完整的GM API
     */
    public createAPI(): GM_API {
        // 创建旧版API
        const legacyApi = this.createLegacyAPI();
        
        // 添加新版API
        legacyApi.GM = this.createModernAPI();
        
        return legacyApi;
    }

    /**
     * 创建旧版GM API
     */
    private createLegacyAPI(): GM_API {
        return {
            // GM Info
            GM_info: this.scriptInfo,
            
            // 存储相关
            GM_getValue: (name: string, defaultValue?: any) => {
                return this.storageService.getValue(name, defaultValue);
            },
            
            GM_setValue: (name: string, value: any) => {
                this.storageService.setValue(name, value);
            },
            
            GM_deleteValue: (name: string) => {
                this.storageService.deleteValue(name);
            },
            
            GM_listValues: () => {
                return this.storageService.listValues();
            },
            
            // 资源相关
            GM_getResourceText: (name: string) => {
                return this.resourceLoader.getResourceText(name);
            },
            
            GM_getResourceURL: (name: string) => {
                return this.resourceLoader.getResourceURL(name);
            },
            
            // DOM操作
            GM_addStyle: (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
                return style;
            },
            
            // AJAX
            GM_xmlhttpRequest: (details: GMXmlHttpRequestDetails) => {
                const xhr = new XMLHttpRequest();
                xhr.open(details.method || 'GET', details.url, true);
                
                // 设置responseType
                if (details.responseType) {
                    xhr.responseType = details.responseType;
                }
                
                // 设置headers
                if (details.headers) {
                    Object.keys(details.headers).forEach(key => {
                        xhr.setRequestHeader(key, details.headers![key]);
                    });
                }
                
                // 设置超时
                if (details.timeout) {
                    xhr.timeout = details.timeout;
                }
                
                // MIME类型
                if (details.overrideMimeType) {
                    xhr.overrideMimeType(details.overrideMimeType);
                }
                
                // 跨域凭证
                if (details.withCredentials !== undefined) {
                    xhr.withCredentials = details.withCredentials;
                }
                
                // 设置回调
                xhr.onload = function() {
                    if (details.onload) {
                        details.onload({
                            responseText: xhr.responseType === 'text' || xhr.responseType === '' ? xhr.responseText : '',
                            response: xhr.response,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            readyState: xhr.readyState,
                            responseHeaders: xhr.getAllResponseHeaders(),
                            finalUrl: details.url
                        });
                    }
                };
                
                if (details.onerror) {
                    xhr.onerror = details.onerror;
                }
                
                if (details.onabort) {
                    xhr.onabort = details.onabort;
                }
                
                if (details.ontimeout) {
                    xhr.ontimeout = details.ontimeout;
                }
                
                // 发送请求
                xhr.send(details.data);
                
                // 返回abort方法
                return { abort: () => xhr.abort() };
            },
            
            // 菜单命令
            GM_registerMenuCommand: (name: string, callback: Function, accessKey?: string) => {
                const id = ++this.menuCommandId;
                this.menuCommands.set(id, { name, callback, accessKey });
                return id;
            },
            
            GM_unregisterMenuCommand: (menuCmdId: number) => {
                this.menuCommands.delete(menuCmdId);
            },
            
            // 浏览器交互
            GM_openInTab: (url: string, options = {}) => {
                const { active = true } = options;
                window.open(url, '_blank')?.focus();
            },
            
            GM_setClipboard: (data: string, info?: { type?: string; mimetype?: string }) => {
                navigator.clipboard.writeText(data).catch(err => {
                    console.error('无法写入剪贴板:', err);
                });
            },
            
            GM_notification: (details: GMNotificationDetails | string, ondone?: () => void) => {
                let text: string;
                let title: string = '';
                let image: string = '';
                let onclick: (() => void) | undefined;
                
                if (typeof details === 'string') {
                    text = details;
                    ondone = ondone || (() => {});
                } else {
                    text = details.text;
                    title = details.title || '';
                    image = details.image || '';
                    onclick = details.onclick;
                    ondone = details.ondone || ondone;
                }
                
                // 使用Notification API
                if ('Notification' in window) {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            const notification = new Notification(title, {
                                body: text,
                                icon: image
                            });
                            
                            if (onclick) {
                                notification.onclick = onclick;
                            }
                            
                            if (ondone) {
                                notification.onclose = ondone;
                            }
                        }
                    });
                } else {
                    // 备用方案：使用alert
                    alert(`${title ? title + ': ' : ''}${text}`);
                    if (ondone) {
                        ondone();
                    }
                }
            },
            
            // DOM元素添加
            GM_addElement: (tagName: string, attributes: Record<string, any>) => {
                const element = document.createElement(tagName);
                Object.entries(attributes).forEach(([key, value]) => {
                    if (key === 'textContent') {
                        element.textContent = value;
                    } else if (key === 'innerHTML') {
                        element.innerHTML = value;
                    } else {
                        element.setAttribute(key, value);
                    }
                });
                document.body.appendChild(element);
                return element;
            },
            
            // 不安全窗口访问
            unsafeWindow: this.window,
            
            // 新版API将在createModernAPI中添加
            GM: undefined
        };
    }

    /**
     * 创建新版GM API
     */
    private createModernAPI() {
        return {
            // GM Info
            info: this.scriptInfo,
            
            // 存储相关 - Promise版本
            getValue: async (name: string, defaultValue?: any) => {
                return this.storageService.getValue(name, defaultValue);
            },
            
            setValue: async (name: string, value: any) => {
                this.storageService.setValue(name, value);
            },
            
            deleteValue: async (name: string) => {
                this.storageService.deleteValue(name);
            },
            
            listValues: async () => {
                return this.storageService.listValues();
            },
            
            // 资源
            getResourceUrl: async (name: string) => {
                return this.resourceLoader.getResourceURL(name);
            },
            
            // XHR
            xmlHttpRequest: (details: GMXmlHttpRequestDetails) => {
                return this.createLegacyAPI().GM_xmlhttpRequest(details);
            },
            
            // 样式
            addStyle: async (css: string) => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
                return style;
            },
            
            // 菜单
            registerMenuCommand: async (name: string, fn: Function, accessKey?: string) => {
                return this.createLegacyAPI().GM_registerMenuCommand(name, fn, accessKey);
            },
            
            unregisterMenuCommand: async (menuCmdId: number) => {
                this.createLegacyAPI().GM_unregisterMenuCommand(menuCmdId);
            },
            
            // 浏览器交互
            openInTab: async (url: string, options = {}) => {
                this.createLegacyAPI().GM_openInTab(url, options);
            },
            
            setClipboard: async (data: string, info?: { type?: string; mimetype?: string }) => {
                await navigator.clipboard.writeText(data);
            },
            
            notification: async (details: GMNotificationDetails | string, ondone?: () => void) => {
                this.createLegacyAPI().GM_notification(details, ondone);
            }
        };
    }
} 