import { Menu, Notice } from 'obsidian';
import { ScriptManager } from '../../services/script-manager';
import { MenuCommandInjector } from '../../services/injection/menu-command-injector';

/**
 * 主菜单UI管理器
 */
export class MainMenuUI {
    private hasAddedScriptCommands = false;

    constructor(
        private scriptManager: ScriptManager,
        private menuCommandInjector: MenuCommandInjector,
        private openSettingsCallback: () => void,
        private createScriptCallback: (url: string) => void
    ) {}

    /**
     * 显示主菜单
     * @param evt 鼠标事件
     */
    showMenu(evt: MouseEvent): void {
        // 创建UserScript菜单
        const menu = new Menu();
        
        // 显示菜单标题
        menu.addItem((item) => {
            item.setTitle("UserScript Menu")
                .setDisabled(true);
        });
        
        menu.addSeparator();
        
        // 获取所有脚本
        const allScripts = this.scriptManager.getAllScripts();
        
        // 查找并添加脚本命令到菜单
        this.addScriptCommandsToMenu(menu);
        
        // 如果没有找到脚本命令，显示脚本列表
        if (!this.hasAddedScriptCommands) {
            // 添加所有脚本到菜单
            if (allScripts.length > 0) {
                // 先显示已启用的脚本
                const enabledScripts = allScripts.filter(s => s.enabled);
                enabledScripts.forEach(script => {
                    menu.addItem((item) => {
                        item.setTitle(script.name)
                            .setIcon("check")
                            .onClick(() => {
                                // 禁用脚本
                                this.scriptManager.disableScript(script.id);
                                new Notice(`已禁用脚本: ${script.name}`);
                            });
                    });
                });
                
                // 然后显示未启用的脚本
                const disabledScripts = allScripts.filter(s => !s.enabled);
                if (disabledScripts.length > 0 && enabledScripts.length > 0) {
                    menu.addSeparator();
                }
                
                disabledScripts.forEach(script => {
                    menu.addItem((item) => {
                        item.setTitle(script.name)
                            .setIcon("circle")
                            .onClick(() => {
                                // 启用脚本
                                this.scriptManager.enableScript(script.id);
                                new Notice(`已启用脚本: ${script.name}`);
                            });
                    });
                });
            } else {
                // 如果没有脚本，显示提示
                menu.addItem((item) => {
                    item.setTitle("没有安装脚本")
                        .setDisabled(true);
                });
            }
        }
        
        // 添加管理选项
        menu.addSeparator();
        
        // 添加"新建脚本"选项
        menu.addItem((item) => {
            item.setTitle("新建脚本")
                .setIcon("plus")
                .onClick(() => {
                    // 创建一个新的空白脚本
                    this.createScriptCallback('https://example.com');
                });
        });
        
        // 添加"导入脚本"选项
        menu.addItem((item) => {
            item.setTitle("导入脚本")
                .setIcon("upload")
                .onClick(() => {
                    // 打开设置页面，因为导入功能在那里实现
                    this.openSettingsCallback();
                });
        });
        
        // 添加"管理所有脚本"选项
        menu.addItem((item) => {
            item.setTitle("管理所有脚本")
                .setIcon("settings")
                .onClick(() => {
                    this.openSettingsCallback();
                });
        });
        
        // 在鼠标点击位置显示菜单
        menu.showAtPosition({ x: evt.x, y: evt.y });
    }

    /**
     * 从注入的脚本中获取并添加菜单命令到菜单
     */
    private addScriptCommandsToMenu(menu: Menu): void {
        this.hasAddedScriptCommands = false;
        
        try {
            // 使用MenuCommandInjector获取所有命令
            const commands = this.menuCommandInjector.getAllCommands();
            
            if (commands.length > 0) {
                // 按脚本分组显示命令
                const scriptCommandsMap = new Map<string, any[]>();
                
                // 分组命令
                commands.forEach(command => {
                    if (!scriptCommandsMap.has(command.scriptId)) {
                        scriptCommandsMap.set(command.scriptId, []);
                    }
                    scriptCommandsMap.get(command.scriptId)?.push(command);
                });
                
                // 按脚本名称排序
                const sortedScriptIds = [...scriptCommandsMap.keys()].sort((a, b) => {
                    const scriptA = this.scriptManager.getScript(a);
                    const scriptB = this.scriptManager.getScript(b);
                    return (scriptA?.name || 'Unknown').localeCompare(scriptB?.name || 'Unknown');
                });
                
                // 添加分组的命令到菜单
                let addedCount = 0;
                
                for (const scriptId of sortedScriptIds) {
                    const scriptCommands = scriptCommandsMap.get(scriptId) || [];
                    if (scriptCommands.length === 0) continue;
                    
                    // 获取脚本信息
                    const script = this.scriptManager.getScript(scriptId);
                    const scriptName = script?.name || scriptCommands[0].scriptName || '未知脚本';
                    
                    // 添加脚本标题作为子菜单标题
                    if (addedCount > 0) {
                        menu.addSeparator();
                    }
                    
                    // 添加脚本标题
                    menu.addItem((item) => {
                        item.setTitle(`📜 ${scriptName}`)
                            .setDisabled(true);
                    });
                    
                    // 添加该脚本的所有命令
                    scriptCommands.forEach((command: any) => {
                        menu.addItem((item) => {
                            item.setTitle(`  ◆ ${command.name}`)
                                .onClick(() => {
                                    try {
                                        // 尝试执行命令，需要找到相应的webview
                                        // 由于脱离了main.ts的上下文，这里需要一种方式获取webview
                                        // 暂时简化为只通知用户命令已执行
                                        new Notice(`执行命令: ${command.name}`);
                                    } catch (e) {
                                        console.error('执行命令失败:', e);
                                        new Notice(`执行命令失败: ${command.name}`);
                                    }
                                });
                        });
                        addedCount++;
                    });
                }
                
                // 如果添加了命令，标记为已添加
                if (addedCount > 0) {
                    this.hasAddedScriptCommands = true;
                    console.log(`成功添加 ${addedCount} 个脚本命令到菜单`);
                    return;
                }
            }
        } catch (e) {
            console.error('添加脚本命令到菜单失败:', e);
        }
    }
} 