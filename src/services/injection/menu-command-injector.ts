import { logPrefix } from './utils';
import { UserScript } from '../../models/script';

// 菜单命令接口
export interface MenuCommand {
    id: string | number;
    name: string;
    callback: Function;
    accessKey?: string;
    scriptId: string;
    scriptName: string;
}

/**
 * 通用菜单命令注入器
 * 负责向网页注入菜单命令支持，实现类似油猴的GM_registerMenuCommand功能
 */
export class MenuCommandInjector {
    // 存储网站上正在运行的脚本的菜单命令
    private readonly commands: Map<string, MenuCommand[]> = new Map();
    // 注入的全局命令存储变量名
    private readonly COMMANDS_VARIABLE = '_gmMenuCommands';
    // 注入的全局助手对象名
    private readonly HELPER_VARIABLE = '_gmMenuHelper';
    // 菜单按钮ID
    private readonly MENU_BUTTON_ID = 'cheekychimp-menu-button';
    
    constructor() {
        console.log(`${logPrefix('MenuCommandInjector')}: 初始化完成`);
    }
    
    /**
     * 向网页注入菜单命令支持
     * @param script 用户脚本
     * @param webview WebView元素或iframe
     */
    public injectMenuCommandSupport(script: UserScript, webview: HTMLElement): void {
        try {
            const iframe = webview as HTMLIFrameElement;
            
            // 判断是否为iframe
            if (iframe.contentWindow && iframe.contentDocument) {
                this.injectIntoIframe(script, iframe);
            } else {
                console.warn(`${logPrefix('MenuCommandInjector')}: 不支持的元素类型，无法注入菜单命令支持`);
            }
        } catch (error) {
            console.error(`${logPrefix('MenuCommandInjector')}: 注入菜单命令支持失败:`, error);
        }
    }
    
