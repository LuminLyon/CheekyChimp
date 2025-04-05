import { SiteAdapter } from './site-adapter-interface';
import { logPrefix } from '../utils';

/**
 * 通用网站适配器
 * 为所有网站提供基本的适配和增强功能
 */
export class GenericAdapter implements SiteAdapter {
    private static instance: GenericAdapter;
    
    /**
     * 获取单例实例
     */
    public static getInstance(): GenericAdapter {
        if (!GenericAdapter.instance) {
            GenericAdapter.instance = new GenericAdapter();
        }
        return GenericAdapter.instance;
    }
    
    /**
     * 检查URL是否匹配
     * 对于通用适配器，总是返回true，因为它是默认适配器
     * @param url 要检查的URL
     */
    public isMatch(url: string): boolean {
        return true; // 通用适配器匹配所有URL
    }
    
    /**
     * 设置网站支持
     * @param element iframe或webview元素
     */
    public setupSupport(element: HTMLElement): void {
        try {
            console.log(`${logPrefix('GenericAdapter')} 设置通用支持...`);
            
            if (element instanceof HTMLIFrameElement) {
                // 允许iframe全屏
                element.setAttribute('allowfullscreen', 'true');
                element.setAttribute('webkitallowfullscreen', 'true');
                element.setAttribute('mozallowfullscreen', 'true');
                
                // 注入通用样式
                this.injectStyles(element);
                
                // 增强iframe功能
                this.enhanceElement(element);
            }
            
            console.log(`${logPrefix('GenericAdapter')} 通用支持设置完成`);
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 设置通用支持失败:`, error);
        }
    }
    
    /**
     * 注入通用样式
     * @param element iframe或webview元素
     */
    public injectStyles(element: HTMLElement): void {
        try {
            if (!(element instanceof HTMLIFrameElement) || !element.contentDocument) {
                return;
            }
            
            const styles = `
                /* 通用脚本菜单按钮样式 */
                #cheekychimp-menu-button {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background-color: #4285f4;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    cursor: pointer;
                    z-index: 9999999;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                    border: none;
                    outline: none;
                }
                
                #cheekychimp-menu-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                }
                
                /* 通用脚本菜单容器样式 */
                #cheekychimp-menu-container {
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    min-width: 180px;
                    max-width: 300px;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 9999998;
                    display: none;
                    flex-direction: column;
                    max-height: 80vh;
                    overflow-y: auto;
                    padding: 8px 0;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    color: #333;
                }
                
                /* 菜单项样式 */
                .cheekychimp-menu-item {
                    padding: 8px 15px;
                    cursor: pointer;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    transition: background-color 0.2s ease;
                }
                
                .cheekychimp-menu-item:hover {
                    background-color: #f0f0f0;
                }
                
