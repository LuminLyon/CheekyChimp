import { App, Plugin, WorkspaceLeaf, Notice, PluginSettingTab, addIcon } from 'obsidian';
import { TampermonkeySettingTab, TampermonkeySettings, DEFAULT_SETTINGS } from './ui/settings-tab';
import { ScriptManager } from './services/script-manager';
import { ObsidianStorage } from './services/obsidian-storage';
import { ScriptInjector } from './services/script-injector';
import { UserScript } from './models/script';

export default class TampermonkeyPlugin extends Plugin {
    settings: TampermonkeySettings;
    scriptManager: ScriptManager;
    scriptStorage: ObsidianStorage;
    scriptInjector: ScriptInjector;
    settingTab: TampermonkeySettingTab;
    private editScriptHandler: EventListener;
    private createScriptHandler: EventListener;

    async onload() {
        console.log('Loading Tampermonkey plugin');

        // Initialize services
        this.scriptStorage = new ObsidianStorage(this);
        this.scriptManager = new ScriptManager();
        this.scriptInjector = new ScriptInjector(this.scriptStorage);

        // Load settings
        await this.loadSettings();

        // Register settings tab
        this.settingTab = new TampermonkeySettingTab(this.app, this);
        this.addSettingTab(this.settingTab);

        // Load scripts into script manager
        this.scriptManager.loadScripts(this.settings.scripts);

        // Register events for saving changes
        this.registerScriptManagerEvents();
        
        // Register for handling webview creation
        this.registerWebviewHandlers();

        // 添加油猴图标到ribbon
        // 使用原始油猴图标
        addIcon('tampermonkey', `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M 108.11719 0 L 0 108.11914 L 0 403.88086 L 108.11719 512 L 403.88281 512 L 512 403.88086 L 512 108.11914 L 403.88281 0 L 108.11719 0 z M 196.56055 128 L 315.43945 128 C 324.4555 128 332 135.5445 332 144.56055 L 332 196.56055 L 384 196.56055 C 393.0161 196.56055 400.56055 204.10499 400.56055 213.12109 L 400.56055 298.87891 C 400.56055 307.89501 393.0161 315.43945 384 315.43945 L 332 315.43945 L 332 367.43945 C 332 376.4555 324.4555 384 315.43945 384 L 196.56055 384 C 187.5445 384 180 376.4555 180 367.43945 L 180 315.43945 L 128 315.43945 C 118.98389 315.43945 111.43945 307.89501 111.43945 298.87891 L 111.43945 213.12109 C 111.43945 204.10499 118.98389 196.56055 128 196.56055 L 180 196.56055 L 180 144.56055 C 180 135.5445 187.5445 128 196.56055 128 z"/>
        </svg>`);

        // 添加ribbon图标
        const ribbonIconEl = this.addRibbonIcon('tampermonkey', 'Tampermonkey', (evt: MouseEvent) => {
            // 显示活动脚本状态
            const activeScripts = this.scriptManager.getAllScripts().filter(s => s.enabled);
            if (activeScripts.length > 0) {
                const scriptList = activeScripts.map(s => `- ${s.name}`).join('\n');
                new Notice(`当前启用的脚本 (${activeScripts.length}):\n${scriptList}`);
            } else {
                new Notice('当前没有启用的脚本');
            }
            
            // 打开设置页面
            this.openSettings();
        });

        // 监听脚本编辑和创建事件
        this.editScriptHandler = (e: Event) => {
            const customEvent = e as CustomEvent<{scriptId: string}>;
            const scriptId = customEvent.detail?.scriptId;
            if (scriptId) {
                this.openScriptEditor(scriptId);
            }
        };

        this.createScriptHandler = (e: Event) => {
            const customEvent = e as CustomEvent<{url: string}>;
            const url = customEvent.detail?.url;
            if (url) {
                this.createScriptForUrl(url);
            }
        };

        // 使用标准DOM事件监听
        document.addEventListener('tampermonkey-edit-script', this.editScriptHandler);
        document.addEventListener('tampermonkey-create-script', this.createScriptHandler);
    }

    onunload() {
        console.log('Unloading Tampermonkey plugin');
        // 移除自定义事件监听器
        document.removeEventListener('tampermonkey-edit-script', this.editScriptHandler);
        document.removeEventListener('tampermonkey-create-script', this.createScriptHandler);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        // Update settings with current scripts
        this.settings.scripts = this.scriptManager.getAllScripts();
        
        // Save settings
        await this.saveData(this.settings);
    }

