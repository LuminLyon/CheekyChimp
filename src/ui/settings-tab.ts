import { App, PluginSettingTab, Setting, Notice, Modal, TextComponent, ButtonComponent } from 'obsidian';
import TampermonkeyPlugin from '../main';
import { UserScript } from '../models/script';

export interface TampermonkeySettings {
    scripts: UserScript[];
    automaticallyCheckForUpdates: boolean;
    updateInterval: number;
    debug: boolean;
}

export const DEFAULT_SETTINGS: TampermonkeySettings = {
    scripts: [],
    automaticallyCheckForUpdates: true,
    updateInterval: 24, // hours
    debug: false
};

/**
 * Setting Tab for Tampermonkey
 */
export class TampermonkeySettingTab extends PluginSettingTab {
    plugin: TampermonkeyPlugin;

    constructor(app: App, plugin: TampermonkeyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Header
        containerEl.createEl('h2', { text: 'Tampermonkey 设置' });
        containerEl.createEl('p', { 
            text: '这个插件允许你在Obsidian的内部浏览器中使用用户脚本。' 
        });

        // General Settings
        containerEl.createEl('h3', { text: '常规设置' });

        new Setting(containerEl)
            .setName('自动检查更新')
            .setDesc('定期检查用户脚本的更新')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automaticallyCheckForUpdates)
                .onChange(async (value) => {
                    this.plugin.settings.automaticallyCheckForUpdates = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('更新检查间隔')
            .setDesc('检查脚本更新的间隔(小时)')
            .addSlider(slider => slider
                .setLimits(1, 168, 1)
                .setValue(this.plugin.settings.updateInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.updateInterval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('调试模式')
            .setDesc('启用调试日志')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debug)
                .onChange(async (value) => {
                    this.plugin.settings.debug = value;
                    await this.plugin.saveSettings();
                }));

        // Script Management
        containerEl.createEl('h3', { text: '脚本管理' });
        
        // Import script button
        new Setting(containerEl)
            .setName('导入脚本')
            .setDesc('从文件导入用户脚本')
            .addButton(button => button
                .setButtonText('导入')
                .setCta()
                .onClick(() => {
                    this.importScript();
                }));
        
        // Create script button
        new Setting(containerEl)
            .setName('创建新脚本')
            .setDesc('创建一个新的用户脚本')
            .addButton(button => button
                .setButtonText('创建')
                .setCta()
                .onClick(() => {
                    this.createScript();
                }));
        
        // Script list
        containerEl.createEl('h3', { text: '已安装的脚本' });
        
        const scriptListContainer = containerEl.createDiv({ cls: 'tampermonkey-script-list' });
        
        if (this.plugin.settings.scripts.length === 0) {
            scriptListContainer.createEl('p', { 
                text: '没有已安装的用户脚本。点击上方的"导入"或"创建"按钮来添加脚本。' 
            });
        } else {
            // Create list of scripts
            this.plugin.settings.scripts.forEach(script => {
                this.createScriptItem(scriptListContainer, script);
            });
        }
    }

    /**
     * Create a script item in the list
     */
    private createScriptItem(container: HTMLElement, script: UserScript): void {
        const scriptItem = container.createDiv({ cls: 'tampermonkey-script-item' });
        
        // Enabled toggle
        const enabledContainer = scriptItem.createDiv({ cls: 'tampermonkey-script-enabled' });
        const enabledToggle = new Setting(enabledContainer)
            .setName('')
            .addToggle(toggle => toggle
                .setValue(script.enabled)
                .onChange(async (value) => {
                    if (value) {
                        this.plugin.scriptManager.enableScript(script.id);
                    } else {
                        this.plugin.scriptManager.disableScript(script.id);
                    }
                    await this.plugin.saveSettings();
                }));
        
        // Script name and description
        const infoContainer = scriptItem.createDiv({ cls: 'tampermonkey-script-name' });
        const nameElement = infoContainer.createEl('div', { 
            text: script.name,
            cls: 'tampermonkey-script-name-text'
        });
        
        // 添加双击名称编辑功能
        nameElement.addEventListener('dblclick', () => {
            // 创建一个临时输入框替换名称显示
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = script.name;
            nameInput.className = 'tampermonkey-script-name-edit';
            nameInput.style.width = '100%';
            
            // 替换名称元素
            nameElement.replaceWith(nameInput);
            nameInput.focus();
            nameInput.select();
            
            // 失去焦点或按下回车时保存
            const saveNameChange = async () => {
                const newName = nameInput.value.trim();
                if (newName && newName !== script.name) {
                    try {
                        // 从源码中提取元数据
                        const source = script.source;
                        // 查找@name标签并替换
                        const updatedSource = source.replace(
                            /\/\/ @name\s+.*/,
                            `// @name ${newName}`
                        );
                        
                        // 更新脚本
                        if (updatedSource !== source) {
                            this.plugin.scriptManager.updateScript(script.id, updatedSource);
                            await this.plugin.saveSettings();
                            new Notice(`脚本名称已更新为 "${newName}"`);
                            this.display(); // 刷新设置页面
                        }
                    } catch (error) {
                        new Notice(`更新脚本名称失败: ${error.message}`);
                        nameInput.replaceWith(nameElement);
                    }
                } else {
                    // 如果没有更改，恢复原名称元素
                    nameInput.replaceWith(nameElement);
                }
            };
            
            nameInput.addEventListener('blur', saveNameChange);
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveNameChange();
                } else if (e.key === 'Escape') {
                    nameInput.replaceWith(nameElement);
                }
            });
        });
        
        if (script.description) {
            infoContainer.createEl('div', { 
                text: script.description,
                cls: 'tampermonkey-script-description'
            });
        }
        
        // Script actions (edit, delete)
        const actionsContainer = scriptItem.createDiv({ cls: 'tampermonkey-script-actions' });
        
        // Edit button
        const editButton = new ButtonComponent(actionsContainer)
            .setIcon('pencil')
            .setTooltip('编辑')
            .onClick(() => {
                this.editScript(script);
            });
        
        // Delete button
        const deleteButton = new ButtonComponent(actionsContainer)
            .setIcon('trash')
            .setTooltip('删除')
            .onClick(() => {
                this.deleteScript(script);
            });
    }

    /**
     * Import a script from file
     */
    private async importScript(): Promise<void> {
        // TODO: Implement file import dialog
        // For now, just show a modal to paste script content
        
        const modal = new ScriptImportModal(this.app, async (content) => {
            try {
                const script = this.plugin.scriptManager.addScript(content);
                await this.plugin.saveSettings();
                new Notice(`脚本 "${script.name}" 已导入`);
                this.display(); // Refresh settings page
            } catch (error) {
                new Notice(`导入脚本失败: ${error.message}`);
            }
        });
        
        modal.open();
    }

    /**
     * Create a new script
     */
    private async createScript(): Promise<void> {
        // Create a template script
        const template = `// ==UserScript==
// @name        新脚本
// @namespace   obsidian-tampermonkey
// @version     0.1
// @description 在此处填写脚本描述
// @author      你的名字
// @match       *://*/*
// @grant       none
// ==/UserScript==

(function() {
    'use strict';
    
    // 你的代码在这里...
    console.log('Hello from Tampermonkey script!');
})();`;
        
        const modal = new ScriptEditorModal(this.app, template, async (content) => {
            try {
                const script = this.plugin.scriptManager.addScript(content);
                await this.plugin.saveSettings();
                new Notice(`脚本 "${script.name}" 已创建`);
                this.display(); // Refresh settings page
            } catch (error) {
                new Notice(`创建脚本失败: ${error.message}`);
            }
        });
        
        modal.open();
    }

    /**
     * Edit an existing script
     */
    private async editScript(script: UserScript): Promise<void> {
        const modal = new ScriptEditorModal(this.app, script.source, async (content) => {
            try {
                this.plugin.scriptManager.updateScript(script.id, content);
                await this.plugin.saveSettings();
                new Notice(`脚本 "${script.name}" 已更新`);
                this.display(); // Refresh settings page
            } catch (error) {
                new Notice(`更新脚本失败: ${error.message}`);
            }
        });
        
        modal.open();
    }

    /**
     * Delete a script
     */
    private async deleteScript(script: UserScript): Promise<void> {
        const confirmed = await new Promise<boolean>(resolve => {
            const modal = new ConfirmModal(
                this.app,
                `确定要删除脚本 "${script.name}" 吗？`,
                resolve
            );
            modal.open();
        });
        
        if (confirmed) {
            try {
                this.plugin.scriptManager.removeScript(script.id);
                await this.plugin.saveSettings();
                new Notice(`脚本 "${script.name}" 已删除`);
                this.display(); // Refresh settings page
            } catch (error) {
                new Notice(`删除脚本失败: ${error.message}`);
            }
        }
    }
}