                /* 菜单标题样式 */
                .cheekychimp-menu-title {
                    padding: 8px 15px;
                    font-weight: bold;
                    color: #555;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                /* 菜单分隔线样式 */
                .cheekychimp-menu-separator {
                    height: 1px;
                    background-color: #e0e0e0;
                    margin: 4px 0;
                }
            `;
            
            const styleEl = element.contentDocument.createElement('style');
            styleEl.id = 'cheekychimp-generic-styles';
            styleEl.innerHTML = styles;
            element.contentDocument.head.appendChild(styleEl);
            
            console.log(`${logPrefix('GenericAdapter')} 注入通用样式完成`);
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 注入通用样式失败:`, error);
        }
    }
    
    /**
     * 增强元素功能
     * @param element iframe或webview元素
     */
    public enhanceElement(element: HTMLElement): void {
        try {
            if (element instanceof HTMLIFrameElement) {
                // 设置iframe属性
                element.style.border = 'none';
                
                // 注入通用助手
                this.injectGenericHelper(element);
                
                // 监听window消息
                this.setupMessageListener(element);
            }
            
            console.log(`${logPrefix('GenericAdapter')} 元素功能增强完成`);
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 增强元素功能失败:`, error);
        }
    }
    
    /**
     * 设置消息监听
     * @param element iframe或webview元素
     */
    private setupMessageListener(element: HTMLIFrameElement): void {
        try {
            // 监听来自iframe的消息
            window.addEventListener('message', (event) => {
                if (event.source === element.contentWindow && 
                    event.data && 
                    typeof event.data === 'object') {
                    
                    this.handleMessage(event.data, element);
                }
            });
            
            console.log(`${logPrefix('GenericAdapter')} 消息监听设置完成`);
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 设置消息监听失败:`, error);
        }
    }
    
    /**
     * 处理来自网站的消息
     * @param data 消息数据
     * @param element iframe或webview元素
     */
    public handleMessage(data: any, element: HTMLElement): void {
        try {
            // 处理通用消息
            if (data.type === 'cheekychimp-register-command') {
                console.log(`${logPrefix('GenericAdapter')} 接收到菜单命令注册请求:`, data.command);
                // 这里可以实现菜单命令的注册逻辑
            }
            
            // 处理全屏请求
            if (data.type === 'fullscreen' || data.action === 'requestFullscreen') {
                this.handleFullscreenRequest(element as HTMLIFrameElement);
            }
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 处理消息失败:`, error);
        }
    }
    
    /**
     * 处理全屏请求
     * @param iframe iframe元素
     */
    private handleFullscreenRequest(iframe: HTMLIFrameElement): void {
        try {
            // 检查是否支持全屏API
            if (iframe.requestFullscreen) {
                iframe.requestFullscreen();
            } else if ((iframe as any).webkitRequestFullscreen) {
                (iframe as any).webkitRequestFullscreen();
            } else if ((iframe as any).mozRequestFullScreen) {
                (iframe as any).mozRequestFullScreen();
            } else if ((iframe as any).msRequestFullscreen) {
                (iframe as any).msRequestFullscreen();
            } else {
                console.warn(`${logPrefix('GenericAdapter')} 此浏览器不支持全屏API`);
            }
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 请求全屏失败:`, error);
        }
    }
    
    /**
     * 注入通用脚本助手
     * @param iframe iframe元素
     */
    private injectGenericHelper(iframe: HTMLIFrameElement): void {
        try {
            if (!iframe.contentDocument || !iframe.contentWindow) {
                console.log(`${logPrefix('GenericAdapter')} iframe尚未加载完成，无法注入助手`);
                return;
            }
            
            // 创建注入脚本
            const helperScript = `
                (function() {
                    // 检查是否已存在助手
                    if (window.cheekyChimpHelper) {
                        console.log('[CheekyChimp] 通用助手已存在，跳过注入');
                        return;
                    }
                    
                    // 创建助手对象
                    window.cheekyChimpHelper = {
                        initialized: false,
                        menuButtonId: 'cheekychimp-menu-button',
                        menuContainerId: 'cheekychimp-menu-container',
                        menuCommands: [],
                        
                        initialize: function() {
                            if (this.initialized) return;
                            
                            try {
                                // 设置全局命令存储
                                this.setupGlobalCommandStorage();
                                
                                // 创建菜单UI
                                this.createMenuUI();
                                
                                this.initialized = true;
                                console.log('[CheekyChimp] 通用助手初始化完成');
                            } catch (error) {
                                console.error('[CheekyChimp] 通用助手初始化失败:', error);
                            }
                        },
                        
                        registerMenuCommand: function(name, callback, accessKey) {
                            try {
                                const commandId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                                
                                const command = {
                                    id: commandId,
                                    name: name,
                                    callback: callback,
                                    accessKey: accessKey
                                };
                                
                                // 添加到内部存储
                                this.menuCommands.push(command);
                                
                                // 添加到全局存储
                                if (window._gmMenuCommands && Array.isArray(window._gmMenuCommands)) {
                                    window._gmMenuCommands.push(command);
                                }
                                
                                console.log('[CheekyChimp] 已注册菜单命令: "' + name + '"');
                                return commandId;
                            } catch (error) {
                                console.error('[CheekyChimp] 注册菜单命令失败:', error);
                                return null;
                            }
                        },
                        
                        unregisterMenuCommand: function(commandId) {
                            try {
                                // 从内部存储中移除
                                this.menuCommands = this.menuCommands.filter(cmd => cmd.id !== commandId);
                                
                                // 从全局存储中移除
                                if (window._gmMenuCommands && Array.isArray(window._gmMenuCommands)) {
                                    window._gmMenuCommands = window._gmMenuCommands.filter(cmd => cmd.id !== commandId);
                                }
                                
                                console.log('[CheekyChimp] 已注销菜单命令: ' + commandId);
                                return true;
                            } catch (error) {
                                console.error('[CheekyChimp] 注销菜单命令失败:', error);
                                return false;
                            }
                        },
                        
                        createMenuUI: function() {
                            try {
                                // 移除现有的菜单元素（如果有）
                                const existingButton = document.getElementById(this.menuButtonId);
                                if (existingButton) existingButton.remove();
                                
                                const existingMenu = document.getElementById(this.menuContainerId);
                                if (existingMenu) existingMenu.remove();
                                
                                // 创建菜单按钮
                                const menuButton = document.createElement('div');
                                menuButton.id = this.menuButtonId;
                                menuButton.innerHTML = '🍯';  // 蜂蜜罐emoji代表油猴
                                menuButton.title = '用户脚本菜单';
                                menuButton.style.cssText = \`
                                    position: fixed;
                                    top: 20px;
                                    right: 20px;
                                    width: 32px;
                                    height: 32px;
                                    border-radius: 50%;
                                    background-color: #4285f4;
                                    color: white;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 16px;
                                    cursor: pointer;
                                    z-index: 9999999;
                                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                                    transition: all 0.3s ease;
                                    border: none;
                                    outline: none;
                                \`;
                                
                                // 创建菜单容器
                                const menuContainer = document.createElement('div');
                                menuContainer.id = this.menuContainerId;
                                menuContainer.style.cssText = \`
                                    position: fixed;
                                    top: 60px;
                                    right: 20px;
                                    min-width: 180px;
                                    max-width: 300px;
                                    background-color: white;
                                    border-radius: 8px;
                                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                                    z-index: 9999998;
                                    display: none;
                                    flex-direction: column;
                                    max-height: 80vh;
                                    overflow-y: auto;
                                    padding: 8px 0;
                                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                    font-size: 14px;
                                    color: #333;
                                \`;
                                
                                // 添加元素到页面
                                document.body.appendChild(menuButton);
                                document.body.appendChild(menuContainer);
                                
                                const self = this; // 保存this引用
                                
                                // 添加点击事件
                                menuButton.addEventListener('click', function() {
                                    const isVisible = menuContainer.style.display === 'flex';
                                    menuContainer.style.display = isVisible ? 'none' : 'flex';
                                    
                                    if (!isVisible) {
                                        // 清除旧菜单项
                                        menuContainer.innerHTML = '';
                                        
                                        // 添加菜单项
                                        console.log('[CheekyChimp] 添加菜单项: ' + self.menuCommands.length + ' 个命令');
                                        
                                        // 添加标题
                                        const titleDiv = document.createElement('div');
                                        titleDiv.className = 'cheekychimp-menu-title';
                                        titleDiv.textContent = '用户脚本命令';
                                        menuContainer.appendChild(titleDiv);
                                        
                                        if (self.menuCommands.length === 0) {
                                            const noCommands = document.createElement('div');
                                            noCommands.className = 'cheekychimp-menu-item';
                                            noCommands.style.color = '#999';
                                            noCommands.style.fontStyle = 'italic';
                                            noCommands.textContent = '没有可用的命令';
                                            menuContainer.appendChild(noCommands);
                                        } else {
                                            // 添加命令到菜单
                                            self.menuCommands.forEach(function(command) {
                                                const menuItem = document.createElement('div');
                                                menuItem.className = 'cheekychimp-menu-item';
                                                menuItem.textContent = command.name;
                                                
                                                // 添加快捷键提示（如果有）
                                                if (command.accessKey) {
                                                    const keySpan = document.createElement('span');
                                                    keySpan.style.float = 'right';
                                                    keySpan.style.opacity = '0.6';
                                                    keySpan.style.marginLeft = '8px';
                                                    keySpan.textContent = command.accessKey;
                                                    menuItem.appendChild(keySpan);
                                                }
                                                
                                                menuItem.addEventListener('click', function() {
                                                    menuContainer.style.display = 'none';
                                                    console.log('[CheekyChimp] 执行菜单命令: "' + command.name + '"');
                                                    
                                                    try {
                                                        command.callback();
                                                    } catch (error) {
                                                        console.error('[CheekyChimp] 执行命令失败:', error);
                                                    }
                                                });
                                                
                                                menuContainer.appendChild(menuItem);
                                            });
                                        }
                                    }
                                });
                                
                                // 添加点击外部关闭菜单
                                document.addEventListener('click', function(event) {
                                    if (!event.target) return;
                                    
                                    const target = event.target;
                                    if (
                                        target.id !== self.menuButtonId && 
                                        !target.closest('#' + self.menuButtonId) && 
                                        target.id !== self.menuContainerId && 
                                        !target.closest('#' + self.menuContainerId)
                                    ) {
                                        menuContainer.style.display = 'none';
                                    }
                                });
                                
                                console.log('[CheekyChimp] 菜单UI创建完成');
                            } catch (error) {
                                console.error('[CheekyChimp] 创建菜单UI失败:', error);
                            }
                        },
                        
                        setupGlobalCommandStorage: function() {
                            try {
                                // 在window对象上创建_gmMenuCommands数组用于存储命令
                                if (!window._gmMenuCommands) {
                                    window._gmMenuCommands = [];
                                }
                                
                                console.log('[CheekyChimp] 全局命令存储设置完成');
                            } catch (error) {
                                console.error('[CheekyChimp] 设置全局命令存储失败:', error);
                            }
                        }
                    };
                    
                    // 初始化助手
                    window.cheekyChimpHelper.initialize();
                    
                    // 添加GM API兼容性接口
                    if (typeof GM === 'undefined') {
                        window.GM = {};
                    }
                    
                    // 添加GM_registerMenuCommand函数
                    if (typeof GM.registerMenuCommand === 'undefined') {
                        GM.registerMenuCommand = function(name, callback, accessKey) {
                            return window.cheekyChimpHelper.registerMenuCommand(name, callback, accessKey);
                        };
                    }
                    
                    if (typeof GM_registerMenuCommand === 'undefined') {
                        window.GM_registerMenuCommand = function(name, callback, accessKey) {
                            return window.cheekyChimpHelper.registerMenuCommand(name, callback, accessKey);
                        };
                    }
                    
                    // 添加GM_unregisterMenuCommand函数
                    if (typeof GM.unregisterMenuCommand === 'undefined') {
                        GM.unregisterMenuCommand = function(commandId) {
                            return window.cheekyChimpHelper.unregisterMenuCommand(commandId);
                        };
                    }
                    
                    if (typeof GM_unregisterMenuCommand === 'undefined') {
                        window.GM_unregisterMenuCommand = function(commandId) {
                            return window.cheekyChimpHelper.unregisterMenuCommand(commandId);
                        };
                    }
                    
                    console.log('[CheekyChimp] 通用助手和GM API兼容层注入完成');
                })();
            `;
            
            // 创建脚本元素并注入
            const scriptElement = iframe.contentDocument.createElement('script');
            scriptElement.id = 'cheekychimp-helper-script';
            scriptElement.textContent = helperScript;
            iframe.contentDocument.head.appendChild(scriptElement);
            
            console.log(`${logPrefix('GenericAdapter')} 通用助手注入成功`);
        } catch (error) {
            console.error(`${logPrefix('GenericAdapter')} 注入通用助手失败:`, error);
        }
    }
} 