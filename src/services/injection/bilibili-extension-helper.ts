import { logPrefix } from './utils';

/**
 * Bilibili网站扩展助手，为油猴脚本提供特定的Bilibili网站支持
 * 包括菜单命令、视频控制、弹幕互动等功能
 */
export class BilibiliExtensionHelper {
    private initialized = false;
    private readonly MENU_BUTTON_ID = 'cheekychimp-menu-button';
    private readonly MENU_CONTAINER_ID = 'cheekychimp-menu-container';
    
    // 存储菜单命令
    private menuCommands: Array<{
        id: string | number;
        name: string;
        callback: Function;
        scriptName?: string;
        scriptId?: string;
    }> = [];
    
    constructor() {
        console.log(`${logPrefix('BilibiliExtensionHelper')}: 初始化`);
    }
    
    /**
     * 初始化助手
     */
    public initialize(): void {
        if (this.initialized) return;
        
        try {
            // 在全局对象中创建命令存储
            this.setupGlobalCommandStorage();
            
            // 创建菜单UI
            this.createMenuUI();
            
            // 添加事件监听
            this.setupEventListeners();
            
            this.initialized = true;
            console.log(`${logPrefix('BilibiliExtensionHelper')}: 初始化完成`);
        } catch (error) {
            console.error(`${logPrefix('BilibiliExtensionHelper')}: 初始化失败:`, error);
        }
    }
    
    /**
     * 注册菜单命令
     */
    public registerMenuCommand(name: string, callback: Function, scriptId?: string, scriptName?: string): number {
        try {
            const commandId = this.menuCommands.length + 1;
            
            const command = {
                id: commandId,
                name,
                callback,
                scriptId,
                scriptName
            };
            
            // 添加到内部存储
            this.menuCommands.push(command);
            
            // 添加到全局存储
            if (window._gmMenuCommands && Array.isArray(window._gmMenuCommands)) {
                window._gmMenuCommands.push({
                    id: commandId,
                    name,
                    callback
                });
            }
            
            // 更新菜单UI
            this.updateMenuUI();
            
            // 触发事件，通知命令已添加
            this.triggerCommandEvent('cheekychimp-command-registered', {
                commandId,
                name,
                callback,
                scriptId,
                scriptName
            });
            
            console.log(`${logPrefix('BilibiliExtensionHelper')}: 已注册菜单命令 "${name}"`);
            return commandId;
        } catch (error) {
            console.error(`${logPrefix('BilibiliExtensionHelper')}: 注册菜单命令失败:`, error);
            return -1;
        }
    }
    
