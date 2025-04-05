import { logPrefix } from './utils';
import { MenuCommand } from './menu-command-injector';

/**
 * 脚本菜单UI
 * 在网页中显示类似油猴的脚本菜单界面
 */
export class ScriptMenuUI {
    // 菜单按钮ID
    private readonly MENU_BUTTON_ID = 'cheekychimp-menu-button';
    // 菜单容器ID
    private readonly MENU_CONTAINER_ID = 'cheekychimp-menu-container';
    // 菜单图标样式
    private readonly BUTTON_ICON = '🐵'; // 猴子表情符号
    
    // 初始化状态
    private initialized = false;
    
    // 菜单按钮元素
    private menuButton: HTMLElement | null = null;
    // 菜单容器元素
    private menuContainer: HTMLElement | null = null;
    
    // 脚本命令回调函数
    private onExecuteCommand: ((commandId: string | number) => void) | null = null;
    
    constructor() {
        console.log(`${logPrefix('ScriptMenuUI')}: 初始化`);
    }
    
    /**
     * 初始化菜单UI
     * @param onExecuteCommand 执行命令回调
     */
    public initialize(onExecuteCommand?: (commandId: string | number) => void): void {
        if (this.initialized) return;
        
        try {
            this.onExecuteCommand = onExecuteCommand || null;
            
            // 创建菜单按钮
            this.createMenuButton();
            
            // 创建菜单容器
            this.createMenuContainer();
            
            // 设置事件监听
            this.setupEventListeners();
            
            this.initialized = true;
            console.log(`${logPrefix('ScriptMenuUI')}: 初始化完成`);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 初始化失败:`, error);
        }
    }
    
    /**
     * 注入菜单UI到iframe
     * @param iframe iframe元素
     */
    public injectIntoIframe(iframe: HTMLIFrameElement): void {
        try {
            // 确保iframe已加载
            if (!iframe.contentDocument || !iframe.contentWindow) {
                console.log(`${logPrefix('ScriptMenuUI')}: iframe尚未加载完成，无法注入菜单UI`);
                return;
            }
            
            // 注入样式
            this.injectStyles(iframe);
            
            // 创建脚本菜单
            const injectScript = `
                (function() {
                    // 创建菜单按钮
                    function createMenuButton() {
                        // 先移除可能存在的旧按钮
                        const existingButton = document.getElementById('${this.MENU_BUTTON_ID}');
                        if (existingButton) existingButton.remove();
                        
                        // 创建新按钮
                        const button = document.createElement('div');
                        button.id = '${this.MENU_BUTTON_ID}';
                        button.innerHTML = '${this.BUTTON_ICON}';
                        button.title = 'CheekyChimp脚本菜单';
                        button.classList.add('cheekychimp-menu-button');
                        
                        // 添加到页面
                        document.body.appendChild(button);
                        
                        // 发送按钮创建事件
                        document.dispatchEvent(new CustomEvent('cheekychimp-menu-button-created', {
                            detail: { buttonId: '${this.MENU_BUTTON_ID}' }
                        }));
                        
                        return button;
                    }
                    
                    // 创建菜单容器
                    function createMenuContainer() {
                        // 先移除可能存在的旧容器
                        const existingContainer = document.getElementById('${this.MENU_CONTAINER_ID}');
                        if (existingContainer) existingContainer.remove();
                        
                        // 创建新容器
                        const container = document.createElement('div');
                        container.id = '${this.MENU_CONTAINER_ID}';
                        container.classList.add('cheekychimp-menu-container');
                        
                        // 添加到页面
                        document.body.appendChild(container);
                        
                        return container;
                    }
                    
                    // 等待DOM加载完成
                    function onDomReady(callback) {
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', callback);
                        } else {
                            callback();
                        }
                    }
                    
                    // 初始化菜单UI
                    onDomReady(function() {
                        // 确保body已经存在
                        if (!document.body) {
                            console.log('[CheekyChimp] 页面body尚未加载，无法创建菜单');
                            return;
                        }
                        
                        // 创建菜单按钮和容器
                        const button = createMenuButton();
                        const container = createMenuContainer();
                        
                        // 添加点击事件
                        button.addEventListener('click', function(event) {
                            event.stopPropagation();
                            
                            // 通知父窗口打开菜单
                            window.parent.postMessage({
                                type: 'cheekychimp-menu-clicked',
                                position: {
                                    top: button.getBoundingClientRect().bottom,
                                    left: button.getBoundingClientRect().left,
                                    right: button.getBoundingClientRect().right
                                }
                            }, '*');
                        });
                        
                        console.log('[CheekyChimp] 菜单UI已注入');
                    });
                })();
            `;
            
            // 创建脚本元素并注入
            const scriptElement = iframe.contentDocument.createElement('script');
            scriptElement.textContent = injectScript;
            iframe.contentDocument.head.appendChild(scriptElement);
            
            console.log(`${logPrefix('ScriptMenuUI')}: 菜单UI已注入到iframe`);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 注入菜单UI到iframe失败:`, error);
        }
    }
    
    /**
     * 注入样式到iframe
     * @param iframe iframe元素
     */
    private injectStyles(iframe: HTMLIFrameElement): void {
        try {
            if (!iframe.contentDocument) return;
            
            const styleElement = iframe.contentDocument.createElement('style');
            styleElement.textContent = `
                /* 菜单按钮样式 */
                .cheekychimp-menu-button {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 36px;
                    height: 36px;
                    background-color: #3498db;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    cursor: pointer;
                    z-index: 9999;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    user-select: none;
                    transition: all 0.3s ease;
                }
                
                .cheekychimp-menu-button:hover {
                    transform: scale(1.1);
                    background-color: #2980b9;
                }
                
                /* 菜单容器样式 */
                .cheekychimp-menu-container {
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    min-width: 200px;
                    max-width: 300px;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    z-index: 9998;
                    display: none;
                    flex-direction: column;
                    max-height: 80vh;
                    overflow-y: auto;
                    padding: 5px 0;
                }
                
                /* 菜单项样式 */
                .cheekychimp-menu-item {
                    padding: 8px 15px;
                    cursor: pointer;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    transition: background-color 0.2s;
                }
                
                .cheekychimp-menu-item:hover {
                    background-color: #f0f0f0;
                }
                
                /* 菜单标题样式 */
                .cheekychimp-menu-title {
                    padding: 5px 15px;
                    font-weight: bold;
                    color: #666;
                    background: #f5f5f5;
                    border-bottom: 1px solid #eee;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* 分隔线样式 */
                .cheekychimp-menu-divider {
                    height: 1px;
                    background-color: #eee;
                    margin: 5px 0;
                }
            `;
            
            iframe.contentDocument.head.appendChild(styleElement);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 注入样式到iframe失败:`, error);
        }
    }
    
    /**
     * 创建菜单按钮
     */
    private createMenuButton(): void {
        try {
            // 先移除可能存在的旧按钮
            const existingButton = document.getElementById(this.MENU_BUTTON_ID);
            if (existingButton) existingButton.remove();
            
            // 创建新按钮
            this.menuButton = document.createElement('div');
            this.menuButton.id = this.MENU_BUTTON_ID;
            this.menuButton.innerHTML = this.BUTTON_ICON;
            this.menuButton.title = 'CheekyChimp脚本菜单';
            this.menuButton.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 36px;
                height: 36px;
                background-color: #3498db;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                user-select: none;
                transition: all 0.3s ease;
            `;
            
            // 添加到页面
            document.body.appendChild(this.menuButton);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 创建菜单按钮失败:`, error);
        }
    }
    
    /**
     * 创建菜单容器
     */
    private createMenuContainer(): void {
        try {
            // 先移除可能存在的旧容器
            const existingContainer = document.getElementById(this.MENU_CONTAINER_ID);
            if (existingContainer) existingContainer.remove();
            
            // 创建新容器
            this.menuContainer = document.createElement('div');
            this.menuContainer.id = this.MENU_CONTAINER_ID;
            this.menuContainer.style.cssText = `
                position: fixed;
                top: 60px;
                right: 20px;
                min-width: 200px;
                max-width: 300px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                z-index: 9998;
                display: none;
                flex-direction: column;
                max-height: 80vh;
                overflow-y: auto;
                padding: 5px 0;
            `;
            
            // 添加到页面
            document.body.appendChild(this.menuContainer);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 创建菜单容器失败:`, error);
        }
    }
    
    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        // 确保按钮和容器已创建
        if (!this.menuButton || !this.menuContainer) return;
        
        // 点击按钮显示/隐藏菜单
        this.menuButton.addEventListener('click', () => {
            if (this.menuContainer) {
                const isVisible = this.menuContainer.style.display === 'flex';
                this.menuContainer.style.display = isVisible ? 'none' : 'flex';
            }
        });
        
        // 点击外部关闭菜单
        document.addEventListener('click', (event) => {
            if (
                this.menuButton && 
                this.menuContainer && 
                event.target !== this.menuButton && 
                !this.menuButton.contains(event.target as Node) && 
                event.target !== this.menuContainer && 
                !this.menuContainer.contains(event.target as Node)
            ) {
                this.menuContainer.style.display = 'none';
            }
        });
    }
    
    /**
     * 更新菜单内容
     * @param commands 命令列表
     */
    public updateMenu(commands: MenuCommand[]): void {
        try {
            if (!this.menuContainer) return;
            
            // 清空菜单
            this.menuContainer.innerHTML = '';
            
            // 显示命令数量
            const totalScripts = new Set(commands.map(cmd => cmd.scriptId)).size;
            console.log(`${logPrefix('ScriptMenuUI')}: 更新菜单，共${commands.length}个命令，来自${totalScripts}个脚本`);
            
            if (commands.length === 0) {
                // 添加无命令提示
                const noCommands = document.createElement('div');
                noCommands.style.cssText = 'padding: 12px 15px; color: #999; text-align: center;';
                noCommands.textContent = '没有可用的命令';
                this.menuContainer.appendChild(noCommands);
                return;
            }
            
            // 添加CheekyChimp标题
            const title = document.createElement('div');
            title.style.cssText = `
                padding: 10px 15px;
                font-weight: bold;
                color: #333;
                background: #f8f8f8;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
                justify-content: space-between;
            `;
            title.innerHTML = `<span style="display:flex;align-items:center;">${this.BUTTON_ICON} <span style="margin-left:5px;">CheekyChimp</span></span>`;
            
            // 添加版本信息
            const version = document.createElement('span');
            version.style.cssText = 'font-size: 11px; color: #999; font-weight: normal;';
            version.textContent = 'v1.0';
            title.appendChild(version);
            
            this.menuContainer.appendChild(title);
            
            // 按脚本分组
            const scriptGroups = new Map<string, MenuCommand[]>();
            
            // 分组命令
            commands.forEach(command => {
                if (!scriptGroups.has(command.scriptId)) {
                    scriptGroups.set(command.scriptId, []);
                }
                scriptGroups.get(command.scriptId)?.push(command);
            });
            
            // 按脚本名称排序
            const sortedScriptIds = [...scriptGroups.keys()].sort((a, b) => {
                const scriptA = scriptGroups.get(a);
                const scriptB = scriptGroups.get(b);
                if (!scriptA || !scriptB) return 0;
                return (scriptA[0].scriptName || '').localeCompare(scriptB[0].scriptName || '');
            });
            
            // 添加分组的命令
            sortedScriptIds.forEach((scriptId, index) => {
                const scriptCommands = scriptGroups.get(scriptId) || [];
                if (scriptCommands.length === 0) return;
                
                // 添加分隔线（第一个除外）
                if (index > 0) {
                    const divider = document.createElement('div');
                    divider.style.cssText = 'height: 1px; background-color: #eee; margin: 5px 0;';
                    this.menuContainer?.appendChild(divider);
                }
                
                // 添加脚本名称
                const scriptName = scriptCommands[0].scriptName || '未知脚本';
                const scriptHeader = document.createElement('div');
                scriptHeader.style.cssText = `
                    padding: 5px 15px;
                    font-weight: bold;
                    color: #666;
                    background: #f5f5f5;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                scriptHeader.textContent = `📜 ${scriptName}`;
                scriptHeader.title = scriptName;
                this.menuContainer?.appendChild(scriptHeader);
                
                // 添加脚本的命令
                scriptCommands.forEach(command => {
                    const menuItem = document.createElement('div');
                    menuItem.style.cssText = `
                        padding: 8px 15px 8px 25px;
                        cursor: pointer;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        transition: background-color 0.2s;
                    `;
                    menuItem.textContent = command.name;
                    menuItem.title = command.name;
                    menuItem.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = '#f0f0f0';
                    });
                    menuItem.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = 'transparent';
                    });
                    menuItem.addEventListener('click', () => {
                        // 隐藏菜单
                        if (this.menuContainer) {
                            this.menuContainer.style.display = 'none';
                        }
                        
                        // 执行命令
                        this.executeCommand(command.id);
                    });
                    
                    this.menuContainer?.appendChild(menuItem);
                });
            });
            
            // 添加底部分隔线
            const bottomDivider = document.createElement('div');
            bottomDivider.style.cssText = 'height: 1px; background-color: #eee; margin: 5px 0;';
            this.menuContainer?.appendChild(bottomDivider);
            
            // 添加底部链接
            const footer = document.createElement('div');
            footer.style.cssText = `
                padding: 8px 15px;
                color: #999;
                font-size: 12px;
                text-align: center;
                cursor: pointer;
            `;
            footer.textContent = '管理用户脚本';
            footer.addEventListener('click', () => {
                // 发送打开管理界面事件
                document.dispatchEvent(new CustomEvent('cheekychimp-open-options'));
                
                // 隐藏菜单
                if (this.menuContainer) {
                    this.menuContainer.style.display = 'none';
                }
            });
            
            this.menuContainer?.appendChild(footer);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 更新菜单内容失败:`, error);
        }
    }
    
    /**
     * 执行命令
     * @param commandId 命令ID
     */
    private executeCommand(commandId: string | number): void {
        try {
            if (this.onExecuteCommand) {
                this.onExecuteCommand(commandId);
            }
            
            console.log(`${logPrefix('ScriptMenuUI')}: 执行命令: ${commandId}`);
        } catch (error) {
            console.error(`${logPrefix('ScriptMenuUI')}: 执行命令失败:`, error);
        }
    }
    
    /**
     * 显示菜单
     */
    public showMenu(): void {
        if (this.menuContainer) {
            this.menuContainer.style.display = 'flex';
        }
    }
    
    /**
     * 隐藏菜单
     */
    public hideMenu(): void {
        if (this.menuContainer) {
            this.menuContainer.style.display = 'none';
        }
    }
    
    /**
     * 菜单是否可见
     */
    public isMenuVisible(): boolean {
        return this.menuContainer ? this.menuContainer.style.display === 'flex' : false;
    }
    
    /**
     * 检查菜单UI是否已初始化
     */
    public isInitialized(): boolean {
        return this.initialized;
    }
    
    /**
     * 切换菜单显示状态
     */
    public toggleMenu(): void {
        if (this.isMenuVisible()) {
            this.hideMenu();
        } else {
            this.showMenu();
        }
    }
} 