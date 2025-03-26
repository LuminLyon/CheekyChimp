import { UserScript, ScriptStorage, GM_API } from '../models/script';
import { ScriptManager } from './script-manager';

/**
 * Service for injecting userscripts into webview
 */
export class ScriptInjector {
    private scriptStorage: ScriptStorage;
    private scriptManager: ScriptManager;
    
    /**
     * 缓存已加载的外部资源
     */
    private resourceCache: {[url: string]: string} = {};
    
    constructor(scriptStorage: ScriptStorage, scriptManager: ScriptManager) {
        this.scriptStorage = scriptStorage;
        this.scriptManager = scriptManager;
    }
    
    /**
     * Inject scripts into a webview
     */
    async injectScripts(webview: HTMLElement, url: string, scripts: UserScript[]): Promise<void> {
        if (!webview) return;
        
        console.log(`Tampermonkey: 准备向 ${url} 注入 ${scripts.length} 个脚本`);
        
        // 分类脚本按照run-at属性
        const documentStartScripts = scripts.filter(s => s.runAt === 'document-start');
        const documentEndScripts = scripts.filter(s => s.runAt === 'document-end');
        const documentIdleScripts = scripts.filter(s => s.runAt === 'document-idle' || !s.runAt);
        
        // 针对iframe类型的处理
        if (webview instanceof HTMLIFrameElement) {
            try {
                // 针对B站等特殊网站添加额外支持
                if (url.includes('bilibili.com')) {
                    console.log('Tampermonkey: 检测到B站页面，设置特殊处理');
                    this.setupBilibiliSupport(webview);
                }
                
                // 注入document-start脚本
                for (const script of documentStartScripts) {
                    await this.injectScript(webview, url, script);
                }
                
                // 处理document-end脚本
                this.injectContentLoadedListener(webview, url, documentEndScripts);
                
                // 处理document-idle脚本
                this.injectLoadListener(webview, url, documentIdleScripts);
            } catch (error) {
                console.error(`Tampermonkey: 注入脚本过程出错:`, error);
            }
        } 
        // 针对其他类型webview的处理
        else if (webview.tagName === 'WEBVIEW') {
            try {
                // 尝试调用executeJavaScript方法
                const webviewEl = webview as any;
                if (typeof webviewEl.executeJavaScript === 'function') {
                    // 注入GM API
                    const gmAPIs = this.generateSimpleGMAPIs();
                    await webviewEl.executeJavaScript(gmAPIs);
                    
                    // 注入所有脚本
                    for (const script of scripts) {
                        const processedCode = await this.preprocessScript(script);
                        await webviewEl.executeJavaScript(processedCode);
                    }
                } else {
                    // 使用DOM方式注入
                    console.log('Tampermonkey: 使用DOM方式注入脚本');
                    for (const script of scripts) {
                        const processedCode = await this.preprocessScript(script);
                        await this.executeScriptInWebView(webview, processedCode);
                    }
                }
            } catch (error) {
                console.error(`Tampermonkey: 注入WebView脚本失败:`, error);
            }
        }
    }
    
    /**
     * Inject a single script into a webview
     */
    private async injectScript(webview: HTMLElement, url: string, script: UserScript): Promise<void> {
        try {
            console.log(`Tampermonkey: 开始注入脚本 "${script.name}"`);
            
            // 处理外部依赖和资源
            const processedCode = await this.preprocessScript(script);
            
            // 创建GM API
            const gmApi = await this.createGmApi(script, url);
            
            // 创建脚本包装器
            const scriptWrapper = this.createScriptWrapper(script, gmApi, processedCode);
            
            // 根据run-at选择注入时机
            switch(script.runAt) {
                case 'document-start':
                    await this.injectScriptImmediately(webview, scriptWrapper);
                    break;
                case 'document-end':
                    await this.injectScriptOnContentLoaded(webview, scriptWrapper);
                    break;
                case 'document-idle':
                default:
                    await this.injectScriptOnLoad(webview, scriptWrapper);
            }
            
            console.log(`Tampermonkey: 脚本 "${script.name}" 注入成功`);
        } catch (error) {
            console.error(`Tampermonkey: 注入脚本 "${script.name}" 失败:`, error);
        }
    }
    
    private async injectScriptImmediately(webview: HTMLElement, scriptContent: string): Promise<void> {
        try {
            if (webview instanceof HTMLIFrameElement) {
                await this.executeScriptInIframe(webview, scriptContent);
            } else {
                await this.executeScriptInWebView(webview, scriptContent);
            }
        } catch (error) {
            console.error('Tampermonkey: 立即注入脚本失败:', error);
            throw error;
        }
    }
    