    /**
     * 创建菜单UI
     */
    private createMenuUI(): void {
        try {
            // 移除现有的菜单元素（如果有）
            const existingButton = document.getElementById(this.MENU_BUTTON_ID);
            if (existingButton) existingButton.remove();
            
            const existingMenu = document.getElementById(this.MENU_CONTAINER_ID);
            if (existingMenu) existingMenu.remove();
            
            // 创建菜单按钮
            const menuButton = document.createElement('div');
            menuButton.id = this.MENU_BUTTON_ID;
            menuButton.innerHTML = '🍯';  // 蜂蜜罐emoji代表油猴
            menuButton.title = '油猴脚本菜单';
            menuButton.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: #fb7299;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
            `;
            
            // 创建菜单容器
            const menuContainer = document.createElement('div');
            menuContainer.id = this.MENU_CONTAINER_ID;
            menuContainer.style.cssText = `
                position: fixed;
                top: 125px;
                right: 20px;
                min-width: 180px;
                max-width: 250px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 9998;
                display: none;
                flex-direction: column;
                max-height: 70vh;
                overflow-y: auto;
                padding: 8px 0;
            `;
            
            // 添加元素到页面
            document.body.appendChild(menuButton);
            document.body.appendChild(menuContainer);
            
            // 添加点击事件
            menuButton.addEventListener('click', () => {
                const isVisible = menuContainer.style.display === 'flex';
                menuContainer.style.display = isVisible ? 'none' : 'flex';
                
                if (!isVisible) {
                    // 清除旧菜单项
                    menuContainer.innerHTML = '';
                    
                    // 添加菜单项
                    console.log(`${logPrefix('BilibiliExtensionHelper')}: 添加菜单项: ${this.menuCommands.length} 个命令`);
                    
                    if (this.menuCommands.length === 0) {
                        const noCommands = document.createElement('div');
                        noCommands.style.cssText = 'padding:8px 15px;color:#999;text-align:center;';
                        noCommands.textContent = '没有可用的命令';
                        menuContainer.appendChild(noCommands);
                    } else {
                        // 按脚本分组
                        const scriptGroups = new Map<string, Array<{
                            id: string | number;
                            name: string;
                            callback: Function;
                            scriptName?: string;
                            scriptId?: string;
                        }>>();
                        
                        this.menuCommands.forEach(command => {
                            const scriptId = command.scriptId || 'unknown';
                            if (!scriptGroups.has(scriptId)) {
                                scriptGroups.set(scriptId, []);
                            }
                            scriptGroups.get(scriptId)?.push(command);
                        });
                        
                        // 添加分组的菜单项
                        scriptGroups.forEach((commands, scriptId) => {
                            // 如果有脚本名称，添加脚本标题
                            const firstCommand = commands[0];
                            const scriptName = firstCommand && firstCommand.scriptName;
                            
                            if (scriptName) {
                                const scriptHeader = document.createElement('div');
                                scriptHeader.style.cssText = 'padding:5px 15px;font-weight:bold;color:#666;background:#f5f5f5;';
                                scriptHeader.textContent = scriptName;
                                menuContainer.appendChild(scriptHeader);
                            }
                            
                            // 添加脚本下的命令
                            commands.forEach(command => {
                                const menuItem = document.createElement('div');
                                menuItem.className = 'gm-menu-item';
                                menuItem.textContent = command.name;
                                menuItem.style.cssText = 'padding:8px 15px;cursor:pointer;white-space:nowrap;';
                                menuItem.addEventListener('click', () => {
                                    menuContainer.style.display = 'none';
                                    console.log(`${logPrefix('BilibiliExtensionHelper')}: 执行菜单命令: "${command.name}"`);
                                    command.callback();
                                });
                                menuItem.addEventListener('mouseenter', function() {
                                    this.style.backgroundColor = '#f0f0f0';
                                });
                                menuItem.addEventListener('mouseleave', function() {
                                    this.style.backgroundColor = 'transparent';
                                });
                                menuContainer.appendChild(menuItem);
                            });
                        });
                    }
                }
            });
            
            // 添加点击外部关闭菜单
            document.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                if (
                    target.id !== this.MENU_BUTTON_ID && 
                    !target.closest(`#${this.MENU_BUTTON_ID}`) && 
                    target.id !== this.MENU_CONTAINER_ID && 
                    !target.closest(`#${this.MENU_CONTAINER_ID}`)
                ) {
                    menuContainer.style.display = 'none';
                }
            });
            
            console.log(`${logPrefix('BilibiliExtensionHelper')}: 菜单UI创建完成`);
        } catch (error) {
            console.error(`${logPrefix('BilibiliExtensionHelper')}: 创建菜单UI失败:`, error);
        }
    }
    
    /**
     * 更新菜单UI
     */
    private updateMenuUI(): void {
        // 在下次打开菜单时会自动更新，无需额外操作
    }
    
    /**
     * 设置全局命令存储
     */
    private setupGlobalCommandStorage(): void {
        try {
            // 在window对象上创建_gmMenuCommands数组用于存储命令
            if (!window._gmMenuCommands) {
                window._gmMenuCommands = [];
                
                // 类型定义声明
                const script = document.createElement('script');
                script.textContent = `
                    // 为window对象声明_gmMenuCommands属性
                    if (!window._gmMenuCommands) {
                        window._gmMenuCommands = [];
                    }
                `;
                document.head.appendChild(script);
                script.remove();
            }
            
            console.log(`${logPrefix('BilibiliExtensionHelper')}: 全局命令存储设置完成`);
        } catch (error) {
            console.error(`${logPrefix('BilibiliExtensionHelper')}: 设置全局命令存储失败:`, error);
        }
    }
    
    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 可以添加特定于Bilibili的事件监听
    }
    
    /**
     * 触发命令事件
     */
    private triggerCommandEvent(eventName: string, detail: any): void {
        try {
            const event = new CustomEvent(eventName, { detail });
            document.dispatchEvent(event);
        } catch (error) {
            console.error(`${logPrefix('BilibiliExtensionHelper')}: 触发事件失败:`, error);
        }
    }
} 