    /**
     * 向iframe注入菜单命令支持
     * @param script 用户脚本
     * @param iframe iframe元素
     */
    private injectIntoIframe(script: UserScript, iframe: HTMLIFrameElement): void {
        try {
            // 确保iframe已加载
            if (!iframe.contentDocument || !iframe.contentWindow) {
                console.log(`${logPrefix('MenuCommandInjector')}: iframe尚未加载完成，无法注入菜单命令支持`);
                return;
            }
            
            // 创建注入脚本
            const injectScript = `
                (function() {
                    // 检查是否已存在菜单助手
                    if (window.${this.HELPER_VARIABLE}) {
                        console.log('[CheekyChimp] 菜单命令助手已存在，跳过注入');
                        return;
                    }
                    
                    // 创建全局命令存储
                    if (!window.${this.COMMANDS_VARIABLE}) {
                        window.${this.COMMANDS_VARIABLE} = [];
                    }
                    
                    // 创建菜单助手对象
                    window.${this.HELPER_VARIABLE} = {
                        scriptId: '${script.id}',
                        scriptName: '${script.name.replace(/'/g, "\\'")}',
                        menuButtonId: '${this.MENU_BUTTON_ID}',
                        initialized: false,
                        
                        /**
                         * 初始化菜单助手
                         */
                        initialize: function() {
                            if (this.initialized) return;
                            
                            try {
                                // 监听菜单按钮创建事件
                                document.addEventListener('cheekychimp-menu-button-created', this.setupMenuButton.bind(this));
                                
                                // 发送脚本信息到父窗口
                                window.parent.postMessage({
                                    type: 'cheekychimp-script-info',
                                    scriptId: this.scriptId,
                                    scriptName: this.scriptName
                                }, '*');
                                
                                this.initialized = true;
                                console.log('[CheekyChimp] 菜单命令助手初始化完成');
                            } catch (error) {
                                console.error('[CheekyChimp] 菜单命令助手初始化失败:', error);
                            }
                        },
                        
                        /**
                         * 注册菜单命令
                         */
                        registerMenuCommand: function(name, callback, accessKey) {
                            try {
                                // 生成唯一ID
                                const commandId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                                
                                // 创建命令对象
                                const command = {
                                    id: commandId,
                                    name: name,
                                    callback: callback,
                                    accessKey: accessKey,
                                    scriptId: this.scriptId,
                                    scriptName: this.scriptName
                                };
                                
                                // 添加到全局存储
                                if (window.${this.COMMANDS_VARIABLE} && Array.isArray(window.${this.COMMANDS_VARIABLE})) {
                                    window.${this.COMMANDS_VARIABLE}.push(command);
                                }
                                
                                // 通知父窗口有新命令
                                window.parent.postMessage({
                                    type: 'cheekychimp-register-menu-command',
                                    command: {
                                        id: commandId,
                                        name: name,
                                        accessKey: accessKey,
                                        scriptId: this.scriptId,
                                        scriptName: this.scriptName
                                    }
                                }, '*');
                                
                                console.log('[CheekyChimp] 已注册菜单命令:', name);
                                return commandId;
                            } catch (error) {
                                console.error('[CheekyChimp] 注册菜单命令失败:', error);
                                return -1;
                            }
                        },
                        
                        /**
                         * 设置菜单按钮
                         */
                        setupMenuButton: function(event) {
                            try {
                                const menuButtonId = event.detail?.buttonId || this.menuButtonId;
                                const button = document.getElementById(menuButtonId);
                                
                                if (button) {
                                    // 添加命令到按钮的数据属性
                                    button.dataset.scriptIds = button.dataset.scriptIds ? 
                                        button.dataset.scriptIds + ',' + this.scriptId : 
                                        this.scriptId;
                                    
                                    console.log('[CheekyChimp] 已将脚本 "' + this.scriptName + '" 添加到菜单按钮');
                                }
                            } catch (error) {
                                console.error('[CheekyChimp] 设置菜单按钮失败:', error);
                            }
                        },
                        
                        /**
                         * 执行菜单命令
                         */
                        executeCommand: function(commandId) {
                            try {
                                if (!window.${this.COMMANDS_VARIABLE}) return false;
                                
                                const command = window.${this.COMMANDS_VARIABLE}.find(cmd => cmd.id === commandId);
                                if (command && typeof command.callback === 'function') {
                                    console.log('[CheekyChimp] 执行菜单命令:', command.name);
                                    command.callback();
                                    return true;
                                }
                                return false;
                            } catch (error) {
                                console.error('[CheekyChimp] 执行菜单命令失败:', error);
                                return false;
                            }
                        }
                    };
                    
                    // 初始化菜单助手
                    window.${this.HELPER_VARIABLE}.initialize();
                    
                    // 添加GM API兼容性接口
                    if (typeof GM === 'undefined') {
                        window.GM = {};
                    }
                    
                    // 添加GM_registerMenuCommand函数
                    if (typeof GM.registerMenuCommand === 'undefined') {
                        GM.registerMenuCommand = function(name, callback, accessKey) {
                            return window.${this.HELPER_VARIABLE}.registerMenuCommand(name, callback, accessKey);
                        };
                    }
                    
                    if (typeof GM_registerMenuCommand === 'undefined') {
                        window.GM_registerMenuCommand = function(name, callback, accessKey) {
                            return window.${this.HELPER_VARIABLE}.registerMenuCommand(name, callback, accessKey);
                        };
                    }
                    
                    // 监听来自父窗口的命令执行消息
                    window.addEventListener('message', function(event) {
                        if (event.data && event.data.type === 'cheekychimp-execute-command') {
                            window.${this.HELPER_VARIABLE}.executeCommand(event.data.commandId);
                        }
                    });
                    
                    console.log('[CheekyChimp] 菜单命令支持已注入，脚本ID:', '${script.id}');
                })();
            `;
            
            // 创建脚本元素并注入
            const scriptElement = iframe.contentDocument.createElement('script');
            scriptElement.textContent = injectScript;
            iframe.contentDocument.head.appendChild(scriptElement);
            
            // 添加事件监听器，接收来自iframe的消息
            this.setupMessageListener(script, iframe);
            
            console.log(`${logPrefix('MenuCommandInjector')}: 已向iframe注入菜单命令支持，脚本: ${script.name}`);
        } catch (error) {
            console.error(`${logPrefix('MenuCommandInjector')}: 向iframe注入菜单命令支持失败:`, error);
        }
    }
    