    /**
     * 打开插件设置页面
     */
    openSettings(): void {
        // 使用Obsidian API打开设置，但处理不同版本API的兼容性
        // @ts-ignore - 旧版本的obsidian类型定义中可能没有setting
        if (this.app.setting) {
            // @ts-ignore
            this.app.setting.open();
            try {
                // @ts-ignore
                this.app.setting.openTabById('obsidian-tampermonkey');
            } catch (e) {
                console.warn('无法直接打开Tampermonkey设置标签，将打开通用设置页面');
            }
        } else {
            // 如果没有setting API，退回到简单通知
            new Notice('无法打开设置，请从Obsidian设置中找到Tampermonkey标签');
        }
    }

    /**
     * 打开脚本编辑器
     */
    openScriptEditor(scriptId: string): void {
        const script = this.scriptManager.getScript(scriptId);
        if (script) {
            // 打开设置页面
            this.openSettings();
            // 通知设置页面打开特定脚本
            new Notice(`正在打开脚本 "${script.name}" 进行编辑`);
        }
    }

    /**
     * 为特定URL创建新脚本
     */
    createScriptForUrl(url: string): void {
        if (!url) return;
        
        // 生成针对当前URL的脚本模板
        const domain = new URL(url).hostname;
        const scriptTemplate = `// ==UserScript==
// @name         针对 ${domain} 的脚本
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  为 ${domain} 添加功能
// @author       You
// @match        ${url}
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // 在此处添加您的代码...
    console.log('Tampermonkey脚本已启动!');
})();`;

        try {
            // 添加脚本
            const script = this.scriptManager.addScript(scriptTemplate);
            new Notice(`已为 ${domain} 创建新脚本`);
            
            // 打开编辑器
            this.openScriptEditor(script.id);
        } catch (error) {
            console.error('创建脚本失败:', error);
            new Notice('创建脚本失败，请查看控制台');
        }
    }

    /**
     * Register events from script manager
     */
    private registerScriptManagerEvents() {
        // Listen for script changes
        this.scriptManager.on('onScriptAdded', async () => {
            await this.saveSettings();
        });
        
        this.scriptManager.on('onScriptRemoved', async () => {
            await this.saveSettings();
        });
        
        this.scriptManager.on('onScriptUpdated', async () => {
            await this.saveSettings();
        });
        
        this.scriptManager.on('onScriptEnabled', async () => {
            await this.saveSettings();
        });
        
        this.scriptManager.on('onScriptDisabled', async () => {
            await this.saveSettings();
        });
    }

