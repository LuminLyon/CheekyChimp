import { UserScript, ScriptStorage, GM_API } from '../../models/script';
import { MenuCommand } from './types';
import { extractConnectDomains, isConnectAllowed, getScriptMetaStr, logPrefix } from './utils';
import { MenuCommandManager } from './MenuCommandManager';

// 在文件顶部添加全局接口声明 
declare global {
    interface Window {
        _cheekyChimpCommands?: {
            [scriptId: string]: Array<{
                id: number;
                name: string;
                callback: Function;
                accessKey?: string;
            }>;
        };
    }
}

/**
 * GM API工厂，负责创建脚本需要的GM API
 */
export class GMApiFactory {
    private menuCommandManager: MenuCommandManager;
    
    constructor(private scriptStorage: ScriptStorage) {
        // 初始化菜单命令管理器
        this.menuCommandManager = new MenuCommandManager();
    }
    
    /**
     * 为脚本创建GM API
     */
    public async createGmApi(script: UserScript, url: string): Promise<GM_API> {
        // 创建GM info对象
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
            version: '0.1.0', // 插件版本
            scriptHandler: 'Obsidian CheekyChimp',
            scriptMetaStr: getScriptMetaStr(script)
        };
        
        // 提取脚本中的@connect规则
        const connectDomains = extractConnectDomains(script.source);
        
        // 创建存储命名空间
        const scriptStorage = this.createStorageNamespace(script);
        
        // 创建XML HTTP请求处理函数
        const xmlHttpRequest = this.createXmlHttpRequestFunction(script, connectDomains);
        