    /**
     * 设置消息监听器
     * @param script 用户脚本
     * @param iframe iframe元素
     */
    private setupMessageListener(script: UserScript, iframe: HTMLIFrameElement): void {
        window.addEventListener('message', (event) => {
            try {
                // 确保消息来自预期的iframe
                if (event.source !== iframe.contentWindow) return;
                
                const data = event.data;
                if (!data || typeof data !== 'object') return;
                
                // 处理注册菜单命令消息
                if (data.type === 'cheekychimp-register-menu-command' && data.command) {
                    this.registerCommand(script, data.command);
                }
                
                // 处理脚本信息消息
                if (data.type === 'cheekychimp-script-info') {
                    console.log(`${logPrefix('MenuCommandInjector')}: 接收到脚本信息:`, data.scriptName);
                }
            } catch (error) {
                console.error(`${logPrefix('MenuCommandInjector')}: 处理iframe消息失败:`, error);
            }
        });
    }
    
    /**
     * 向webview发送执行命令消息
     * @param webview WebView元素或iframe
     * @param commandId 命令ID
     */
    public executeCommand(webview: HTMLElement, commandId: string | number): boolean {
        try {
            const iframe = webview as HTMLIFrameElement;
            
            // 判断是否为iframe
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'cheekychimp-execute-command',
                    commandId: commandId
                }, '*');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`${logPrefix('MenuCommandInjector')}: 发送执行命令消息失败:`, error);
            return false;
        }
    }
    
    /**
     * 注册命令
     * @param script 用户脚本
     * @param command 命令对象
     */
    private registerCommand(script: UserScript, command: any): void {
        try {
            if (!command.id || !command.name || !command.scriptId) {
                console.warn(`${logPrefix('MenuCommandInjector')}: 无效的命令对象:`, command);
                return;
            }
            
            // 查找脚本的命令列表
            if (!this.commands.has(script.id)) {
                this.commands.set(script.id, []);
            }
            
            // 添加命令
            const commands = this.commands.get(script.id);
            if (commands) {
                commands.push({
                    id: command.id,
                    name: command.name,
                    callback: () => {}, // 回调函数在iframe中，这里仅存储占位
                    accessKey: command.accessKey,
                    scriptId: command.scriptId,
                    scriptName: command.scriptName || script.name
                });
                
                console.log(`${logPrefix('MenuCommandInjector')}: 已注册菜单命令: "${command.name}" 来自脚本 "${script.name}"`);
                
                // 触发命令注册事件
                document.dispatchEvent(new CustomEvent('cheekychimp-command-registered', {
                    detail: {
                        command: command,
                        script: script
                    }
                }));
            }
        } catch (error) {
            console.error(`${logPrefix('MenuCommandInjector')}: 注册命令失败:`, error);
        }
    }
    
    /**
     * 获取脚本的所有命令
     * @param scriptId 脚本ID
     */
    public getCommands(scriptId: string): MenuCommand[] {
        return this.commands.get(scriptId) || [];
    }
    
    /**
     * 获取所有命令
     */
    public getAllCommands(): MenuCommand[] {
        const allCommands: MenuCommand[] = [];
        this.commands.forEach(commands => {
            allCommands.push(...commands);
        });
        return allCommands;
    }
    
    /**
     * 获取当前活跃的脚本ID列表
     */
    public getActiveScriptIds(): string[] {
        return Array.from(this.commands.keys());
    }
    
    /**
     * 清除脚本的命令
     * @param scriptId 脚本ID
     */
    public clearCommands(scriptId: string): void {
        this.commands.delete(scriptId);
    }
    
    /**
     * 清除所有命令
     */
    public clearAllCommands(): void {
        this.commands.clear();
    }
} 