/**
 * Modal for importing scripts
 */
class ScriptImportModal extends Modal {
    private content: string = '';
    private onSubmit: (content: string) => void;

    constructor(app: App, onSubmit: (content: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tampermonkey-dialog');

        contentEl.createEl('h2', { text: '导入用户脚本' });
        
        // Instructions
        contentEl.createEl('p', { 
            text: '粘贴用户脚本内容:' 
        });
        
        // Text area for script content
        const textArea = contentEl.createEl('textarea', {
            cls: 'tampermonkey-editor'
        });
        
        textArea.addEventListener('input', (e) => {
            this.content = (e.target as HTMLTextAreaElement).value;
        });
        
        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: '取消',
            cls: 'mod-warning'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
        
        // Import button
        const importButton = buttonContainer.createEl('button', {
            text: '导入',
            cls: 'mod-cta'
        });
        
        importButton.addEventListener('click', () => {
            if (!this.content) {
                new Notice('请输入脚本内容');
                return;
            }
            
            this.onSubmit(this.content);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for editing scripts
 */
class ScriptEditorModal extends Modal {
    private content: string;
    private onSubmit: (content: string) => void;

    constructor(app: App, initialContent: string, onSubmit: (content: string) => void) {
        super(app);
        this.content = initialContent;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tampermonkey-dialog');

        contentEl.createEl('h2', { text: '编辑用户脚本' });
        
        // Text area for script content
        const textArea = contentEl.createEl('textarea', {
            cls: 'tampermonkey-editor'
        });
        
        textArea.value = this.content;
        
        textArea.addEventListener('input', (e) => {
            this.content = (e.target as HTMLTextAreaElement).value;
        });
        
        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: '取消',
            cls: 'mod-warning'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
        
        // Save button
        const saveButton = buttonContainer.createEl('button', {
            text: '保存',
            cls: 'mod-cta'
        });
        
        saveButton.addEventListener('click', () => {
            if (!this.content) {
                new Notice('脚本内容不能为空');
                return;
            }
            
            this.onSubmit(this.content);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for confirming actions
 */
class ConfirmModal extends Modal {
    private message: string;
    private onConfirm: (confirmed: boolean) => void;

    constructor(app: App, message: string, onConfirm: (confirmed: boolean) => void) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '确认' });
        contentEl.createEl('p', { text: this.message });
        
        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: '取消',
            cls: 'mod-warning'
        });
        
        cancelButton.addEventListener('click', () => {
            this.onConfirm(false);
            this.close();
        });
        
        // Confirm button
        const confirmButton = buttonContainer.createEl('button', {
            text: '确认',
            cls: 'mod-cta'
        });
        
        confirmButton.addEventListener('click', () => {
            this.onConfirm(true);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 