    private async injectScriptOnContentLoaded(webview: HTMLElement, scriptContent: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const handleEvent = async (event: Event) => {
                try {
                    if (webview instanceof HTMLIFrameElement) {
                        await this.executeScriptInIframe(webview, scriptContent);
                    } else {
                        await this.executeScriptInWebView(webview, scriptContent);
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    webview.removeEventListener('DOMContentLoaded', handleEvent);
                }
            };
            
            webview.addEventListener('DOMContentLoaded', handleEvent);
        });
    }
    
    private async injectScriptOnLoad(webview: HTMLElement, scriptContent: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const handleEvent = async (event: Event) => {
                try {
                    if (webview instanceof HTMLIFrameElement) {
                        await this.executeScriptInIframe(webview, scriptContent);
                    } else {
                        await this.executeScriptInWebView(webview, scriptContent);
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    webview.removeEventListener('load', handleEvent);
                }
            };
            
            webview.addEventListener('load', handleEvent);
        });
    }
    
    /**
     * Create GM API for a script
     */
    private async createGmApi(script: UserScript, url: string): Promise<GM_API> {
        // Create GM info object
        const info = {
            script: {
                name: script.name,
                namespace: script.namespace,
                description: script.description,
                version: script.version,
                includes: script.includes,
                excludes: script.excludes,
                matches: script.matches,
                resources: script.resources,
                requires: script.requires
            },
            version: '0.1.0', // Plugin version
            scriptHandler: 'Obsidian Tampermonkey',
            scriptMetaStr: this.getScriptMetaStr(script)
        };
        
        // 提取脚本中的@connect规则
        const connectDomains = this.extractConnectDomains(script.source);
        
        // Create storage namespace for this script
        const scriptStorage = {
            getValue: async (name: string, defaultValue?: any): Promise<any> => {
                const key = `${script.id}:${name}`;
                return await this.scriptStorage.getValue(key, defaultValue);
            },
            setValue: async (name: string, value: any): Promise<void> => {
                const key = `${script.id}:${name}`;
                await this.scriptStorage.setValue(key, value);
            },
            deleteValue: async (name: string): Promise<void> => {
                const key = `${script.id}:${name}`;
                await this.scriptStorage.deleteValue(key);
            },
            listValues: async (): Promise<string[]> => {
                const allKeys = await this.scriptStorage.listValues();
                const prefix = `${script.id}:`;
                return allKeys
                    .filter(key => key.startsWith(prefix))
                    .map(key => key.substring(prefix.length));
            }
        };
        
        // 创建一个通用的XML HTTP请求处理函数，同时支持GM.xmlHttpRequest和GM_xmlhttpRequest
        const commonXmlHttpRequest = (details: any): any => {
            console.log(`Tampermonkey: 执行xmlhttpRequest ${details.url}`);
            try {
                // 创建一个简单的xhr对象和取消控制器
                const abortController = new AbortController();
                const signal = abortController.signal;
                
                // 构建fetch请求选项
                const fetchOptions: RequestInit = {
                    method: details.method || 'GET',
                    signal: signal,
                    credentials: details.withCredentials ? 'include' : 'same-origin'
                };
                
                // 添加headers
                if (details.headers) {
                    fetchOptions.headers = details.headers;
                }
                
                // 添加body数据
                if (details.data) {
                    fetchOptions.body = details.data;
                }
                
                // 检查URL是否符合@connect规则
                const urlObj = new URL(details.url);
                const hostname = urlObj.hostname;
                const isConnectAllowed = this.isConnectAllowed(hostname, connectDomains);
                
                if (!isConnectAllowed) {
                    console.warn(`Tampermonkey: 请求 ${hostname} 不在@connect列表中，可能被阻止`);
                    // 继续执行，但记录警告
                }
                
                // 创建返回对象，提供abort方法
                const returnObj = {
                    abort: () => {
                        abortController.abort();
                    }
                };
                
                // 执行fetch请求
                fetch(details.url, fetchOptions)
                    .then(async response => {
                        // 准备响应头
                        let responseHeaders = '';
                        // 使用兼容的方式获取headers
                        if (response.headers) {
                            if (typeof response.headers.forEach === 'function') {
                                // 使用forEach方法（更通用的方法）
                                const headerPairs: string[] = [];
                                response.headers.forEach((value, key) => {
                                    headerPairs.push(`${key}: ${value}`);
                                });
                                responseHeaders = headerPairs.join('\n');
                            } else {
                                // 退化处理
                                responseHeaders = response.headers.toString();
                            }
                        }
                        
                        // 获取响应数据
                        const responseData = await response.text();
                        
                        // 调用onload回调
                        if (details.onload && typeof details.onload === 'function') {
                            details.onload({
                                finalUrl: response.url,
                                readyState: 4,
                                status: response.status,
                                statusText: response.statusText,
                                responseHeaders: responseHeaders,
                                responseText: responseData,
                                response: responseData
                            });
                        }
                    })
                    .catch(error => {
                        // 如果是用户取消，调用onabort回调
                        if (error.name === 'AbortError' && details.onabort) {
                            details.onabort();
                            return;
                        }
                        
                        // 调用onerror回调
                        if (details.onerror && typeof details.onerror === 'function') {
                            details.onerror(error);
                        }
                    });
                
                return returnObj;
            } catch (error) {
                console.error('Tampermonkey: XMLHttpRequest执行失败:', error);
                if (details.onerror && typeof details.onerror === 'function') {
                    details.onerror(error);
                }
                return null;
            }
        };
        
        // 创建异步版本的存储函数，用于支持新版GM API（返回Promise的版本）
        const gmGetValue = async (name: string, defaultValue?: any): Promise<any> => {
            const key = `tampermonkey:${script.id}:${name}`;
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        };
        
        const gmSetValue = async (name: string, value: any): Promise<void> => {
            const key = `tampermonkey:${script.id}:${name}`;
            localStorage.setItem(key, value);
            await scriptStorage.setValue(name, value);
        };
        
        const gmDeleteValue = async (name: string): Promise<void> => {
            const key = `tampermonkey:${script.id}:${name}`;
            localStorage.removeItem(key);
            await scriptStorage.deleteValue(name);
        };
        
        const gmListValues = async (): Promise<string[]> => {
            const keys = [];
            const prefix = `tampermonkey:${script.id}:`;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keys.push(key.substring(prefix.length));
                }
            }
            return keys;
        };
        
        // Create GM API
        return {
            GM_info: info,
            
            // Storage functions - 同步版本
            GM_getValue: (name: string, defaultValue?: any): any => {
                // Implement synchronous version with default
                return localStorage.getItem(`tampermonkey:${script.id}:${name}`) || defaultValue;
            },
            GM_setValue: (name: string, value: any): void => {
                localStorage.setItem(`tampermonkey:${script.id}:${name}`, value);
                scriptStorage.setValue(name, value);
            },
            GM_deleteValue: (name: string): void => {
                localStorage.removeItem(`tampermonkey:${script.id}:${name}`);
                scriptStorage.deleteValue(name);
            },
            GM_listValues: (): string[] => {
                // This is a synchronous function, but our storage is async
                // Return cached values from localStorage for now
                const keys = [];
                const prefix = `tampermonkey:${script.id}:`;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keys.push(key.substring(prefix.length));
                    }
                }
                return keys;
            },
            
            // Storage functions - 新版异步GM API
            GM: {
                getValue: gmGetValue,
                setValue: gmSetValue,
                deleteValue: gmDeleteValue,
                listValues: gmListValues,
                
                // 新版XMLHttpRequest
                xmlHttpRequest: commonXmlHttpRequest,
                
                // 其他GM API函数的Promise版本
                addStyle: async (css: string): Promise<HTMLStyleElement> => {
                    const style = document.createElement('style');
                    style.textContent = css;
                    style.setAttribute('data-tampermonkey-style', script.id);
                    document.head.appendChild(style);
                    return style;
                },
                
                // 新版菜单命令
                registerMenuCommand: async (name: string, fn: Function, accessKey?: string): Promise<number> => {
                    return this.registerMenuCommand(script, name, fn, accessKey);
                },
                
                // 新版添加元素API
                addElement: async (tagName: string, attributes: any): Promise<HTMLElement> => {
                    const element = document.createElement(tagName);
                    for (const [key, value] of Object.entries(attributes)) {
                        element.setAttribute(key, String(value));
                    }
                    document.body.appendChild(element);
                    return element;
                }
            },
            
            // Resource functions
            GM_getResourceText: (name: string): string => {
                console.log(`Tampermonkey: 获取资源文本 ${name}`);
                try {
                    // 从脚本的@resource元数据中查找资源URL
                    const resourceMap = script.resources.reduce((map, res) => {
                        map[res.name] = res.url;
                        return map;
                    }, {} as Record<string, string>);
                    
                    const resourceUrl = resourceMap[name];
                    if (!resourceUrl) {
                        console.warn(`Tampermonkey: 资源 ${name} 未找到`);
                return '';
                    }
                    
                    // 尝试从缓存获取资源
                    const cacheKey = `tampermonkey_resource:${script.id}:${name}`;
                    const cachedResource = localStorage.getItem(cacheKey);
                    if (cachedResource) {
                        console.log(`Tampermonkey: 使用缓存的资源 ${name}`);
                        return cachedResource;
                    }
                    
                    // 如果没有缓存，通过同步方式返回空字符串
                    // 并在后台获取资源以便下次使用
                    console.log(`Tampermonkey: 资源${name}未缓存，启动后台加载`);
                    
                    // 在后台异步加载
                    setTimeout(() => {
                        fetch(resourceUrl)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`获取资源失败: ${response.status} ${response.statusText}`);
                                }
                                return response.text();
                            })
                            .then(text => {
                                // 缓存获取的资源
                                try {
                                    localStorage.setItem(cacheKey, text);
                                    console.log(`Tampermonkey: 已缓存资源 ${name} 供下次使用`);
                                } catch (e) {
                                    console.warn('Tampermonkey: 无法缓存资源，可能超出存储限制', e);
                                }
                            })
                            .catch(error => {
                                console.error(`Tampermonkey: 后台获取资源 ${name} 失败:`, error);
                            });
                    }, 0);
                    
                    return ''; // 首次调用返回空字符串
                } catch (error) {
                    console.error(`Tampermonkey: 获取资源 ${name} 失败:`, error);
                    return '';
                }
            },
            GM_getResourceURL: (name: string): string => {
                try {
                    // 从脚本的@resource元数据中查找资源URL
                    const resourceMap = script.resources.reduce((map, res) => {
                        map[res.name] = res.url;
                        return map;
                    }, {} as Record<string, string>);
                    
                    const resourceUrl = resourceMap[name];
                    if (!resourceUrl) {
                        console.warn(`Tampermonkey: 资源 ${name} 未找到`);
                return '';
                    }
                    
                    return resourceUrl;
                } catch (error) {
                    console.error(`Tampermonkey: 获取资源URL ${name} 失败:`, error);
                    return '';
                }
            },
            
            // UI functions
            GM_addStyle: (css: string): void => {
                try {
                const style = document.createElement('style');
                style.textContent = css;
                    style.setAttribute('data-tampermonkey-style', script.id);
                document.head.appendChild(style);
                } catch (e) {
                    console.error('Tampermonkey: 添加样式失败:', e);
                }
            },
            
            // 兼容新版GM API的添加元素
            GM_addElement: (tagName: string, attributes: any): HTMLElement => {
                const element = document.createElement(tagName);
                for (const [key, value] of Object.entries(attributes)) {
                    element.setAttribute(key, String(value));
                }
                document.body.appendChild(element);
                return element;
            },
            
            // 实现菜单命令注册系统
            GM_registerMenuCommand: (name: string, fn: Function, accessKey?: string): number => {
                return this.registerMenuCommand(script, name, fn, accessKey);
            },
            
            GM_unregisterMenuCommand: (menuCmdId: number): void => {
                try {
                    // 从本地存储中移除命令
                    const commandsKey = `tampermonkey_commands:${script.id}`;
                    let commands = [];
                    try {
                        const savedCommands = localStorage.getItem(commandsKey);
                        if (savedCommands) {
                            commands = JSON.parse(savedCommands);
                            commands = commands.filter((cmd: any) => cmd.id !== menuCmdId);
                            localStorage.setItem(commandsKey, JSON.stringify(commands));
                        }
                    } catch (e) {
                        console.error('解析保存的命令失败:', e);
                    }
                    
                    // 移除相关事件监听器
                    document.removeEventListener(`tampermonkey-run-command-${menuCmdId}`, () => {});
                    
                    // 创建一个通知事件，告诉Tampermonkey UI命令已被移除
                    const event = new CustomEvent('tampermonkey-command-unregistered', {
                        detail: {
                            scriptId: script.id,
                            commandId: menuCmdId
                        }
                    });
                    document.dispatchEvent(event);
                    
                    console.log(`Tampermonkey: 已注销菜单命令 ID ${menuCmdId}`);
                } catch (e) {
                    console.error(`Tampermonkey: 注销菜单命令 ID ${menuCmdId} 失败:`, e);
                }
            },
            
            // Network functions
            GM_xmlhttpRequest: commonXmlHttpRequest,
            
            // Misc functions
            GM_openInTab: (url: string, options?: any): any => {
                // Not implemented yet - need to use Obsidian's API
                console.warn('GM_openInTab not fully implemented');
                window.open(url, '_blank');
                return null;
            },
            GM_setClipboard: (data: string, info?: any): void => {
                // Use the clipboard API
                navigator.clipboard.writeText(data)
                    .catch(err => console.error('Failed to copy text: ', err));
            },
            GM_notification: (details: any, ondone?: Function): void => {
                // Not implemented yet - need to use Obsidian's notification API
                console.warn('GM_notification not fully implemented');
                alert(typeof details === 'string' ? details : details.text);
            },
            
            // Access to the window object
            unsafeWindow: window as any
        };
    }
    
    /**
     * Create a script wrapper with GM API
     */
    private createScriptWrapper(script: UserScript, gmApi: GM_API, scriptContent: string): string {
        // 为夜间模式助手脚本预加载CSS资源
        const hasSweet = script.resources && script.resources.some(r => r.name === 'swalStyle');
        
        // 检测是否为沉浸式翻译脚本
        const isImmersiveTranslate = script.name.includes('Immersive Translate');
        
        // 创建简化的包装代码，减少可能的问题
        return `
            (function() {
                try {
                    // 定义基本的GM信息对象
                    const GM_info = ${JSON.stringify(gmApi.GM_info)};
                    console.log('Tampermonkey: 准备执行脚本 "${script.name}"', GM_info);
                    
                    // 定义GM API函数
                    const GM_getValue = function(name, defaultValue) {
                        return localStorage.getItem('tampermonkey:${script.id}:' + name) || defaultValue;
                    };
                    
                    const GM_setValue = function(name, value) {
                        localStorage.setItem('tampermonkey:${script.id}:' + name, value);
                    };
                    
                    const GM_deleteValue = function(name) {
                        localStorage.removeItem('tampermonkey:${script.id}:' + name);
                    };
                    
                    const GM_listValues = function() {
                        const keys = [];
                        const prefix = 'tampermonkey:${script.id}:';
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith(prefix)) {
                                keys.push(key.substring(prefix.length));
                            }
                        }
                        return keys;
                    };
                    
                    const GM_addStyle = function(css) {
                        try {
                            const style = document.createElement('style');
                            style.textContent = css;
                            document.head.appendChild(style);
                            return style;
                        } catch(e) {
                            console.error('Tampermonkey: GM_addStyle错误', e);
                        }
                    };
                    
                    // 简化版的GM_getResourceText函数
                    const GM_getResourceText = function(name) {
                        // 从缓存中获取资源
                        const cacheKey = 'tampermonkey_resource:${script.id}:' + name;
                        const cachedResource = localStorage.getItem(cacheKey);
                        
                        // 如果是夜间模式助手脚本请求swalStyle，且是第一次加载
                        if (name === 'swalStyle' && !cachedResource && '${script.name}'.includes('夜间模式')) {
                            // 提供默认的SweetAlert样式以避免报错
                            return \`
                                .swal2-popup { background: #fff; color: #333; border-radius: 5px; padding: 20px; }
                                .swal2-title { color: #595959; font-size: 1.8em; margin: 0; }
                                .swal2-content { color: #545454; }
                                .swal2-actions { margin-top: 15px; }
                                .swal2-confirm { background: #3085d6; color: #fff; border: 0; border-radius: 3px; padding: 8px 20px; }
                                .swal2-cancel { background: #aaa; color: #fff; border: 0; border-radius: 3px; padding: 8px 20px; margin-left: 10px; }
                                .darkmode-popup { font-size: 14px !important; }
                                .darkmode-center { display: flex; align-items: center; }
                                .darkmode-setting-label { display: flex; align-items: center; justify-content: space-between; padding-top: 15px; }
                                .darkmode-setting-label-col { display: flex; align-items: flex-start; padding-top: 15px; flex-direction: column; }
                                .darkmode-setting-radio { width: 16px; height: 16px; }
                                .darkmode-setting-textarea { width: 100%; margin: 14px 0 0; height: 100px; resize: none; border: 1px solid #bbb; box-sizing: border-box; padding: 5px 10px; border-radius: 5px; color: #666; line-height: 1.2; }
                                .darkmode-setting-input { border: 1px solid #bbb; box-sizing: border-box; padding: 5px 10px; border-radius: 5px; width: 100px; }
                            \`;
                        }
                        
                        return cachedResource || '';
                    };
                    
                    // 提供其他必要的GM API函数
                    const GM_registerMenuCommand = function(name, fn, accessKey) {
                        console.log('Tampermonkey: 脚本注册菜单命令:', name);
                        // 存储命令到本地存储
                        const commandId = Date.now() + Math.floor(Math.random() * 1000);
                        const commandsKey = 'tampermonkey_commands:${script.id}';
                        let commands = [];
                        try {
                            const savedCommands = localStorage.getItem(commandsKey);
                            if (savedCommands) {
                                commands = JSON.parse(savedCommands);
                            }
                        } catch (e) {}
                        
                        commands.push({
                            id: commandId,
                            name: name,
                            accessKey: accessKey || ''
                        });
                        
                        localStorage.setItem(commandsKey, JSON.stringify(commands));
                        
                        // 在页面中创建按钮
                        setTimeout(function() {
                            try {
                                // 检查是否已经有菜单容器
                                let menuContainer = document.getElementById('tampermonkey-menu-container');
                                if (!menuContainer) {
                                    // 创建菜单容器
                                    menuContainer = document.createElement('div');
                                    menuContainer.id = 'tampermonkey-menu-container';
                                    menuContainer.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; display: none; background: white; border: 1px solid #ccc; border-radius: 5px; padding: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
                                    document.body.appendChild(menuContainer);
                                    
                                    // 创建菜单图标
                                    const menuIcon = document.createElement('div');
                                    menuIcon.id = 'tampermonkey-menu-icon';
                                    menuIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 512 512"><path fill="currentColor" d="M108.12 0L0 108.12v295.76L108.12 512h295.76L512 403.88V108.12L403.88 0zm71.84 107.25c9.02 0 16.56 7.54 16.56 16.56v49h58.07c9.02 0 16.56 7.54 16.56 16.56v87.19c0 9.02-7.54 16.56-16.56 16.56h-58.07v52c0 9.02-7.54 16.56-16.56 16.56h-127c-9.02 0-16.56-7.54-16.56-16.56v-52h-58.07c-9.02 0-16.56-7.54-16.56-16.56v-87.19c0-9.02 7.54-16.56 16.56-16.56h58.07v-49c0-9.02 7.54-16.56 16.56-16.56z"/></svg>';
                                    menuIcon.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 10000; cursor: pointer; width: 24px; height: 24px; background: white; border-radius: 50%; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
                                    document.body.appendChild(menuIcon);
                                    
                                    // 添加点击事件
                                    menuIcon.addEventListener('click', function() {
                                        if (menuContainer.style.display === 'none') {
                                            menuContainer.style.display = 'block';
                                        } else {
                                            menuContainer.style.display = 'none';
                                        }
                                    });
                                }
                                
                                // 添加命令按钮
                                const commandButton = document.createElement('button');
                                commandButton.textContent = name;
                                commandButton.style.cssText = 'display: block; width: 100%; margin: 5px 0; padding: 5px 10px; border: none; background: #f0f0f0; border-radius: 3px; cursor: pointer;';
                                commandButton.addEventListener('click', function() {
                                    menuContainer.style.display = 'none';
                                    try {
                                        fn();
                                    } catch(e) {
                                        console.error('Tampermonkey: 执行命令失败', e);
                                    }
                                });
                                menuContainer.appendChild(commandButton);
                            } catch(e) {
                                console.error('Tampermonkey: 创建菜单项失败', e);
                            }
                        }, 500);
                        
                        return commandId;
                    };
                    
                    const GM_xmlhttpRequest = function(details) {
                        try {
                            if (!details.url) {
                                throw new Error('URL is required for GM_xmlhttpRequest');
                            }
                            
                            // 使用fetch API实现
                            const fetchInit = {
                                method: details.method || 'GET',
                                headers: details.headers || {},
                                body: details.data || null,
                                credentials: details.withCredentials ? 'include' : 'same-origin'
                            };
                            
                            fetch(details.url, fetchInit)
                                .then(function(response) {
                                    if (!response.ok && details.onerror) {
                                        details.onerror(response);
                                        return;
                                    }
                                    
                                    return response.text().then(function(responseText) {
                            if (details.onload) {
                                            // 尝试构建一个headers对象
                                            let responseHeaders = '';
                                            try {
                                                const headerPairs = [];
                                                response.headers.forEach((value, key) => {
                                                    headerPairs.push(\`\${key}: \${value}\`);
                                                });
                                                responseHeaders = headerPairs.join('\\n');
                                            } catch (e) {
                                                // 如果不支持forEach，尝试使用toString
                                                responseHeaders = response.headers.toString();
                                            }
                                            
                                        details.onload({
                                                responseText: responseText,
                                            status: response.status,
                                            statusText: response.statusText,
                                                readyState: 4,
                                                finalUrl: response.url,
                                                responseHeaders: responseHeaders
                                        });
                                        }
                                    });
                                })
                                .catch(function(error) {
                                    if (details.onerror) {
                                        details.onerror(error);
                                    }
                                });
                            
                            // 返回一个模拟的XMLHttpRequest对象，带有abort方法
                            return { abort: function() { console.log('Request aborted'); } };
                        } catch(e) {
                            console.error('Tampermonkey: GM_xmlhttpRequest错误', e);
                            if (details.onerror) {
                                details.onerror(e);
                            }
                        }
                    };
                    
                    // 新版GM API支持
                    const GM = {
                        getValue: function(name, defaultValue) {
                            return Promise.resolve(GM_getValue(name, defaultValue));
                        },
                        setValue: function(name, value) {
                            GM_setValue(name, value);
                            return Promise.resolve();
                        },
                        deleteValue: function(name) {
                            GM_deleteValue(name);
                            return Promise.resolve();
                        },
                        listValues: function() {
                            return Promise.resolve(GM_listValues());
                        },
                        xmlHttpRequest: GM_xmlhttpRequest,
                        addStyle: function(css) {
                            return Promise.resolve(GM_addStyle(css));
                        },
                        registerMenuCommand: function(name, fn, accessKey) {
                            return Promise.resolve(GM_registerMenuCommand(name, fn, accessKey));
                        },
                        addElement: function(tagName, attributes) {
                            return Promise.resolve(GM_addElement(tagName, attributes));
                        }
                    };
                    
                    // 添加其他GM函数
                    const unsafeWindow = window;
                    
                    // 实现夜间模式助手脚本需要的特殊处理
                    if ('${script.name}'.includes('夜间模式')) {
                        // 预先添加夜间模式所需资源
                        window.Swal = window.Swal || {
                            fire: function(options) {
                                alert(options.title || 'Message');
                                return Promise.resolve({isConfirmed: true});
                            }
                        };
                    }
                    
                    // 针对沉浸式翻译的特殊处理
                    if (${isImmersiveTranslate}) {
                        // 确保不会由于跨域XHR请求失败
                        console.log('Tampermonkey: 检测到沉浸式翻译脚本，添加特殊处理');
                        
                        // 修复可能需要的全局对象
                        window.browser = window.browser || {};
                        window.chrome = window.chrome || {
                            runtime: {
                                sendMessage: () => Promise.resolve(),
                                onMessage: { addListener: () => {} }
                            },
                            i18n: {
                                getMessage: (key) => key
                            }
                        };
                        
                        // 预先添加必要的CSS
                        try {
                            if (document.head) {
                                const immersiveStyles = document.createElement('style');
                                immersiveStyles.id = 'immersive-translate-styles';
                                immersiveStyles.textContent = \`
                                    /* 翻译按钮样式 */
                                    #immersive-translate-button {
                                        position: fixed;
                                        right: 16px;
                                        top: 16px;
                                        background-color: rgba(127, 127, 127, 0.3);
                                        color: currentColor;
                                        border-radius: 50%;
                                        width: 40px;
                                        height: 40px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        cursor: pointer;
                                        z-index: 9999;
                                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                                        transition: all 0.3s ease;
                                    }
                                    #immersive-translate-button:hover {
                                        background-color: rgba(127, 127, 127, 0.5);
                                        transform: scale(1.1);
                                    }
                                    /* 翻译面板基础样式 */
                                    .immersive-translate-popup {
                                        position: fixed;
                                        background: white;
                                        border-radius: 8px;
                                        box-shadow: 0 4px 23px 0 rgba(0, 0, 0, 0.2);
                                        z-index: 9999;
                                    }
                                \`;
                                document.head.appendChild(immersiveStyles);
                                console.log('Tampermonkey: 已添加沉浸式翻译基础样式');
                            }
                        } catch (e) {
                            console.error('Tampermonkey: 添加沉浸式翻译样式失败:', e);
                        }
                        
                        // 添加DOM观察器，确保body存在时添加按钮
                        const addTranslationButton = () => {
                            try {
                                console.log('Tampermonkey: 尝试强制显示沉浸式翻译UI');
                                
                                // 检查是否已存在按钮
                                if (document.getElementById('immersive-translate-button')) {
                                    console.log('Tampermonkey: 沉浸式翻译按钮已存在');
                                    return;
                                }
                                
                                // 手动注入翻译按钮到页面上
                                const translationButton = document.createElement('div');
                                translationButton.id = 'immersive-translate-button';
                                translationButton.title = '沉浸式翻译';
                                translationButton.innerHTML = '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M211.2 883.2A64 64 0 0 1 147.2 819.2V204.8A64 64 0 0 1 211.2 140.8h249.6v61.44H512v7.68l-0.64 3.84A64 64 0 0 1 448.64 256l-0.64 3.2h-232.96A63.36 63.36 0 0 0 192 256v558.08A61.44 61.44 0 0 0 221.44 856.32A64 64 0 0 0 256 864h232.32c33.28-4.48 59.52-30.08 64-61.44V768h-64v-64h126.08A64 64 0 0 1 678.4 768v34.56A128 128 0 0 1 551.04 928H211.2z" fill="currentColor"></path><path d="M812.8 752.64h-60.8v-128c0-32-30.08-62.08-62.08-62.08h-159.36v-62.08h159.36c65.28 0 125.44 60.16 125.44 125.44v126.72zM448 266.24v-64h126.08A64 64 0 0 1 640 266.24z" fill="currentColor"></path><path d="M787.2 659.2l-96-166.4h64l64 115.2 64-115.2h64l-96 166.4z" fill="currentColor"></path></svg>';
                                document.body.appendChild(translationButton);
                                
                                // 添加点击事件
                                translationButton.addEventListener('click', () => {
                                    // 尝试触发内部翻译函数
                                    try {
                                        // 方法1: 尝试激活界面
                                        const event = new CustomEvent('immersive-translate-toggle');
                                        window.dispatchEvent(event);
                                        
                                        // 方法2: 尝试查找并调用全局函数
                                        if (typeof window.immersiveTranslate === 'object' && typeof window.immersiveTranslate.toggleTranslate === 'function') {
                                            window.immersiveTranslate.toggleTranslate();
                                        }
                                        
                                        // 方法3: 尝试执行特殊命令
                                        if (typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function') {
                                            // 尝试查找和执行菜单命令
                                            const menuCommands = localStorage.getItem('tampermonkey_commands:' + script.id);
                                            if (menuCommands) {
                                                try {
                                                    const commands = JSON.parse(menuCommands);
                                                    // 查找翻译命令
                                                    for (const cmd of commands) {
                                                        if (cmd.name.includes('翻译') || cmd.name.includes('Translate')) {
                                                            // 触发命令执行
                                                            const cmdId = cmd.id;
                                                            const cmdEvent = new CustomEvent('tampermonkey-run-command-' + cmdId);
                                                            document.dispatchEvent(cmdEvent);
                                                            console.log('Tampermonkey: 执行沉浸式翻译命令:', cmd.name);
                                                            break;
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error('解析翻译菜单命令失败:', e);
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Tampermonkey: 触发翻译失败:', e);
                                        // 回退：如果无法触发内部翻译，显示消息
                                        alert('沉浸式翻译初始化中，请稍后再试或刷新页面');
                                    }
                                });
                                
                                console.log('Tampermonkey: 已添加沉浸式翻译UI');
                            } catch (e) {
                                console.error('Tampermonkey: 添加沉浸式翻译UI失败:', e);
                            }
                        };
                        
                        // 创建监听器函数，用于确保脚本能在页面的各个阶段正确执行
                        const setupTranslationEnvironment = () => {
                            // 立即检查body是否存在
                            if (document.body) {
                                // 添加初始按钮
                                setTimeout(addTranslationButton, 500);
                            }
                            
                            // 监听DOMContentLoaded事件
                            window.addEventListener('DOMContentLoaded', () => {
                                console.log('Tampermonkey: DOMContentLoaded 触发');
                                setTimeout(addTranslationButton, 500);
                            });
                            
                            // 监听load事件
                            window.addEventListener('load', () => {
                                console.log('Tampermonkey: window.load 触发');
                                setTimeout(addTranslationButton, 1000);
                            });
                            
                            // 设置DOM观察器以防上述事件都不触发
                            if (!document.body) {
                                console.log('Tampermonkey: 设置body观察器');
                                const bodyObserver = new MutationObserver(() => {
                                    if (document.body) {
                                        bodyObserver.disconnect();
                                        setTimeout(addTranslationButton, 100);
                                    }
                                });
                                
                                bodyObserver.observe(document.documentElement || document, { childList: true, subtree: true });
                            }
                            
                            // 设置超时检查
                            setTimeout(() => {
                                if (document.body && !document.getElementById('immersive-translate-button')) {
                                    console.log('Tampermonkey: 超时检查，尝试添加按钮');
                                    addTranslationButton();
                                }
                            }, 2000);
                            
                            // 添加按钮自动检查逻辑，确保按钮存在
                            const checkButtonInterval = setInterval(() => {
                                if (document.body && !document.getElementById('immersive-translate-button')) {
                                    console.log('Tampermonkey: 沉浸式翻译按钮不存在，重新添加');
                                    addTranslationButton();
                                }
                            }, 5000);
                            
                            // 设置30秒后清除检查，避免无限重试
                            setTimeout(() => {
                                clearInterval(checkButtonInterval);
                            }, 30000);
                        };
                        
                        // 启动翻译环境
                        setupTranslationEnvironment();
                    }
                    
                    // 执行实际脚本
                    ${scriptContent}
                } catch(e) {
                    console.error('Tampermonkey: 脚本执行错误', e);
                }
            })();
        `;
    }
    
    /**
     * Extract metadata string from a script
     */
    private getScriptMetaStr(script: UserScript): string {
        const metaLines = [];
        
        metaLines.push('// ==UserScript==');
        
        if (script.name) metaLines.push(`// @name ${script.name}`);
        if (script.namespace) metaLines.push(`// @namespace ${script.namespace}`);
        if (script.version) metaLines.push(`// @version ${script.version}`);
        if (script.description) metaLines.push(`// @description ${script.description}`);
        if (script.author) metaLines.push(`// @author ${script.author}`);
        if (script.homepage) metaLines.push(`// @homepage ${script.homepage}`);
        if (script.icon) metaLines.push(`// @icon ${script.icon}`);
        
        script.includes.forEach(include => {
            metaLines.push(`// @include ${include}`);
        });
        
        script.matches.forEach(match => {
            metaLines.push(`// @match ${match}`);
        });
        
        script.excludes.forEach(exclude => {
            metaLines.push(`// @exclude ${exclude}`);
        });
        
        script.requires.forEach(require => {
            metaLines.push(`// @require ${require}`);
        });
        
        script.resources.forEach(resource => {
            metaLines.push(`// @resource ${resource.name} ${resource.url}`);
        });
        
        if (script.runAt) metaLines.push(`// @run-at ${script.runAt}`);
        
        metaLines.push('// ==/UserScript==');
        
        return metaLines.join('\n');
    }
    
    /**
     * Inject a listener for DOMContentLoaded event
     */
    private injectContentLoadedListener(webview: HTMLElement, url: string, scripts: UserScript[]): void {
        if (scripts.length === 0) return;
        
        if (webview instanceof HTMLIFrameElement) {
            // 处理iframe元素
            this.injectContentLoadedListenerForIframe(webview, url, scripts);
        } else if (webview.tagName === 'WEBVIEW') {
            // 处理webview元素
            this.injectContentLoadedListenerForWebView(webview, url, scripts);
        }
    }
    
    /**
     * 为iframe注入DOMContentLoaded监听器
     */
    private injectContentLoadedListenerForIframe(iframe: HTMLIFrameElement, url: string, scripts: UserScript[]): void {
        try {
            // 确保iframe已加载并可访问
            if (!iframe.contentWindow || !iframe.contentDocument) {
                console.warn('无法访问iframe内容来设置DOMContentLoaded监听器');
                
                // 尝试通过轮询方式检测文档加载状态
                const checkInterval = setInterval(() => {
                    try {
                        if (iframe.contentDocument && iframe.contentDocument.readyState === 'interactive') {
                            clearInterval(checkInterval);
                            scripts.forEach(script => this.injectScript(iframe, url, script));
                        }
                    } catch (e) {
                        // 可能由于跨域限制
                        clearInterval(checkInterval);
                    }
                }, 100);
                
                // 设置超时清除
                setTimeout(() => clearInterval(checkInterval), 10000);
                return;
            }
            
            // 检查文档是否已经完成加载
            if (iframe.contentDocument.readyState === 'loading') {
                // 文档仍在加载，添加事件监听器
                iframe.contentDocument.addEventListener('DOMContentLoaded', async () => {
                    for (const script of scripts) {
                        await this.injectScript(iframe, url, script);
                    }
                });
            } else {
                // 文档已加载完成，直接执行脚本
                scripts.forEach(script => this.injectScript(iframe, url, script));
            }
        } catch (error) {
            console.error('设置iframe的DOMContentLoaded监听器失败:', error);
            
            // 回退：直接尝试执行所有脚本
            scripts.forEach(script => this.injectScript(iframe, url, script));
        }
    }
    
    /**
     * 为webview注入DOMContentLoaded监听器
     */
    private injectContentLoadedListenerForWebView(webview: HTMLElement, url: string, scripts: UserScript[]): void {
        // 为webview注入事件监听脚本
        const listenerScript = `
            if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                    window.dispatchEvent(new CustomEvent('obsidian-tampermonkey-domcontentloaded'));
                });
            } else {
                // 文档已加载，立即触发事件
                window.dispatchEvent(new CustomEvent('obsidian-tampermonkey-domcontentloaded'));
            }
        `;
        
        // 注入监听器脚本
        this.executeScript(webview, listenerScript);
        
        // 添加自定义事件监听
        const handleEvent = (event: Event) => {
            scripts.forEach(script => this.injectScript(webview, url, script));
        };
        
        // 监听自定义事件
        webview.addEventListener('obsidian-tampermonkey-domcontentloaded', handleEvent);
        
        // 添加清理函数（避免内存泄漏）
        setTimeout(() => {
            webview.removeEventListener('obsidian-tampermonkey-domcontentloaded', handleEvent);
        }, 10000);
    }
    
    /**
     * Inject a listener for load event
     */
    private injectLoadListener(webview: HTMLElement, url: string, scripts: UserScript[]): void {
        if (scripts.length === 0) return;
        
        if (webview instanceof HTMLIFrameElement) {
            // 处理iframe元素
            this.injectLoadListenerForIframe(webview, url, scripts);
        } else if (webview.tagName === 'WEBVIEW') {
            // 处理webview元素
            this.injectLoadListenerForWebView(webview, url, scripts);
        }
    }
    
    /**
     * 为iframe注入load监听器
     */
    private injectLoadListenerForIframe(iframe: HTMLIFrameElement, url: string, scripts: UserScript[]): void {
        try {
            // 添加load事件监听
            iframe.addEventListener('load', async () => {
                for (const script of scripts) {
                    await this.injectScript(iframe, url, script);
                }
            });
            
            // 检查iframe是否已加载完成
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                // 已加载完成，直接执行脚本
                scripts.forEach(script => this.injectScript(iframe, url, script));
            }
        } catch (error) {
            console.error('设置iframe的load监听器失败:', error);
            
            // 回退：延迟执行脚本
            setTimeout(() => {
                scripts.forEach(script => this.injectScript(iframe, url, script));
            }, 1000);
        }
    }
    
    /**
     * 为webview注入load监听器
     */
    private injectLoadListenerForWebView(webview: HTMLElement, url: string, scripts: UserScript[]): void {
        // 为webview注入事件监听脚本
        const listenerScript = `
            if (document.readyState === 'complete') {
                // 页面已完全加载，立即触发事件
                window.dispatchEvent(new CustomEvent('obsidian-tampermonkey-load'));
            } else {
                // 等待页面加载完成
            window.addEventListener('load', function() {
                window.dispatchEvent(new CustomEvent('obsidian-tampermonkey-load'));
            });
            }
        `;
        
        // 注入监听器脚本
        this.executeScript(webview, listenerScript);
        
        // 添加自定义事件监听
        const handleEvent = (event: Event) => {
            scripts.forEach(script => this.injectScript(webview, url, script));
        };
        
        // 监听自定义事件
        webview.addEventListener('obsidian-tampermonkey-load', handleEvent);
        
        // 添加清理函数（避免内存泄漏）
        setTimeout(() => {
            webview.removeEventListener('obsidian-tampermonkey-load', handleEvent);
        }, 10000);
    }
    
    /**
     * Execute a script in a webview
     */
    private executeScript(webview: HTMLElement, scriptContent: string): void {
        try {
            if (webview instanceof HTMLIFrameElement) {
                // 处理iframe元素
                this.executeScriptInIframe(webview, scriptContent);
            } else if (webview.tagName === 'WEBVIEW') {
                // 处理webview元素
                this.executeScriptInWebView(webview, scriptContent);
            } else {
                console.warn('不支持的webview类型:', webview.tagName);
            }
        } catch (error) {
            console.error('执行脚本时出错:', error);
        }
    }

    /**
     * 在iframe中执行脚本
     */
    private executeScriptInIframe(iframe: HTMLIFrameElement, scriptContent: string): void {
        try {
            // 确保iframe已加载并可访问
            if (!iframe.contentWindow || !iframe.contentDocument) {
                console.warn('Tampermonkey: 无法访问iframe内容，可能是跨域限制');
                // 使用URL方法注入
                this.tryExecuteViaURL(iframe, scriptContent);
                return;
            }

            // 直接在iframe的head中添加脚本
            try {
                // 创建脚本元素
                const script = iframe.contentDocument.createElement('script');
                script.textContent = scriptContent;
                script.setAttribute('data-tampermonkey', 'true');
                script.setAttribute('type', 'text/javascript');
                
                // 增加调试日志
                console.log('Tampermonkey: 正在注入脚本到iframe');
                
                // 添加到iframe文档中
                if (iframe.contentDocument.head) {
                    iframe.contentDocument.head.appendChild(script);
                    console.log('Tampermonkey: 脚本已注入到iframe head');
                    
                    // 添加MutationObserver监听DOM变化，确保对bilibili等特定网站的支持
                    if (iframe.src.includes('bilibili.com')) {
                        console.log('Tampermonkey: 检测到B站页面，设置DOM变化监听器');
                        this.setupBilibiliSupport(iframe);
                    }
                } else if (iframe.contentDocument.documentElement) {
                    // 如果没有head，尝试添加到documentElement
                    iframe.contentDocument.documentElement.appendChild(script);
                    console.log('Tampermonkey: 脚本已注入到iframe documentElement');
                } else {
                    // 最后尝试添加到body
                    iframe.contentDocument.body?.appendChild(script);
                    console.log('Tampermonkey: 脚本已注入到iframe body');
                }
            } catch (error) {
                console.error('Tampermonkey: 通过DOM方式注入脚本失败:', error);
                // 尝试使用eval方式
                this.tryExecuteViaEval(iframe, scriptContent);
            }
        } catch (error) {
            // 可能由于同源策略失败
            console.error('Tampermonkey: 无法在iframe中执行脚本，可能是跨域限制:', error);
            
            // 尝试替代方法
            this.tryExecuteViaURL(iframe, scriptContent);
        }
    }
    
    /**
     * 为B站页面设置特殊支持，确保视频控制脚本能正常工作
     */
    private setupBilibiliSupport(iframe: HTMLIFrameElement): void {
        try {
            if (!iframe.contentDocument) return;
            
            // 创建一个MutationObserver来监听播放器的加载
            const observer = new MutationObserver((mutations) => {
                const player = iframe.contentDocument?.querySelector('.bpx-player-ctrl-playbackrate');
                if (player) {
                    console.log('Tampermonkey: B站播放器已加载，重新执行相关脚本');
                    
                    // 找到所有适用于B站的脚本
                    const url = iframe.src;
                    const scripts = this.scriptManager.findScriptsForUrl(url)
                        .filter((s: UserScript) => s.matches.some((m: string) => m.includes('bilibili.com')));
                    
                    // 重新执行这些脚本
                    for (const script of scripts) {
                        this.injectScript(iframe, url, script);
                    }
                    
                    // 停止观察，避免多次执行
                    observer.disconnect();
                }
            });
            
            // 开始观察DOM变化
            observer.observe(iframe.contentDocument.body, {
                childList: true,
                subtree: true
            });
            
            console.log('Tampermonkey: 已设置B站页面的DOM监听器');
        } catch (error) {
            console.error('Tampermonkey: 设置B站特殊支持失败:', error);
        }
    }
    
    /**
     * 通过eval方式执行脚本（用于iframe）
     */
    private tryExecuteViaEval(iframe: HTMLIFrameElement, scriptContent: string): void {
        try {
            if (iframe.contentWindow) {
                console.log('Tampermonkey: 尝试通过eval方式执行脚本');
                
                // 使用Function构造器
                try {
                    // 使用隐式调用
                    const scriptFunction = new Function(`
                        try {
                            if (window.frames[0] && window.frames[0].document) {
                                var script = window.frames[0].document.createElement("script");
                                script.textContent = ${JSON.stringify(scriptContent)};
                                window.frames[0].document.head.appendChild(script);
                                return true;
                            }
                        } catch(e) {
                            console.error("Injection error:", e);
                            return false;
                        }
                    `);
                    
                    const result = scriptFunction();
                    console.log('Tampermonkey: 通过Function构造器注入脚本' + (result ? '成功' : '失败'));
                } catch (evalError) {
                    console.error('Tampermonkey: Function构造器执行失败', evalError);
                }
            }
        } catch (e) {
            console.error('Tampermonkey: 通过eval执行脚本失败:', e);
        }
    }
    
    /**
     * 通过URL方式尝试执行脚本（用于跨域iframe）
     */
    private tryExecuteViaURL(iframe: HTMLIFrameElement, scriptContent: string): void {
        try {
            console.log('Tampermonkey: 尝试通过URL方式注入脚本');
            
            // 创建Blob URL
            const blob = new Blob([scriptContent], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            
            // 创建script元素并设置src
            let script: HTMLScriptElement;
            
            try {
                // 尝试使用iframe的document创建元素
                if (iframe.contentDocument) {
                    script = iframe.contentDocument.createElement('script');
                } else {
                    // 回退到使用主document
                    script = document.createElement('script');
                }
            } catch (e) {
                // 如果出错，使用主document
                script = document.createElement('script');
            }
            
            script.src = url;
            script.type = 'text/javascript';
            script.setAttribute('data-tampermonkey', 'true');
            
            // 添加到iframe
            try {
                if (iframe.contentDocument && iframe.contentDocument.head) {
                    iframe.contentDocument.head.appendChild(script);
                    console.log('Tampermonkey: 通过Blob URL注入脚本到head成功');
                } else if (iframe.contentDocument && iframe.contentDocument.body) {
                    iframe.contentDocument.body.appendChild(script);
                    console.log('Tampermonkey: 通过Blob URL注入脚本到body成功');
                } else {
                    // 如果无法访问iframe内部，尝试使用iframe.onload
                    const scriptTag = `<script src="${url}" type="text/javascript" data-tampermonkey="true"></script>`;
                    
                    // 创建一个新的iframe作为注入容器
                    const injectionFrame = document.createElement('iframe');
                    injectionFrame.style.display = 'none';
                    injectionFrame.onload = function() {
                        try {
                            const iframeDoc = injectionFrame.contentDocument || injectionFrame.contentWindow?.document;
                            if (iframeDoc) {
                                iframeDoc.open();
                                iframeDoc.write(scriptTag);
                                iframeDoc.close();
                                console.log('Tampermonkey: 通过注入iframe执行脚本成功');
                            }
                        } catch (e) {
                            console.error('Tampermonkey: iframe注入失败:', e);
                        }
                    };
                    
                    // 添加到主文档
                    document.body.appendChild(injectionFrame);
                    console.log('Tampermonkey: 创建注入用iframe成功');
                }
            } catch (e) {
                console.error('Tampermonkey: 无法通过Blob URL方式注入:', e);
            }
            
            // 清理URL对象
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {
            console.error('Tampermonkey: 通过URL注入尝试失败:', e);
        }
    }
    
    /**
     * 在webview元素中执行脚本
     */
    private executeScriptInWebView(webview: HTMLElement, scriptContent: string): void {
        console.log('Tampermonkey: 尝试在webview中执行脚本');
        
        // 尝试使用executeJavaScript方法（Electron webview支持）
        try {
            // 检查是否有executeJavaScript方法 (Electron webview)
            const electronWebview = webview as any;
            if (typeof electronWebview.executeJavaScript === 'function') {
                console.log('Tampermonkey: 使用executeJavaScript注入脚本');
                electronWebview.executeJavaScript(scriptContent)
                    .then(() => console.log('Tampermonkey: 脚本已通过executeJavaScript注入'))
                    .catch((err: any) => console.error('Tampermonkey: executeJavaScript执行失败:', err));
                return;
            }
        } catch (e) {
            console.warn('Tampermonkey: 不支持executeJavaScript:', e);
        }
        
        // 尝试使用contentWindow如果可用
        try {
            if ((webview as any).contentWindow) {
                const win = (webview as any).contentWindow;
                const doc = win.document;
                
                console.log('Tampermonkey: 尝试通过contentWindow注入脚本');
                
                const script = doc.createElement('script');
                script.textContent = scriptContent;
                script.setAttribute('data-tampermonkey', 'true');
                doc.head.appendChild(script);
                
                console.log('Tampermonkey: 通过contentWindow注入成功');
                return;
            }
        } catch (e) {
            console.warn('Tampermonkey: 无法通过contentWindow注入:', e);
        }
        
        // 尝试使用contentDocument如果可用
        try {
            if ((webview as any).contentDocument) {
                const doc = (webview as any).contentDocument;
                
                console.log('Tampermonkey: 尝试通过contentDocument注入脚本');
                
                const script = doc.createElement('script');
                script.textContent = scriptContent;
                script.setAttribute('data-tampermonkey', 'true');
                doc.head.appendChild(script);
                
                console.log('Tampermonkey: 通过contentDocument注入成功');
                return;
            }
        } catch (e) {
            console.warn('Tampermonkey: 无法通过contentDocument注入:', e);
        }
        
        // 未找到直接执行方法，尝试其他方案
        console.warn('Tampermonkey: 尝试替代方法注入脚本');
        
        // 尝试通过向webview发送特殊事件来注入脚本
        try {
            const customEvent = new CustomEvent('obsidian-tampermonkey-inject', {
                detail: { script: scriptContent }
            });
            webview.dispatchEvent(customEvent);
            console.log('Tampermonkey: 已发送脚本注入事件到webview');
        } catch (e) {
            console.error('Tampermonkey: 事件派发失败:', e);
        }
    }

    /**
     * 注册菜单命令的通用函数
     */
    private registerMenuCommand(script: UserScript, name: string, fn: Function, accessKey?: string): number {
        try {
            // 使用自定义事件系统来处理菜单命令
            const commandId = Date.now() + Math.floor(Math.random() * 1000);
            
            // 保存命令到本地存储以便在设置UI中显示
            const commandsKey = `tampermonkey_commands:${script.id}`;
            let commands = [];
            try {
                const savedCommands = localStorage.getItem(commandsKey);
                if (savedCommands) {
                    commands = JSON.parse(savedCommands);
                }
            } catch (e) {
                console.error('解析保存的命令失败:', e);
            }
            
            commands.push({
                id: commandId,
                name: name,
                accessKey: accessKey || ''
            });
            
            localStorage.setItem(commandsKey, JSON.stringify(commands));
            
            // 创建自定义事件监听器来执行命令
            document.addEventListener(`tampermonkey-run-command-${commandId}`, () => {
                try {
                    fn();
                } catch (e) {
                    console.error(`Tampermonkey: 执行命令 "${name}" 失败:`, e);
                }
            });
            
            // 创建一个通知事件，告诉Tampermonkey UI有新命令可用
            const event = new CustomEvent('tampermonkey-command-registered', {
                detail: {
                    scriptId: script.id,
                    commandId: commandId,
                    name: name
                }
            });
            document.dispatchEvent(event);
            
            console.log(`Tampermonkey: 已注册菜单命令 "${name}"`);
            return commandId;
        } catch (e) {
            console.error(`Tampermonkey: 注册菜单命令 "${name}" 失败:`, e);
            return -1;
        }
    }

    /**
     * 从脚本内容中提取@connect规则定义的域名
     */
    private extractConnectDomains(scriptContent: string): string[] {
        const connectRegex = /\/\/\s*@connect\s+([^\s]+)/g;
        const domains: string[] = [];
        let match;
        
        while ((match = connectRegex.exec(scriptContent)) !== null) {
            if (match[1]) {
                domains.push(match[1].trim());
            }
        }
        
        // 默认允许的域名
        domains.push('localhost');
        domains.push('127.0.0.1');
        
        // 获取当前域名
        try {
            const currentHostname = window.location.hostname;
            if (currentHostname) {
                domains.push(currentHostname);
            }
        } catch (e) {
            console.warn('无法获取当前域名:', e);
        }
        
        return [...new Set(domains)]; // 去重
    }

    /**
     * 检查域名是否符合@connect规则
     */
    private isConnectAllowed(hostname: string, allowedDomains: string[]): boolean {
        // 如果没有@connect规则，则允许所有域名（TM默认行为）
        if (allowedDomains.length === 0) return true;
        
        // 精确匹配域名
        if (allowedDomains.includes(hostname)) return true;
        
        // 支持通配符匹配
        for (const domain of allowedDomains) {
            if (domain.startsWith('*.') && hostname.endsWith(domain.substring(1))) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 生成简化版的GM API
     */
    private generateSimpleGMAPIs(): string {
        return `
        // GM 存储 API
        window.GM_getValue = function(key, defaultValue) {
            try {
                const storedValue = localStorage.getItem('GM_' + key);
                return storedValue === null ? defaultValue : JSON.parse(storedValue);
            } catch (e) {
                console.error('GM_getValue error:', e);
                return defaultValue;
            }
        };
        
        window.GM_setValue = function(key, value) {
            try {
                localStorage.setItem('GM_' + key, JSON.stringify(value));
            } catch (e) {
                console.error('GM_setValue error:', e);
            }
        };
        
        window.GM_deleteValue = function(key) {
            try {
                localStorage.removeItem('GM_' + key);
            } catch (e) {
                console.error('GM_deleteValue error:', e);
            }
        };
        
        window.GM_listValues = function() {
            try {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('GM_')) {
                        keys.push(key.substring(3));
                    }
                }
                return keys;
            } catch (e) {
                console.error('GM_listValues error:', e);
                return [];
            }
        };
        
        // GM_getResourceText API
        window.GM_getResourceText = function(resourceName) {
            if (window._gmResourceCache && window._gmResourceCache[resourceName]) {
                return window._gmResourceCache[resourceName];
            }
            console.warn('Resource not found:', resourceName);
            return '';
        };
        
        // GM_registerMenuCommand API
        window._gmMenuCommands = [];
        window.GM_registerMenuCommand = function(name, callback, accessKey) {
            const id = Date.now() + Math.random();
            window._gmMenuCommands.push({
                id: id,
                name: name,
                callback: callback,
                accessKey: accessKey
            });
            
            // 检查是否需要创建菜单UI
            if (window._gmMenuCommands.length === 1) {
                // 在页面上创建一个简单的菜单按钮
                setTimeout(function() {
                    try {
                        // 只在顶级窗口创建UI
                        if (window.self !== window.top) return;
                        
                        // 创建菜单容器
                        const menuContainer = document.createElement('div');
                        menuContainer.id = 'gm-menu-container';
                        menuContainer.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;display:none;background:#fff;border-radius:5px;box-shadow:0 0 10px rgba(0,0,0,0.2);padding:5px 0;';
                        
                        // 创建菜单按钮
                        const menuButton = document.createElement('div');
                        menuButton.id = 'gm-menu-button';
                        menuButton.innerHTML = '⚙️';
                        menuButton.title = 'UserScript Menu';
                        menuButton.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;cursor:pointer;background:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 5px rgba(0,0,0,0.2);';
                        
                        // 添加到文档
                        document.body.appendChild(menuContainer);
                        document.body.appendChild(menuButton);
                        
                        // 点击按钮显示/隐藏菜单
                        menuButton.addEventListener('click', function() {
                            const isVisible = menuContainer.style.display === 'block';
                            menuContainer.style.display = isVisible ? 'none' : 'block';
                            
                            if (!isVisible) {
                                // 清除旧菜单项
                                menuContainer.innerHTML = '';
                                
                                // 添加菜单项
                                window._gmMenuCommands.forEach(function(command) {
                                    const menuItem = document.createElement('div');
                                    menuItem.className = 'gm-menu-item';
                                    menuItem.textContent = command.name;
                                    menuItem.style.cssText = 'padding:8px 15px;cursor:pointer;white-space:nowrap;';
                                    menuItem.addEventListener('click', function() {
                                        menuContainer.style.display = 'none';
                                        command.callback();
                                    });
                                    menuItem.addEventListener('mouseenter', function() {
                                        this.style.backgroundColor = '#f0f0f0';
                                    });
                                    menuItem.addEventListener('mouseleave', function() {
                                        this.style.backgroundColor = '';
                                    });
                                    menuContainer.appendChild(menuItem);
                                });
                            }
                        });
                        
                        // 点击页面其他地方关闭菜单
                        document.addEventListener('click', function(e) {
                            if (e.target !== menuButton && !menuContainer.contains(e.target)) {
                                menuContainer.style.display = 'none';
                            }
                        });
                    } catch(e) {
                        console.error('创建GM菜单失败:', e);
                    }
                }, 1000);
            }
            
            return id;
        };
        
        // GM_xmlhttpRequest API - 简化版
        window.GM_xmlhttpRequest = function(details) {
            return new Promise((resolve, reject) => {
                try {
                    const xhr = new XMLHttpRequest();
                    
                    xhr.open(details.method || 'GET', details.url, true);
                    
                    if (details.responseType) {
                        xhr.responseType = details.responseType;
                    }
                    
                    if (details.timeout) {
                        xhr.timeout = details.timeout;
                    }
                    
                    if (details.headers) {
                        for (const [key, value] of Object.entries(details.headers)) {
                            xhr.setRequestHeader(key, String(value));
                        }
                    }
                    
                    if (details.overrideMimeType) {
                        xhr.overrideMimeType(details.overrideMimeType);
                    }
                    
                    xhr.onload = function() {
                        const response = {
                            responseText: xhr.responseText,
                            response: xhr.response,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            readyState: xhr.readyState,
                            responseHeaders: xhr.getAllResponseHeaders(),
                            finalUrl: details.url
                        };
                        
                        if (typeof details.onload === 'function') {
                            details.onload(response);
                        }
                        
                        resolve(response);
                    };
                    
                    xhr.onerror = function(error) {
                        if (typeof details.onerror === 'function') {
                            details.onerror(error);
                        }
                        reject(error);
                    };
                    
                    xhr.send(details.data);
                } catch (error) {
                    if (typeof details.onerror === 'function') {
                        details.onerror(error);
                    }
                    reject(error);
                }
            });
        };
        
        // 创建新的实例方法，不使用原型扩展
        window.GM = {
            getValue: function(name, defaultValue) {
                return Promise.resolve(GM_getValue(name, defaultValue));
            },
            setValue: function(name, value) {
                GM_setValue(name, value);
                return Promise.resolve();
            },
            deleteValue: function(name) {
                GM_deleteValue(name);
                return Promise.resolve();
            },
            listValues: function() {
                return Promise.resolve(GM_listValues());
            },
            getResourceText: function(name) {
                return Promise.resolve(GM_getResourceText(name));
            },
            xmlHttpRequest: window.GM_xmlhttpRequest,
            registerMenuCommand: window.GM_registerMenuCommand,
            info: {
                scriptHandler: 'Obsidian Tampermonkey',
                version: '0.1.0'
            }
        };

        console.log('[Tampermonkey] GM APIs 初始化完成');
        `;
    }

    /**
     * 提取脚本中的@require和@resource标签
     */
    private extractResources(script: UserScript): {requires: string[], resources: {name: string, url: string}[]} {
        const result = {
            requires: [] as string[],
            resources: [] as {name: string, url: string}[]
        };
        
        // 从脚本源码中提取
        const requireMatches = Array.from(script.source.matchAll(/\/\/ @require\s+(https?:\/\/\S+)/g));
        const resourceMatches = Array.from(script.source.matchAll(/\/\/ @resource\s+(\S+)\s+(https?:\/\/\S+)/g));
        
        // 处理@require
        requireMatches.forEach(match => {
            if (match[1]) result.requires.push(match[1]);
        });
        
        // 处理@resource
        resourceMatches.forEach(match => {
            if (match[1] && match[2]) {
                result.resources.push({
                    name: match[1],
                    url: match[2]
                });
            }
        });
        
        // 合并脚本的requires属性
        if (script.requires && Array.isArray(script.requires)) {
            result.requires = [...new Set([...result.requires, ...script.requires])];
        }
        
        // 合并脚本的resources属性
        if (script.resources && typeof script.resources === 'object') {
            Object.entries(script.resources).forEach(([name, url]) => {
                if (typeof url === 'string') {
                    result.resources.push({name, url});
                }
            });
        }
        
        return result;
    }

    /**
     * 加载外部资源
     */
    private async loadExternalResource(url: string): Promise<string> {
        // 检查缓存
        if (this.resourceCache[url]) {
            return this.resourceCache[url];
        }
        
        try {
            console.log(`Tampermonkey: 加载外部资源 ${url}`);
            const response = await fetch(url, {
                cache: 'force-cache',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const content = await response.text();
            this.resourceCache[url] = content;
            console.log(`Tampermonkey: 已加载资源 ${url}`);
            return content;
        } catch (error) {
            console.error(`Tampermonkey: 加载资源失败 ${url}:`, error);
            return '';
        }
    }

    /**
     * 预处理脚本，处理外部依赖
     */
    private async preprocessScript(script: UserScript): Promise<string> {
        const { requires, resources } = this.extractResources(script);
        let processedCode = script.source;
        
        // 处理@resource
        let resourceCode = '';
        for (const resource of resources) {
            try {
                const content = await this.loadExternalResource(resource.url);
                resourceCode += `
                // 注入资源: ${resource.name} 从 ${resource.url}
                if (!window._gmResourceCache) window._gmResourceCache = {};
                window._gmResourceCache['${resource.name}'] = ${JSON.stringify(content)};
                
                // 添加GM_getResourceText支持
                if (!window.GM_getResourceText) {
                    window.GM_getResourceText = function(resourceName) {
                        return window._gmResourceCache[resourceName] || '';
                    };
                }
                `;
            } catch (error) {
                console.error(`Tampermonkey: 处理资源失败 ${resource.name}:`, error);
            }
        }
        
        // 处理@require
        let requireCode = '';
        for (const requireUrl of requires) {
            try {
                const content = await this.loadExternalResource(requireUrl);
                requireCode += `
                // 注入依赖: ${requireUrl}
                try {
                    ${content}
                } catch(e) {
                    console.error('Tampermonkey: 执行依赖脚本失败:', e);
                }
                `;
            } catch (error) {
                console.error(`Tampermonkey: 处理依赖失败 ${requireUrl}:`, error);
            }
        }
        
        // 组合最终代码
        return `
        // ==UserScript 预处理代码==
        (function() {
            // 资源和依赖初始化
            ${resourceCode}
            
            // 外部依赖
            ${requireCode}
            
            // 原始脚本
            ${processedCode}
        })();
        `;
    }
} 