        // 创建完整的GM API对象
        return {
            // GM基本信息
            GM_info: info,
            
            // 存储API - 同步版本
            GM_getValue: (name: string, defaultValue?: any): any => {
                return localStorage.getItem(`cheekychimp:${script.id}:${name}`) || defaultValue;
            },
            GM_setValue: (name: string, value: any): void => {
                localStorage.setItem(`cheekychimp:${script.id}:${name}`, value);
                scriptStorage.setValue(name, value);
            },
            GM_deleteValue: (name: string): void => {
                localStorage.removeItem(`cheekychimp:${script.id}:${name}`);
                scriptStorage.deleteValue(name);
            },
            GM_listValues: (): string[] => {
                const keys = [];
                const prefix = `cheekychimp:${script.id}:`;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keys.push(key.substring(prefix.length));
                    }
                }
                return keys;
            },
            
            // 新版GM API - 异步版本
            GM: {
                getValue: async (name: string, defaultValue?: any): Promise<any> => {
                    const key = `cheekychimp:${script.id}:${name}`;
                    const value = localStorage.getItem(key);
                    return value !== null ? value : defaultValue;
                },
                setValue: async (name: string, value: any): Promise<void> => {
                    localStorage.setItem(`cheekychimp:${script.id}:${name}`, value);
                    await scriptStorage.setValue(name, value);
                },
                deleteValue: async (name: string): Promise<void> => {
                    localStorage.removeItem(`cheekychimp:${script.id}:${name}`);
                    await scriptStorage.deleteValue(name);
                },
                listValues: async (): Promise<string[]> => {
                    const keys = [];
                    const prefix = `cheekychimp:${script.id}:`;
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(prefix)) {
                            keys.push(key.substring(prefix.length));
                        }
                    }
                    return keys;
                },
                
                // 新版XMLHttpRequest
                xmlHttpRequest: xmlHttpRequest,
                
                // 样式API
                addStyle: async (css: string): Promise<HTMLStyleElement> => {
                    const style = document.createElement('style');
                    style.textContent = css;
                    style.setAttribute('data-cheekychimp-style', script.id);
                    document.head.appendChild(style);
                    return style;
                },
                
                // 菜单命令
                registerMenuCommand: async (name: string, fn: Function, accessKey?: string): Promise<number> => {
                    return this.registerMenuCommand(script, name, fn, accessKey);
                },
                
                // 元素API
                addElement: async (tagName: string, attributes: any): Promise<HTMLElement> => {
                    const element = document.createElement(tagName);
                    for (const [key, value] of Object.entries(attributes)) {
                        element.setAttribute(key, String(value));
                    }
                    document.body.appendChild(element);
                    return element;
                }
            },
            
            // 资源API
            GM_getResourceText: this.createGetResourceTextFunction(script),
            GM_getResourceURL: this.createGetResourceUrlFunction(script),
            
            // UI API
            GM_addStyle: (css: string): void => {
                try {
                    const style = document.createElement('style');
                    style.textContent = css;
                    style.setAttribute('data-cheekychimp-style', script.id);
                    document.head.appendChild(style);
                } catch (e) {
                    console.error(`${logPrefix('GMApiFactory')}: Adding style failed:`, e);
                }
            },
            GM_addElement: (tagName: string, attributes: any): HTMLElement => {
                const element = document.createElement(tagName);
                for (const [key, value] of Object.entries(attributes)) {
                    element.setAttribute(key, String(value));
                }
                document.body.appendChild(element);
                return element;
            },
            
            // 菜单API
            GM_registerMenuCommand: (name: string, fn: Function, accessKey?: string): number => {
                return this.registerMenuCommand(script, name, fn, accessKey);
            },
            GM_unregisterMenuCommand: (menuCmdId: number): void => {
                this.unregisterMenuCommand(script, menuCmdId);
            },
            
            // 网络API
            GM_xmlhttpRequest: xmlHttpRequest,
            
            // 其他API
            GM_openInTab: (url: string, options?: any): any => {
                window.open(url, '_blank');
                return null;
            },
            GM_setClipboard: (data: string, info?: any): void => {
                navigator.clipboard.writeText(data)
                    .catch(err => console.error('Failed to copy text: ', err));
            },
            GM_notification: (details: any, ondone?: Function): void => {
                alert(typeof details === 'string' ? details : details.text);
            },
            
            // 访问window对象
            unsafeWindow: window as any
        };
    }
    
    /**
     * 创建简化版的GM API，用于webview注入
     */
    public generateSimpleGMAPIs(): string {
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
            console.log("[CheekyChimp] Registering menu command: " + name);
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
                        if (window.self !== window.top) {
                            console.log("[CheekyChimp] Skipping menu UI creation in iframe");
                            return;
                        }
                        
                        console.log("[CheekyChimp] Creating menu UI with " + window._gmMenuCommands.length + " commands");
                        
                        // 创建菜单容器和按钮
                        const setupMenu = function() {
                            // 检查是否已创建
                            if (document.getElementById('gm-menu-container')) {
                                console.log("[CheekyChimp] Menu UI already exists, skipping creation");
                                return;
                            }
                            
                            console.log("[CheekyChimp] Starting to create menu UI elements");
                            
                            // 创建菜单容器
                            const menuContainer = document.createElement('div');
                            menuContainer.id = 'gm-menu-container';
                            menuContainer.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;display:none;background:#fff;border-radius:5px;box-shadow:0 0 10px rgba(0,0,0,0.2);padding:5px 0;';
                            
                            // 创建菜单按钮 - 半隐藏式设计
                            const menuButton = document.createElement('div');
                            menuButton.id = 'gm-menu-button';
                            menuButton.innerHTML = '⚙️';
                            menuButton.title = 'UserScript Menu';
                            menuButton.style.cssText = 'position:fixed;top:10px;right:-20px;z-index:10000;cursor:pointer;background:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 5px rgba(0,0,0,0.2);transition:right 0.3s ease;opacity:0.85;';
                            
                            // 创建一个触发区域
                            const triggerZone = document.createElement('div');
                            triggerZone.id = 'gm-trigger-zone';
                            triggerZone.style.cssText = 'position:fixed;top:0;right:0;width:30px;height:50px;z-index:9999;';
                            
                            // 添加到文档
                            document.body.appendChild(menuContainer);
                            document.body.appendChild(menuButton);
                            document.body.appendChild(triggerZone);
                            
                            console.log("[CheekyChimp] Menu UI elements added to DOM");
                            
                            // 鼠标移入触发区域或按钮时显示完整按钮
                            const showFullButton = function() {
                                menuButton.style.right = '10px';
                            };
                            
                            // 鼠标移出区域时半隐藏按钮（除非菜单已打开）
                            const hidePartialButton = function() {
                                if (menuContainer.style.display !== 'block') {
                                    menuButton.style.right = '-20px';
                                }
                            };
                            
                            triggerZone.addEventListener('mouseenter', showFullButton);
                            triggerZone.addEventListener('mouseleave', hidePartialButton);
                            menuButton.addEventListener('mouseenter', showFullButton);
                            menuButton.addEventListener('mouseleave', hidePartialButton);
                            
                            // 点击按钮显示/隐藏菜单
                            menuButton.addEventListener('click', function() {
                                const isVisible = menuContainer.style.display === 'block';
                                menuContainer.style.display = isVisible ? 'none' : 'block';
                                
                                console.log("[CheekyChimp] Menu state toggled: " + (isVisible ? "hidden" : "visible"));
                                
                                // 如果菜单关闭且鼠标不在触发区域或按钮上，则再次半隐藏按钮
                                if (isVisible) {
                                    // 检查鼠标是否在触发区域或按钮上
                                    const checkMousePos = function(e) {
                                        const triggerRect = triggerZone.getBoundingClientRect();
                                        const buttonRect = menuButton.getBoundingClientRect();
                                        
                                        const mouseInTrigger = (
                                            e.clientX >= triggerRect.left && 
                                            e.clientX <= triggerRect.right && 
                                            e.clientY >= triggerRect.top && 
                                            e.clientY <= triggerRect.bottom
                                        );
                                        
                                        const mouseInButton = (
                                            e.clientX >= buttonRect.left && 
                                            e.clientX <= buttonRect.right && 
                                            e.clientY >= buttonRect.top && 
                                            e.clientY <= buttonRect.bottom
                                        );
                                        
                                        if (!mouseInTrigger && !mouseInButton) {
                                            hidePartialButton();
                                            document.removeEventListener('mousemove', checkMousePos);
                                        }
                                    };
                                    
                                    // 添加一次性检查
                                    setTimeout(() => {
                                        document.addEventListener('mousemove', checkMousePos, { once: true });
                                    }, 100);
                                }
                                
                                if (!isVisible) {
                                    // 清除旧菜单项
                                    menuContainer.innerHTML = '';
                                    
                                    // 添加菜单项
                                    console.log("[CheekyChimp] Adding menu items: " + window._gmMenuCommands.length + " commands");
                                    
                                    window._gmMenuCommands.forEach(function(command) {
                                        const menuItem = document.createElement('div');
                                        menuItem.className = 'gm-menu-item';
                                        menuItem.textContent = command.name;
                                        menuItem.style.cssText = 'padding:8px 15px;cursor:pointer;white-space:nowrap;';
                                        menuItem.addEventListener('click', function() {
                                            menuContainer.style.display = 'none';
                                            console.log("[CheekyChimp] Executing menu command: \"" + command.name + "\"");
                                            command.callback();
                                        });
                                        menuItem.addEventListener('mouseenter', function() {
                                            this.style.backgroundColor = '#f0f0f0';
                                        });
                                        menuItem.addEventListener('mouseleave', function() {
                                            this.style.backgroundColor = '';
                                        });
                                        menuContainer.appendChild(menuItem);
                                        console.log("[CheekyChimp] Added menu item: \"" + command.name + "\"");
                                    });
                                }
                            });
                            
                            // 点击页面其他地方关闭菜单
                            document.addEventListener('click', function(e) {
                                if (e.target !== menuButton && !menuContainer.contains(e.target)) {
                                    menuContainer.style.display = 'none';
                                }
                            });
                            
                            console.log("[CheekyChimp] Menu UI event listeners set up");
                        };
                        
                        // 如果文档已经加载完成，直接设置菜单
                        if (document.body) {
                            console.log("[CheekyChimp] Document already loaded, setting up menu now");
                            setupMenu();
                        } else {
                            // 否则等待文档加载完成
                            console.log("[CheekyChimp] Document not loaded, waiting for DOMContentLoaded");
                            document.addEventListener('DOMContentLoaded', setupMenu);
                        }
                    } catch(e) {
                        console.error("[CheekyChimp] Failed to create GM menu:", e);
                    }
                }, 1000);
            }
            
            return id;
        };
        
        // 其他API
        window.GM_xmlhttpRequest = function(details) {
            // 简化实现
            const xhr = new XMLHttpRequest();
            xhr.open(details.method || 'GET', details.url, true);
            
            if (details.headers) {
                for (const [key, value] of Object.entries(details.headers)) {
                    xhr.setRequestHeader(key, String(value));
                }
            }
            
            xhr.onload = function() {
                if (details.onload) {
                    details.onload({
                        responseText: xhr.responseText,
                        response: xhr.response,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        readyState: xhr.readyState,
                        responseHeaders: xhr.getAllResponseHeaders(),
                        finalUrl: details.url
                    });
                }
            };
            
            xhr.onerror = function(error) {
                if (details.onerror) {
                    details.onerror(error);
                }
            };
            
            xhr.send(details.data);
            
            return {
                abort: function() {
                    xhr.abort();
                }
            };
        };
        
        // 基础版GM对象
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
            xmlHttpRequest: window.GM_xmlhttpRequest,
            info: {
                scriptHandler: 'Obsidian CheekyChimp',
                version: '0.1.0'
            }
        };

        console.log('[CheekyChimp] GM APIs initialization completed');
        `;
    }
    
    /**
     * 创建脚本的存储命名空间
     */
    private createStorageNamespace(script: UserScript): {
        getValue: (name: string, defaultValue?: any) => Promise<any>;
        setValue: (name: string, value: any) => Promise<void>;
        deleteValue: (name: string) => Promise<void>;
        listValues: () => Promise<string[]>;
    } {
        return {
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
    }
    
    /**
     * 创建xmlHttpRequest函数
     */
    private createXmlHttpRequestFunction(script: UserScript, connectDomains: string[]): (details: any) => any {
        return (details: any): any => {
            console.log(`${logPrefix('GMApiFactory')}: Executing xmlhttpRequest ${details.url}`);
            try {
                // 创建一个简单的xhr对象和取消控制器
                const xhr = new XMLHttpRequest();
                const controller = new AbortController();
                
                // 解析URL并检查是否允许连接
                const url = new URL(details.url);
                const hostname = url.hostname;
                
                // 检查连接是否允许
                let isAllowed: boolean = isConnectAllowed(hostname, connectDomains);
                
                if (!isAllowed) {
                    console.warn(`${logPrefix('GMApiFactory')}: Request ${hostname} not in @connect list, may be blocked`);
                }
                
                // 创建返回对象，提供abort方法
                const returnObj = {
                    abort: () => {
                        controller.abort();
                    }
                };
                
                // 执行fetch请求
                fetch(details.url, {
                    method: details.method || 'GET',
                    signal: controller.signal,
                    credentials: details.withCredentials ? 'include' : 'same-origin'
                })
                    .then(async response => {
                        // 准备响应头
                        let responseHeaders = '';
                        if (response.headers) {
                            if (typeof response.headers.forEach === 'function') {
                                const headerPairs: string[] = [];
                                response.headers.forEach((value, key) => {
                                    headerPairs.push(`${key}: ${value}`);
                                });
                                responseHeaders = headerPairs.join('\n');
                            } else {
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
                console.error(`${logPrefix('GMApiFactory')}: XMLHttpRequest execution failed:`, error);
                if (details.onerror && typeof details.onerror === 'function') {
                    details.onerror(error);
                }
                return null;
            }
        };
    }
    
    /**
     * 创建getResourceText函数
     */
    private createGetResourceTextFunction(script: UserScript): (name: string) => string {
        return (name: string): string => {
            console.log(`${logPrefix('GMApiFactory')}: Getting resource text ${name}`);
            try {
                // 从脚本的@resource元数据中查找资源URL
                const resourceMap = script.resources.reduce((map, res) => {
                    map[res.name] = res.url;
                    return map;
                }, {} as Record<string, string>);
                
                const resourceUrl = resourceMap[name];
                if (!resourceUrl) {
                    console.warn(`${logPrefix('GMApiFactory')}: Resource ${name} not found`);
                    return '';
                }
                
                // 尝试从缓存获取资源
                const cacheKey = `cheekychimp_resource:${script.id}:${name}`;
                const cachedResource = localStorage.getItem(cacheKey);
                if (cachedResource) {
                    console.log(`${logPrefix('GMApiFactory')}: Using cached resource ${name}`);
                    return cachedResource;
                }
                
                // 如果没有缓存，通过同步方式返回空字符串
                // 并在后台获取资源以便下次使用
                console.log(`${logPrefix('GMApiFactory')}: Resource${name} not cached, starting background load`);
                
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
                                console.log(`${logPrefix('GMApiFactory')}: Resource ${name} cached for next use`);
                            } catch (e) {
                                console.warn(`${logPrefix('GMApiFactory')}: Unable to cache resource, may exceed storage limit`, e);
                            }
                        })
                        .catch(error => {
                            console.error(`${logPrefix('GMApiFactory')}: Background resource ${name} load failed:`, error);
                        });
                }, 0);
                
                return ''; // 首次调用返回空字符串
            } catch (error) {
                console.error(`${logPrefix('GMApiFactory')}: Getting resource ${name} failed:`, error);
                return '';
            }
        };
    }
    
    /**
     * 创建getResourceURL函数
     */
    private createGetResourceUrlFunction(script: UserScript): (name: string) => string {
        return (name: string): string => {
            try {
                // 从脚本的@resource元数据中查找资源URL
                const resourceMap = script.resources.reduce((map, res) => {
                    map[res.name] = res.url;
                    return map;
                }, {} as Record<string, string>);
                
                const resourceUrl = resourceMap[name];
                if (!resourceUrl) {
                    console.warn(`${logPrefix('GMApiFactory')}: Resource ${name} not found`);
                    return '';
                }
                
                return resourceUrl;
            } catch (error) {
                console.error(`${logPrefix('GMApiFactory')}: Getting resource URL ${name} failed:`, error);
                return '';
            }
        };
    }
    
    /**
     * 注册菜单命令
     */
    private registerMenuCommand(script: UserScript, name: string, fn: Function, accessKey?: string): number {
        try {
            // 使用菜单命令管理器注册命令
            const commandId = this.menuCommandManager.registerMenuCommand(script, name, fn, accessKey);
            
            // 为了保持兼容，也保存到原来的存储位置
            const commandsKey = `tampermonkey_commands:${script.id}`;
            let commands: Array<{id: number; name: string; accessKey?: string}> = [];
            try {
                const savedCommands = localStorage.getItem(commandsKey);
                if (savedCommands) {
                    commands = JSON.parse(savedCommands);
                }
            } catch (e) {
                console.error('Parsing saved commands failed:', e);
            }
            
            commands.push({
                id: typeof commandId === 'string' ? parseInt(commandId, 36) : commandId,
                name,
                accessKey
            });
            
            localStorage.setItem(commandsKey, JSON.stringify(commands));
            
            // 创建自定义事件监听器，用于保持向后兼容性
            document.addEventListener(`cheekychimp-run-command-${commandId}`, () => {
                try {
                    fn();
                } catch (e) {
                    console.error(`${logPrefix('GMApiFactory')}: Executing command "${name}" failed:`, e);
                }
            });
            
            // 通知UI有新命令可用
            const event = new CustomEvent('cheekychimp-command-registered', {
                detail: {
                    scriptId: script.id,
                    commandId,
                    name,
                    callback: fn
                }
            });
            document.dispatchEvent(event);
            
            console.log(`${logPrefix('GMApiFactory')}: Registered menu command "${name}"`);
            return typeof commandId === 'string' ? parseInt(commandId, 36) : commandId;
        } catch (e) {
            console.error(`${logPrefix('GMApiFactory')}: Registering menu command "${name}" failed:`, e);
            return -1;
        }
    }
    
    /**
     * 注销菜单命令
     */
    private unregisterMenuCommand(script: UserScript, menuCmdId: number): void {
        try {
            // 使用菜单命令管理器注销命令
            this.menuCommandManager.unregisterMenuCommand(script.id, menuCmdId);
            
            // 也从原来的存储位置移除
            const commandsKey = `tampermonkey_commands:${script.id}`;
            let commands: Array<{id: number; name: string; accessKey?: string}> = [];
            try {
                const savedCommands = localStorage.getItem(commandsKey);
                if (savedCommands) {
                    commands = JSON.parse(savedCommands);
                    commands = commands.filter(cmd => cmd.id !== menuCmdId);
                    localStorage.setItem(commandsKey, JSON.stringify(commands));
                }
            } catch (e) {
                console.error('Parsing saved commands failed:', e);
            }
            
            // 移除事件监听器
            document.removeEventListener(`cheekychimp-run-command-${menuCmdId}`, () => {});
            
            // 通知UI命令已被移除
            const event = new CustomEvent('cheekychimp-command-unregistered', {
                detail: {
                    scriptId: script.id,
                    commandId: menuCmdId
                }
            });
            document.dispatchEvent(event);
            
            console.log(`${logPrefix('GMApiFactory')}: Unregistered menu command ID ${menuCmdId}`);
        } catch (e) {
            console.error(`${logPrefix('GMApiFactory')}: Unregistering menu command ID ${menuCmdId} failed:`, e);
        }
    }

    /**
     * 创建脚本包装器，包含完整的GM API和特殊处理
     */
    public createScriptWrapper(script: UserScript, gmApi: GM_API, scriptContent: string): string {
        // 检测是否为特殊脚本
        const isImmersiveTranslate = script.name.includes('Immersive Translate');
        const isNightMode = script.name.includes('夜间模式') || script.name.includes('Night Mode');
        const hasSweet = script.resources && script.resources.some(r => r.name === 'swalStyle');
        
        // 创建脚本包装器代码
        return `
            (function() {
                try {
                    // 定义基本的GM信息对象
                    const GM_info = ${JSON.stringify(gmApi.GM_info)};
                    console.log('CheekyChimp: 准备执行脚本 "${script.name}"', GM_info);
                    
                    // 定义GM API函数
                    const GM_getValue = function(name, defaultValue) {
                        return localStorage.getItem('cheekychimp:${script.id}:' + name) || defaultValue;
                    };
                    
                    const GM_setValue = function(name, value) {
                        localStorage.setItem('cheekychimp:${script.id}:' + name, value);
                    };
                    
                    const GM_deleteValue = function(name) {
                        localStorage.removeItem('cheekychimp:${script.id}:' + name);
                    };
                    
                    const GM_listValues = function() {
                        const keys = [];
                        const prefix = 'cheekychimp:${script.id}:';
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
                            console.error('CheekyChimp: GM_addStyle error', e);
                        }
                    };
                    
                    // 资源获取API
                    const GM_getResourceText = function(name) {
                        // 从缓存中获取资源
                        const cacheKey = 'cheekychimp_resource:${script.id}:' + name;
                        const cachedResource = localStorage.getItem(cacheKey);
                        
                        // 为夜间模式助手脚本提供默认样式
                        if (name === 'swalStyle' && !cachedResource && ${isNightMode}) {
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
                    
                    // 菜单命令API
                    const GM_registerMenuCommand = function(name, fn, accessKey) {
                        console.log('CheekyChimp: Script registering menu command:', name);
                        // 存储命令到本地存储
                        const commandId = Date.now() + Math.floor(Math.random() * 1000);
                        const commandsKey = 'cheekychimp_commands:${script.id}';
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
                        
                        // 创建菜单UI
                        setTimeout(function() {
                            try {
                                // 检查是否在iframe中
                                if (window.self !== window.top) {
                                    return; // 避免在iframe中创建重复的菜单
                                }
                                
                                // 检查是否已经有菜单容器
                                let menuContainer = document.getElementById('gm-menu-container');
                                if (!menuContainer) {
                                    // 创建菜单容器和按钮
                                    const setupMenuUI = function() {
                                        // 创建菜单容器
                                        menuContainer = document.createElement('div');
                                        menuContainer.id = 'gm-menu-container';
                                        menuContainer.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;display:none;background:#fff;border-radius:5px;box-shadow:0 0 10px rgba(0,0,0,0.2);padding:5px 0;';
                                        
                                        // 创建菜单按钮 - 半隐藏式设计
                                        const menuButton = document.createElement('div');
                                        menuButton.id = 'gm-menu-button';
                                        menuButton.innerHTML = '⚙️';
                                        menuButton.title = 'UserScript Menu';
                                        menuButton.style.cssText = 'position:fixed;top:10px;right:-20px;z-index:10000;cursor:pointer;background:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 5px rgba(0,0,0,0.2);transition:right 0.3s ease;opacity:0.85;';
                                        
                                        // 创建一个触发区域
                                        const triggerZone = document.createElement('div');
                                        triggerZone.id = 'gm-trigger-zone';
                                        triggerZone.style.cssText = 'position:fixed;top:0;right:0;width:30px;height:50px;z-index:9999;';
                                        
                                        // 添加到文档
                                        document.body.appendChild(menuContainer);
                                        document.body.appendChild(menuButton);
                                        document.body.appendChild(triggerZone);
                                        
                                        console.log("[CheekyChimp] Menu UI elements added to DOM");
                                        
                                        // 鼠标移入触发区域或按钮时显示完整按钮
                                        const showFullButton = function() {
                                            menuButton.style.right = '10px';
                                        };
                                        
                                        // 鼠标移出区域时半隐藏按钮（除非菜单已打开）
                                        const hidePartialButton = function() {
                                            if (menuContainer.style.display !== 'block') {
                                                menuButton.style.right = '-20px';
                                            }
                                        };
                                        
                                        triggerZone.addEventListener('mouseenter', showFullButton);
                                        triggerZone.addEventListener('mouseleave', hidePartialButton);
                                        menuButton.addEventListener('mouseenter', showFullButton);
                                        menuButton.addEventListener('mouseleave', hidePartialButton);
                                        
                                        // 点击按钮显示/隐藏菜单
                                        menuButton.addEventListener('click', function() {
                                            const isVisible = menuContainer.style.display === 'block';
                                            menuContainer.style.display = isVisible ? 'none' : 'block';
                                            
                                            // 如果菜单关闭且鼠标不在触发区域或按钮上，则再次半隐藏按钮
                                            if (isVisible) {
                                                // 检查鼠标是否在触发区域或按钮上
                                                const checkMousePos = function(e) {
                                                    const triggerRect = triggerZone.getBoundingClientRect();
                                                    const buttonRect = menuButton.getBoundingClientRect();
                                                    
                                                    const mouseInTrigger = (
                                                        e.clientX >= triggerRect.left && 
                                                        e.clientX <= triggerRect.right && 
                                                        e.clientY >= triggerRect.top && 
                                                        e.clientY <= triggerRect.bottom
                                                    );
                                                    
                                                    const mouseInButton = (
                                                        e.clientX >= buttonRect.left && 
                                                        e.clientX <= buttonRect.right && 
                                                        e.clientY >= buttonRect.top && 
                                                        e.clientY <= buttonRect.bottom
                                                    );
                                                    
                                                    if (!mouseInTrigger && !mouseInButton) {
                                                        hidePartialButton();
                                                        document.removeEventListener('mousemove', checkMousePos);
                                                    }
                                                };
                                                
                                                // 添加一次性检查
                                                setTimeout(() => {
                                                    document.addEventListener('mousemove', checkMousePos, { once: true });
                                                }, 100);
                                            }
                                            
                                            if (!isVisible) {
                                                // 清除旧菜单项
                                                menuContainer.innerHTML = '';
                                                
                                                // 添加菜单项
                                                console.log("[CheekyChimp] Adding menu items: " + window._gmMenuCommands.length + " commands");
                                                
                                                window._gmMenuCommands.forEach(function(command) {
                                                    const menuItem = document.createElement('div');
                                                    menuItem.className = 'gm-menu-item';
                                                    menuItem.textContent = command.name;
                                                    menuItem.style.cssText = 'padding:8px 15px;cursor:pointer;white-space:nowrap;';
                                                    menuItem.addEventListener('click', function() {
                                                        menuContainer.style.display = 'none';
                                                        console.log("[CheekyChimp] Executing menu command: \"" + command.name + "\"");
                                                        command.callback();
                                                    });
                                                    menuItem.addEventListener('mouseenter', function() {
                                                        this.style.backgroundColor = '#f0f0f0';
                                                    });
                                                    menuItem.addEventListener('mouseleave', function() {
                                                        this.style.backgroundColor = '';
                                                    });
                                                    menuContainer.appendChild(menuItem);
                                                    console.log("[CheekyChimp] Added menu item: \"" + command.name + "\"");
                                                });
                                            }
                                        });
                                        
                                        // 点击页面其他地方关闭菜单
                                        document.addEventListener('click', function(e) {
                                            if (e.target !== menuButton && !menuContainer.contains(e.target)) {
                                                menuContainer.style.display = 'none';
                                            }
                                        });
                                        
                                        console.log("[CheekyChimp] Menu UI event listeners set up");
                                    };
                                    
                                    // 存储菜单命令
                                    if (!window._gmMenuCommands) {
                                        window._gmMenuCommands = [];
                                    }
                                    
                                    // 如果文档已经加载完成，立即设置
                                    if (document.body) {
                                        setupMenuUI();
                                    } else {
                                        // 等待文档加载
                                        document.addEventListener('DOMContentLoaded', setupMenuUI);
                                    }
                                }
                                
                                // 添加命令到内存中
                                if (!window._gmMenuCommands) {
                                    window._gmMenuCommands = [];
                                }
                                
                                window._gmMenuCommands.push({
                                    id: commandId,
                                    name: name,
                                    callback: fn
                                });
                                
                                // 如果菜单已经存在并且打开，刷新菜单项
                                const menuButton = document.getElementById('gm-menu-button');
                                const menuContainer = document.getElementById('gm-menu-container');
                                if (menuButton && menuContainer && menuContainer.style.display === 'block') {
                                    menuButton.click(); // 关闭菜单
                                    menuButton.click(); // 重新打开菜单以刷新
                                }
                            } catch(e) {
                                console.error('CheekyChimp: Failed to create menu item', e);
                            }
                        }, 500);
                        
                        // 为事件监听创建自定义事件
                        document.addEventListener('cheekychimp-run-command-' + commandId, function() {
                            try {
                                fn();
                            } catch(e) {
                                console.error('CheekyChimp: Failed to execute command', e);
                            }
                        });
                        
                        return commandId;
                    };
                    
                    // XMLHttpRequest API
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
                                            // 构建headers对象
                                            let responseHeaders = '';
                                            try {
                                                const headerPairs = [];
                                                response.headers.forEach((value, key) => {
                                                    headerPairs.push(\`\${key}: \${value}\`);
                                                });
                                                responseHeaders = headerPairs.join('\\n');
                                            } catch (e) {
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
                            console.error('CheekyChimp: GM_xmlhttpRequest error', e);
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
                        }
                    };
                    
                    // 其他API
                    const unsafeWindow = window;
                    
                    // 夜间模式助手脚本支持
                    if (${isNightMode}) {
                        window.Swal = window.Swal || {
                            fire: function(options) {
                                alert(options.title || 'Message');
                                return Promise.resolve({isConfirmed: true});
                            }
                        };
                    }
                    
                    // 沉浸式翻译支持
                    if (${isImmersiveTranslate}) {
                        console.log('CheekyChimp: 检测到沉浸式翻译脚本，添加特殊处理');
                        
                        // 修复浏览器兼容性对象
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
                        
                        // 添加基础样式
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
                            }
                        } catch (e) {
                            console.error('CheekyChimp: Adding translation styles failed:', e);
                        }
                        
                        // 添加翻译按钮
                        const addTranslationButton = () => {
                            try {
                                // 检查是否已存在按钮
                                if (document.getElementById('immersive-translate-button')) {
                                    return;
                                }
                                
                                // 手动注入翻译按钮
                                const translationButton = document.createElement('div');
                                translationButton.id = 'immersive-translate-button';
                                translationButton.title = '沉浸式翻译';
                                translationButton.innerHTML = '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M211.2 883.2A64 64 0 0 1 147.2 819.2V204.8A64 64 0 0 1 211.2 140.8h249.6v61.44H512v7.68l-0.64 3.84A64 64 0 0 1 448.64 256l-0.64 3.2h-232.96A63.36 63.36 0 0 0 192 256v558.08A61.44 61.44 0 0 0 221.44 856.32A64 64 0 0 0 256 864h232.32c33.28-4.48 59.52-30.08 64-61.44V768h-64v-64h126.08A64 64 0 0 1 678.4 768v34.56A128 128 0 0 1 551.04 928H211.2z" fill="currentColor"></path><path d="M812.8 752.64h-60.8v-128c0-32-30.08-62.08-62.08-62.08h-159.36v-62.08h159.36c65.28 0 125.44 60.16 125.44 125.44v126.72zM448 266.24v-64h126.08A64 64 0 0 1 640 266.24z" fill="currentColor"></path><path d="M787.2 659.2l-96-166.4h64l64 115.2 64-115.2h64l-96 166.4z" fill="currentColor"></path></svg>';
                                document.body.appendChild(translationButton);
                                
                                // 添加点击事件
                                translationButton.addEventListener('click', () => {
                                    try {
                                        // 尝试多种方式激活翻译
                                        window.dispatchEvent(new CustomEvent('immersive-translate-toggle'));
                                        
                                        if (window.immersiveTranslate?.toggleTranslate) {
                                            window.immersiveTranslate.toggleTranslate();
                                        }
                                        
                                        // 尝试从菜单命令中查找
                                        if (typeof GM !== 'undefined') {
                                            const menuCommands = localStorage.getItem('cheekychimp_commands:${script.id}');
                                            if (menuCommands) {
                                                try {
                                                    const commands = JSON.parse(menuCommands);
                                                    for (const cmd of commands) {
                                                        if (cmd.name.includes('翻译') || cmd.name.includes('Translate')) {
                                                            document.dispatchEvent(new CustomEvent('cheekychimp-run-command-' + cmd.id));
                                                            break;
                                                        }
                                                    }
                                                } catch (e) {}
                                            }
                                        }
                                    } catch (e) {
                                        console.error('CheekyChimp: Translation trigger failed:', e);
                                        alert('沉浸式翻译初始化中，请稍后再试');
                                    }
                                });
                            } catch (e) {
                                console.error('CheekyChimp: Adding translation UI failed:', e);
                            }
                        };
                        
                        // 确保在页面各阶段都尝试添加按钮
                        if (document.body) {
                            setTimeout(addTranslationButton, 500);
                        }
                        
                        window.addEventListener('DOMContentLoaded', () => {
                            setTimeout(addTranslationButton, 500);
                        });
                        
                        window.addEventListener('load', () => {
                            setTimeout(addTranslationButton, 1000);
                        });
                        
                        // 添加DOM观察器
                        if (!document.body) {
                            const bodyObserver = new MutationObserver(() => {
                                if (document.body) {
                                    bodyObserver.disconnect();
                                    setTimeout(addTranslationButton, 100);
                                }
                            });
                            bodyObserver.observe(document.documentElement || document, { childList: true, subtree: true });
                        }
                        
                        // 定期检查按钮是否存在
                        const checkInterval = setInterval(() => {
                            if (document.body && !document.getElementById('immersive-translate-button')) {
                                addTranslationButton();
                            }
                        }, 5000);
                        
                        setTimeout(() => clearInterval(checkInterval), 30000);
                    }
                    
                    // 执行实际脚本
                    ${scriptContent}
                } catch(e) {
                    console.error('CheekyChimp: Script execution error', e);
                }
            })();
        `;
    }
} 