    /**
     * Register handlers for webview integration
     */
    private registerWebviewHandlers() {
        // 替换原来的 MutationObserver 方法，使用 Obsidian API 的事件系统
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.checkForWebViews();
            })
        );
        
        // 初始检查当前打开的叶子
        this.checkForWebViews();
        
        // 监听新创建的叶子
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
                if (leaf) {
                    this.handlePotentialWebViewLeaf(leaf);
                }
            })
        );
    }

    /**
     * 检查所有打开的窗格中的 webview
     */
    private checkForWebViews() {
        this.app.workspace.iterateAllLeaves((leaf) => {
            this.handlePotentialWebViewLeaf(leaf);
        });
    }

    /**
     * 处理可能包含 webview 的叶子
     */
    private handlePotentialWebViewLeaf(leaf: WorkspaceLeaf) {
        if (!leaf || !leaf.view) return;
        
        // 检查是否是内容包含 iframe 或 webview 的视图
        // 这里需要适配不同的插件如 Surfing, Omnisearch 等
        setTimeout(() => {
            const containerEl = leaf.view.containerEl;
            if (!containerEl) return;
            
            // 查找 iframe 或 webview 元素
            const webviews = containerEl.querySelectorAll('iframe, webview');
            webviews.forEach(webview => {
                if (webview instanceof HTMLIFrameElement || webview instanceof HTMLElement) {
                    this.setupWebViewListeners(webview);
                }
            });
        }, 500); // 延迟一点时间以确保 DOM 已经完全加载
    }

    /**
     * 为 webview 设置监听器
     */
    private setupWebViewListeners(webview: HTMLElement) {
        // 为避免重复设置，添加标记
        if (webview.hasAttribute('data-tampermonkey-processed')) {
            return;
        }
        webview.setAttribute('data-tampermonkey-processed', 'true');
        
        console.log('Tampermonkey: Webview detected', webview.tagName);
        
        // 如果是 iframe，可以尝试使用 load 事件
        if (webview instanceof HTMLIFrameElement) {
            console.log('Tampermonkey: 处理iframe元素');
            
            // 获取当前URL
            let currentUrl = '';
            
            try {
                // 尝试获取iframe的src
                currentUrl = webview.src;
            } catch(e) {
                console.warn('Tampermonkey: 无法读取iframe的src属性', e);
                currentUrl = webview.getAttribute('src') || '';
            }
            
            // 为iframe添加load事件监听
            webview.addEventListener('load', () => {
                try {
                    // 加载完成后重新获取URL
                    let url = '';
                    try {
                        url = webview.src;
                    } catch(e) {
                        url = webview.getAttribute('src') || '';
                    }
                    
                    if (url) {
                        console.log('Tampermonkey: iframe加载完成，注入脚本到', url);
                        this.injectScriptsForUrl(webview, url);
                    }
                } catch (e) {
                    console.error('Tampermonkey: 处理iframe load事件出错', e);
                }
            });
            
            // 立即处理当前URL
            if (currentUrl) {
                console.log('Tampermonkey: 立即注入脚本到iframe:', currentUrl);
                this.injectScriptsForUrl(webview, currentUrl);
            }
        } 
        // 处理其他类型的 webview
        else if (webview.tagName === 'WEBVIEW' || webview.tagName === 'IFRAME') {
            console.log('Tampermonkey: 处理webview元素');
            
            // 获取当前URL
            const currentUrl = webview.getAttribute('src') || '';
            
            // 为webview添加事件监听
            try {
                webview.addEventListener('did-navigate', (event: any) => {
                    try {
                        const url = event.url || webview.getAttribute('src') || '';
                        if (url) {
                            console.log('Tampermonkey: webview导航到', url);
                            this.injectScriptsForUrl(webview, url);
                        }
                    } catch(e) {
                        console.error('Tampermonkey: 处理webview导航事件出错', e);
                    }
                });
                
                // 尝试监听load事件
                webview.addEventListener('load', () => {
                    try {
                        const url = webview.getAttribute('src') || '';
                        if (url) {
                            console.log('Tampermonkey: webview加载完成', url);
                            this.injectScriptsForUrl(webview, url);
                        }
                    } catch(e) {
                        console.error('Tampermonkey: 处理webview load事件出错', e);
                    }
                });
            } catch(e) {
                console.warn('Tampermonkey: 添加webview事件监听器失败', e);
            }
            
            // 检查当前URL
            if (currentUrl) {
                console.log('Tampermonkey: 立即注入脚本到webview:', currentUrl);
                setTimeout(() => {
                    this.injectScriptsForUrl(webview, currentUrl);
                }, 500); // 延迟一点时间确保webview已准备好
            }
        }
        // 处理其他未知元素，尝试查找内部的iframe
        else {
            console.log('Tampermonkey: 处理未知元素，查找内部iframe');
            
            // 查找内部的iframe或webview元素
            const innerWebviews = webview.querySelectorAll('iframe, webview');
            innerWebviews.forEach(innerWebview => {
                if (innerWebview instanceof HTMLElement) {
                    console.log('Tampermonkey: 找到内部webview元素');
                    this.setupWebViewListeners(innerWebview);
                }
            });
        }
    }

    /**
     * Inject scripts for a given URL
     */
    private injectScriptsForUrl(webview: HTMLElement, url: string) {
        // Find matching scripts
        const scripts = this.scriptManager.findScriptsForUrl(url);
        
        if (scripts.length > 0) {
            console.log(`Tampermonkey: Found ${scripts.length} scripts for ${url}`);
            // Inject scripts
            this.scriptInjector.injectScripts(webview, url, scripts);
        }
    }

    /**
     * Load CSS styles
     */
    private loadStyles() {
        // Add the CSS class to the body for our styles
        document.body.classList.add('tampermonkey-enabled');

        // 添加UI样式
        const style = document.createElement('style');
        style.id = 'tampermonkey-ui-styles';
        style.textContent = `
            .tampermonkey-browser-ui {
                z-index: 9;
                opacity: 0.7;
                transition: opacity 0.3s ease;
            }
            
            .tampermonkey-browser-ui:hover {
                opacity: 1;
            }
            
            .tampermonkey-icon {
                opacity: 0.8;
                transition: all 0.2s ease;
                box-shadow: 0 0 5px rgba(0,0,0,0.1);
            }
            
            .tampermonkey-icon:hover {
                background-color: var(--interactive-hover) !important;
                transform: scale(1.1);
                opacity: 1;
            }
            
            .tampermonkey-menu {
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
        `;
        document.head.appendChild(style);
    }
} 