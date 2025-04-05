import { UserScript } from '../../models/script';
import { logPrefix } from './utils';
import { Notice } from 'obsidian';

export interface MenuCommand {
    id: string | number;
    name: string;
    callback: Function;
    accessKey?: string;
    scriptId: string;
    scriptName: string;
}

/**
 * 管理用户脚本的菜单命令
 * 参考Tampermonkey实现方式，提供更完善的菜单命令管理
 */
export class MenuCommandManager {
    // 内存中存储的命令
    private commands: MenuCommand[] = [];
    // 命令存储前缀
    private readonly STORAGE_PREFIX = 'cheekychimp_menu_command:';
    // 全局命令对象属性名
    private readonly GLOBAL_COMMAND_PROPERTY = '_cheekyChimpCommands';
    
    constructor() {
        // 初始化时加载所有保存的命令
        this.loadAllCommands();
        
        // 设置事件监听器，用于接收命令注册事件
        this.setupCommandEventListeners();
        
        console.log(`${logPrefix('MenuCommandManager')}: 初始化完成，已加载 ${this.commands.length} 个命令`);
    }
    
    /**
     * 为用户脚本注册菜单命令
     */
    public registerMenuCommand(script: UserScript, name: string, callback: Function, accessKey?: string): string | number {
        try {
            // 生成命令ID
            const commandId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            
            // 创建命令对象
            const command: MenuCommand = {
                id: commandId,
                name,
                callback,
                accessKey,
                scriptId: script.id,
                scriptName: script.name
            };
            
            // 添加到内存中
            this.commands.push(command);
            
            // 保存到本地存储
            this.saveCommand(command);
            
            // 设置事件监听器
            this.setupCommandEventListener(command);
            
            // 尝试添加到全局对象，方便在页面上下文中访问
            this.addToGlobalObject(command);
            
            console.log(`${logPrefix('MenuCommandManager')}: 已注册命令 "${name}" 来自脚本 "${script.name}"`);
            return commandId;
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 注册命令 "${name}" 失败:`, error);
            return -1;
        }
    }
    
    /**
     * 注销菜单命令
     */
    public unregisterMenuCommand(scriptId: string, commandId: string | number): boolean {
        try {
            // 从内存中删除
            const index = this.commands.findIndex(cmd => cmd.scriptId === scriptId && cmd.id === commandId);
            if (index >= 0) {
                const command = this.commands[index];
                this.commands.splice(index, 1);
                
                // 从存储中删除
                localStorage.removeItem(this.getStorageKey(command));
                
                // 移除事件监听器
                document.removeEventListener(`cheekychimp-command-${commandId}`, (event: any) => {});
                
                // 从全局对象中移除
                this.removeFromGlobalObject(command);
                
                console.log(`${logPrefix('MenuCommandManager')}: 已注销命令 ID: ${commandId}`);
                return true;
            }
            
            console.warn(`${logPrefix('MenuCommandManager')}: 未找到要注销的命令 ID: ${commandId}`);
            return false;
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 注销命令 ID: ${commandId} 失败:`, error);
            return false;
        }
    }
    
    /**
     * 注销脚本的所有命令
     */
    public unregisterAllMenuCommands(scriptId: string): boolean {
        try {
            // 找出所有属于该脚本的命令
            const commands = this.commands.filter(cmd => cmd.scriptId === scriptId);
            
            // 逐个注销
            for (const command of commands) {
                this.unregisterMenuCommand(scriptId, command.id);
            }
            
            console.log(`${logPrefix('MenuCommandManager')}: 已注销脚本 ID: ${scriptId} 的所有命令`);
            return true;
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 注销脚本 ID: ${scriptId} 的所有命令失败:`, error);
            return false;
        }
    }
    
    /**
     * 获取脚本的所有命令
     */
    public getScriptCommands(scriptId: string): MenuCommand[] {
        return this.commands.filter(cmd => cmd.scriptId === scriptId);
    }
    
    /**
     * 获取所有命令
     */
    public getAllCommands(): MenuCommand[] {
        return [...this.commands];
    }
    
    /**
     * 执行命令
     */
    public executeCommand(commandId: string | number): boolean {
        try {
            const command = this.commands.find(cmd => cmd.id === commandId);
            if (command) {
                command.callback();
                new Notice(`已执行命令: ${command.name}`);
                return true;
            }
            
            console.warn(`${logPrefix('MenuCommandManager')}: 未找到要执行的命令 ID: ${commandId}`);
            return false;
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 执行命令 ID: ${commandId} 失败:`, error);
            return false;
        }
    }
    
    /**
     * 加载所有保存的命令
     */
    private loadAllCommands(): void {
        try {
            this.commands = [];
            
            // 从localStorage加载
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.STORAGE_PREFIX)) {
                    try {
                        const commandStr = localStorage.getItem(key);
                        if (commandStr) {
                            const command = JSON.parse(commandStr) as MenuCommand;
                            // 由于函数无法序列化，回调函数需要通过事件系统处理
                            this.commands.push(command);
                        }
                    } catch (e) {
                        console.warn(`${logPrefix('MenuCommandManager')}: 加载命令失败:`, e);
                    }
                }
            }
            
            // 尝试从全局对象加载，整合不同来源的命令
            this.loadFromGlobalObject();
            
            console.log(`${logPrefix('MenuCommandManager')}: 已加载 ${this.commands.length} 个保存的命令`);
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 加载命令失败:`, error);
        }
    }
    
    /**
     * 保存命令到本地存储
     */
    private saveCommand(command: MenuCommand): void {
        try {
            const commandCopy = { ...command };
            // 移除函数属性，无法序列化
            delete (commandCopy as any).callback;
            
            localStorage.setItem(this.getStorageKey(command), JSON.stringify(commandCopy));
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 保存命令失败:`, error);
        }
    }
    
    /**
     * 获取命令的存储键
     */
    private getStorageKey(command: MenuCommand): string {
        return `${this.STORAGE_PREFIX}${command.scriptId}:${command.id}`;
    }
    
    /**
     * 设置命令事件监听器
     */
    private setupCommandEventListener(command: MenuCommand): void {
        // 创建唯一的事件名称
        const eventName = `cheekychimp-command-${command.id}`;
        
        // 移除可能存在的旧监听器
        document.removeEventListener(eventName, (event: any) => {});
        
        // 添加新的监听器
        document.addEventListener(eventName, (event: any) => {
            try {
                console.log(`${logPrefix('MenuCommandManager')}: 执行命令 "${command.name}"`);
                command.callback();
            } catch (error) {
                console.error(`${logPrefix('MenuCommandManager')}: 执行命令 "${command.name}" 失败:`, error);
            }
        });
    }
    
    /**
     * 设置命令注册/执行的事件监听器
     */
    private setupCommandEventListeners(): void {
        // 监听命令注册事件
        document.addEventListener('cheekychimp-command-registered', (event: any) => {
            try {
                const detail = event.detail;
                if (detail && detail.scriptId && detail.commandId && detail.name && detail.callback) {
                    const command: MenuCommand = {
                        id: detail.commandId,
                        name: detail.name,
                        callback: detail.callback,
                        accessKey: detail.accessKey,
                        scriptId: detail.scriptId,
                        scriptName: detail.scriptName || 'Unknown Script'
                    };
                    
                    // 添加到内存中
                    const exists = this.commands.some(cmd => 
                        cmd.scriptId === command.scriptId && cmd.id === command.id
                    );
                    
                    if (!exists) {
                        this.commands.push(command);
                        this.saveCommand(command);
                        this.setupCommandEventListener(command);
                    }
                }
            } catch (error) {
                console.error(`${logPrefix('MenuCommandManager')}: 处理命令注册事件失败:`, error);
            }
        });
    }
    
    /**
     * 从全局对象加载命令
     */
    private loadFromGlobalObject(): void {
        try {
            // 尝试获取全局命令对象
            const globalCommands = (window as any)[this.GLOBAL_COMMAND_PROPERTY];
            if (!globalCommands) return;
            
            // 遍历所有脚本的命令
            for (const scriptId in globalCommands) {
                const commands = globalCommands[scriptId];
                if (Array.isArray(commands)) {
                    for (const cmd of commands) {
                        if (cmd && cmd.id && cmd.name && typeof cmd.callback === 'function') {
                            // 检查是否已存在相同命令
                            const exists = this.commands.some(existingCmd => 
                                existingCmd.scriptId === scriptId && existingCmd.id === cmd.id
                            );
                            
                            if (!exists) {
                                const command: MenuCommand = {
                                    id: cmd.id,
                                    name: cmd.name,
                                    callback: cmd.callback,
                                    accessKey: cmd.accessKey,
                                    scriptId: scriptId,
                                    scriptName: 'From Global Object'
                                };
                                
                                this.commands.push(command);
                                this.setupCommandEventListener(command);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 从全局对象加载命令失败:`, error);
        }
    }
    
    /**
     * 添加命令到全局对象
     */
    private addToGlobalObject(command: MenuCommand): void {
        try {
            // 确保全局对象存在
            if (!(window as any)[this.GLOBAL_COMMAND_PROPERTY]) {
                (window as any)[this.GLOBAL_COMMAND_PROPERTY] = {};
            }
            
            // 确保脚本的命令数组存在
            if (!(window as any)[this.GLOBAL_COMMAND_PROPERTY][command.scriptId]) {
                (window as any)[this.GLOBAL_COMMAND_PROPERTY][command.scriptId] = [];
            }
            
            // 添加命令
            (window as any)[this.GLOBAL_COMMAND_PROPERTY][command.scriptId].push({
                id: command.id,
                name: command.name,
                callback: command.callback,
                accessKey: command.accessKey
            });
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 添加命令到全局对象失败:`, error);
        }
    }
    
    /**
     * 从全局对象移除命令
     */
    private removeFromGlobalObject(command: MenuCommand): void {
        try {
            const globalCommands = (window as any)[this.GLOBAL_COMMAND_PROPERTY];
            if (!globalCommands || !globalCommands[command.scriptId]) return;
            
            const commands = globalCommands[command.scriptId];
            const index = commands.findIndex((cmd: any) => cmd.id === command.id);
            
            if (index >= 0) {
                commands.splice(index, 1);
            }
        } catch (error) {
            console.error(`${logPrefix('MenuCommandManager')}: 从全局对象移除命令失败:`, error);
        }
    }
} 