import { App, Plugin, WorkspaceLeaf, Notice, PluginSettingTab, addIcon, Menu } from 'obsidian';
import { CheekyChimpSettingTab, CheekyChimpSettings, DEFAULT_SETTINGS } from './ui/settings-tab';
import { ScriptManager } from './services/script-manager';
import { ObsidianStorage } from './services/obsidian-storage';
import { UserScript } from './models/script';
import { i18n } from './services/i18n-service';
import { MenuCommandManager } from './services/injection/MenuCommandManager';
import { MenuCommandInjector } from './services/injection/menu-command-injector';
import { ScriptMenuUI } from './services/injection/script-menu-ui';
import { logPrefix } from './services/injection/utils';
import { SiteAdapterFactory } from './services/injection/site-adapters/site-adapter-factory';

// 为window添加_cheekyChimpCommands类型声明
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
        _gmMenuCommands?: Array<{
            id: number | string;
            name: string;
            callback: Function;
            accessKey?: string;
        }>;
    }
}

// 引入所有重构后的模块，强制包含在构建中
import { ErrorHandler, ErrorHandlingLevel } from './services/error/error-handler';
import { 
    CheekyChimpError, 
    ScriptInjectionError, 
    ScriptParsingError,
    ResourceLoadError,
    APICallError,
    StorageError
} from './services/error/error-types';
import { Logger, LogLevel } from './services/logging/logger';
import { BackupScriptInjector } from './services/backup-script-injector';
import { EnhancedScriptInjector } from './services/EnhancedScriptInjector';

// 输出调试信息，帮助诊断问题
function debugDiagnostics() {
    console.log('[CheekyChimp] 诊断信息:');
    console.log(`- ErrorHandler 已加载: ${typeof ErrorHandler !== 'undefined'}`);
    console.log(`- Logger 已加载: ${typeof Logger !== 'undefined'}`);
    // 添加测试输出
    console.log('- 优化项目结构测试...');
}

// 初始化日志服务
const globalLogger = new Logger('CheekyChimp');
globalLogger.info('初始化CheekyChimp插件');

// 运行诊断
debugDiagnostics();

export default class CheekyChimpPlugin extends Plugin {
    settings: CheekyChimpSettings;
    scriptManager: ScriptManager;
    scriptStorage: ObsidianStorage;
    scriptInjector: EnhancedScriptInjector;
    settingTab: CheekyChimpSettingTab;
    private editScriptHandler: EventListener;
    private createScriptHandler: EventListener;
    private menuCommandManager: MenuCommandManager;
    private menuCommandInjector: MenuCommandInjector;
    private scriptMenuUI: ScriptMenuUI;
    // 注入记录Map：webviewId -> Set<scriptId>
    private injectionRecords = new Map<string, Set<string>>();
    // 用于追踪是否已添加菜单命令
    private hasAddedScriptCommands = false;

    async onload() {
        console.log('Loading CheekyChimp plugin');

        // 再次运行诊断
        debugDiagnostics();

        // Initialize services
        this.scriptStorage = new ObsidianStorage(this);
        this.scriptManager = new ScriptManager();
        this.menuCommandManager = new MenuCommandManager();
        this.menuCommandInjector = new MenuCommandInjector();
        this.scriptMenuUI = new ScriptMenuUI();
        
        // 使用增强版注入器
        console.log('[CheekyChimp] 使用增强版脚本注入器');
        this.scriptInjector = new EnhancedScriptInjector(this.scriptStorage, this.scriptManager, {
            debug: true, // 默认启用调试
            autoReinject: true // 默认启用自动重新注入
        });
        
        console.log('[CheekyChimp] 服务初始化完成，scriptInjector类型:', 
            this.scriptInjector.constructor.name,
            '方法:', 
            Object.getOwnPropertyNames(Object.getPrototypeOf(this.scriptInjector))
        );

        // Load settings
        await this.loadSettings();

        // Register settings tab
        this.settingTab = new CheekyChimpSettingTab(this.app, this);
        this.addSettingTab(this.settingTab);

        // Load scripts into script manager
        this.scriptManager.loadScripts(this.settings.scripts);

        // Register events for saving changes
        this.registerScriptManagerEvents();
        
        // Register for handling webview creation
        this.registerWebViewHandlers();

        // 注册刷新处理程序，确保页面刷新后重新注入脚本
        this.registerRefreshHandlers();

        // 添加油猴图标到ribbon
        // 使用原始油猴图标
        addIcon('cheekychimp', `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M 108.11719 0 L 0 108.11914 L 0 403.88086 L 108.11719 512 L 403.88281 512 L 512 403.88086 L 512 108.11914 L 403.88281 0 L 108.11719 0 z M 196.56055 128 L 315.43945 128 C 324.4555 128 332 135.5445 332 144.56055 L 332 196.56055 L 384 196.56055 C 393.0161 196.56055 400.56055 204.10499 400.56055 213.12109 L 400.56055 298.87891 C 400.56055 307.89501 393.0161 315.43945 384 315.43945 L 332 315.43945 L 332 367.43945 C 332 376.4555 324.4555 384 315.43945 384 L 196.56055 384 C 187.5445 384 180 376.4555 180 367.43945 L 180 315.43945 L 128 315.43945 C 118.98389 315.43945 111.43945 307.89501 111.43945 298.87891 L 111.43945 213.12109 C 111.43945 204.10499 118.98389 196.56055 128 196.56055 L 180 196.56055 L 180 144.56055 C 180 135.5445 187.5445 128 196.56055 128 z"/>
        </svg>`);

        // 添加ribbon图标
        const ribbonIconEl = this.addRibbonIcon('cheekychimp', 'CheekyChimp', (evt: MouseEvent) => {
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
                        // 调用createScriptForUrl方法，创建一个新的空白脚本
                        this.createScriptForUrl('https://example.com');
                    });
            });
            
            // 添加"导入脚本"选项
            menu.addItem((item) => {
                item.setTitle("导入脚本")
                    .setIcon("upload")
                    .onClick(() => {
                        // 打开设置页面，因为导入功能在那里实现
            this.openSettings();
                    });
            });
            
            // 添加"管理所有脚本"选项
            menu.addItem((item) => {
                item.setTitle("管理所有脚本")
                    .setIcon("settings")
                    .onClick(() => {
                        this.openSettings();
                    });
            });
            
            // 在鼠标点击位置显示菜单
            menu.showAtPosition({ x: evt.x, y: evt.y });
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
        document.addEventListener('cheekychimp-edit-script', this.editScriptHandler);
        document.addEventListener('cheekychimp-create-script', this.createScriptHandler);
    }

    onunload() {
        console.log('Unloading CheekyChimp plugin');
        // 移除自定义事件监听器
        document.removeEventListener('cheekychimp-edit-script', this.editScriptHandler);
        document.removeEventListener('cheekychimp-create-script', this.createScriptHandler);
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
                this.app.setting.openTabById('obsidian-cheekychimp');
            } catch (e) {
                console.warn('无法直接打开CheekyChimp设置标签，将打开通用设置页面');
            }
        } else {
            // 如果没有setting API，退回到简单通知
            new Notice(i18n.t('error_open_settings'));
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
            new Notice(i18n.t('opening_script_editor', { name: script.name }));
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
// @name         Script for ${domain}
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add functionality to ${domain}
// @author       You
// @match        ${url}
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // Add your code here...
    console.log('CheekyChimp script running!');
})();`;

        try {
            // 添加脚本
            const script = this.scriptManager.addScript(scriptTemplate);
            new Notice(i18n.t('script_created_for_domain', { domain }));
            
            // 打开编辑器
            this.openScriptEditor(script.id);
        } catch (error) {
            console.error('创建脚本失败:', error);
            new Notice(i18n.t('error_creating_script'));
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
    private registerWebViewHandlers() {
        // 添加MutationObserver来监控整个文档中的iframe/webview变化
        this.setupDOMObserver();
        
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
     * 设置DOM观察器，监视整个文档中的iframe/webview变化
     */
    private setupDOMObserver(): void {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName === 'IFRAME' || node.nodeName === 'WEBVIEW') {
                        this.setupIframe(node as HTMLIFrameElement);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
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
            
        console.log('CheekyChimp: Webview detected', webview.tagName);
            
            let currentUrl = '';
            
        // 如果是 iframe，可以尝试使用 load 事件
            if (webview instanceof HTMLIFrameElement) {
            console.log('CheekyChimp: 处理iframe元素');
            
            try {
                // 尝试获取iframe的src
                currentUrl = webview.src;
            } catch(e) {
                console.warn('CheekyChimp: 无法读取iframe的src属性', e);
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
                        console.log('CheekyChimp: iframe加载完成，注入脚本到', url);
                        this.injectScriptsForUrl(webview, url);
                    }
                } catch (e) {
                    console.error('CheekyChimp: 处理iframe load事件出错', e);
                }
            });
            
            // 注册刷新处理程序
            if (this.scriptInjector instanceof EnhancedScriptInjector) {
                this.scriptInjector.registerRefreshHandler(webview, currentUrl);
            }
            
            // 立即处理当前URL
            if (currentUrl) {
                console.log('CheekyChimp: 立即注入脚本到iframe:', currentUrl);
                this.injectScriptsForUrl(webview, currentUrl);
                }
        } 
        // 处理其他类型的 webview
        else if (webview.tagName === 'WEBVIEW' || webview.tagName === 'IFRAME') {
            console.log('CheekyChimp: 处理webview元素');
            
            // 获取当前URL
            const currentUrl = webview.getAttribute('src') || '';
            
            // 为webview添加事件监听
            try {
                webview.addEventListener('did-navigate', (event: any) => {
                    try {
                        const url = event.url || webview.getAttribute('src') || '';
                        if (url) {
                            console.log('CheekyChimp: webview导航到', url);
                            this.injectScriptsForUrl(webview, url);
                        }
                    } catch(e) {
                        console.error('CheekyChimp: 处理webview导航事件出错', e);
                    }
                });
                
                // 尝试监听load事件
                webview.addEventListener('load', () => {
                    try {
                        const url = webview.getAttribute('src') || '';
                        if (url) {
                            console.log('CheekyChimp: webview加载完成', url);
                            this.injectScriptsForUrl(webview, url);
                        }
                    } catch(e) {
                        console.error('CheekyChimp: 处理webview load事件出错', e);
                    }
                });
                
                // 注册刷新处理程序
                if (this.scriptInjector instanceof EnhancedScriptInjector) {
                    this.scriptInjector.registerRefreshHandler(webview, currentUrl);
                                }
            } catch(e) {
                console.warn('CheekyChimp: 添加webview事件监听器失败', e);
            }
            
            // 检查当前URL
            if (currentUrl) {
                console.log('CheekyChimp: 立即注入脚本到webview:', currentUrl);
                setTimeout(() => {
                    this.injectScriptsForUrl(webview, currentUrl);
                }, 500); // 延迟一点时间确保webview已准备好
            }
        }
        // 处理其他未知元素，尝试查找内部的iframe
        else {
            console.log('CheekyChimp: 处理未知元素，查找内部iframe');
            
            // 查找内部的iframe或webview元素
            const innerWebviews = webview.querySelectorAll('iframe, webview');
            innerWebviews.forEach(innerWebview => {
                if (innerWebview instanceof HTMLElement) {
                    console.log('CheekyChimp: 找到内部webview元素');
                    this.setupWebViewListeners(innerWebview);
                }
            });
        }
    }

    /**
     * 设置iframe可见性轮询
     * 这是处理一些特殊情况的补充机制，如iframe内容在页面后期加载或通过JS动态更改、页面刷新等
     */
    private setupVisibilityPolling(iframe: HTMLIFrameElement): void {
        let lastContent = '';
        let lastUrl = iframe.src || '';
        let lastLocationHref = '';
        let lastDocumentTitle = '';
        let reloadCounter = 0;
        
        // 防止多次设置轮询
        if (iframe.hasAttribute('data-cheekychimp-polling')) {
            return;
        }
        iframe.setAttribute('data-cheekychimp-polling', 'true');
        
        const interval = setInterval(() => {
            try {
                // 检查iframe是否仍在DOM中，如果不在则停止轮询
                if (!document.contains(iframe)) {
                    console.log(`${logPrefix('VisibilityPolling')} iframe已从DOM中移除，停止轮询`);
                    clearInterval(interval);
                    return;
                }
                
                // 获取当前URL
                const currentUrl = iframe.src || '';
                
                // 尝试获取内部document的信息（可能因跨域而失败）
                let currentContent = '';
                let currentLocationHref = '';
                let currentDocumentTitle = '';
                
                try {
                    if (iframe.contentDocument && iframe.contentWindow) {
                        currentContent = iframe.contentDocument.documentElement.outerHTML || '';
                        currentLocationHref = iframe.contentWindow.location.href;
                        currentDocumentTitle = iframe.contentDocument.title;
                    }
                } catch (e) {
                    // 跨域限制，忽略
                }
                
                // 检测变化的多种指标
                const urlChanged = currentUrl !== lastUrl;
                const contentChanged = currentContent && currentContent !== lastContent && currentContent.length > 50;
                const hrefChanged = currentLocationHref && currentLocationHref !== lastLocationHref;
                const titleChanged = currentDocumentTitle && currentDocumentTitle !== lastDocumentTitle;
                
                // 如果任何一项发生变化，可能是页面刷新或内容更新
                if (urlChanged || contentChanged || hrefChanged || titleChanged) {
                    console.log(`${logPrefix('VisibilityPolling')} 检测到iframe变化:`, 
                        urlChanged ? '地址变化' : '', 
                        contentChanged ? '内容变化' : '',
                        hrefChanged ? '内部href变化' : '',
                        titleChanged ? '标题变化' : ''
                    );
                    
                    // 更新上次状态
                    lastUrl = currentUrl;
                    if (currentContent) lastContent = currentContent;
                    if (currentLocationHref) lastLocationHref = currentLocationHref;
                    if (currentDocumentTitle) lastDocumentTitle = currentDocumentTitle;
                    
                    // 清除旧的注入记录
                    const webviewId = this.getWebviewId(iframe);
                    this.clearInjectionRecords(webviewId);
                    
                    // 重新注入脚本（延迟执行，确保页面已加载）
                    setTimeout(() => {
                        this.injectScriptsForUrl(currentUrl, iframe);
                    }, 300);
                    
                    // 重置重新加载计数器
                    reloadCounter = 0;
                } else {
                    // 周期性地强制检查是否需要重新注入（处理无法检测的刷新）
                    reloadCounter++;
                    
                    // 每30秒强制检查一次（30 * 1000毫秒 / 1000毫秒的轮询间隔 = 30次）
                    if (reloadCounter >= 30) {
                        console.log(`${logPrefix('VisibilityPolling')} 定期检查是否需要重新注入脚本`);
                        
                        // 查找是否有未注入的脚本
                        const webviewId = this.getWebviewId(iframe);
                        const url = iframe.src || '';
                        
                        if (url) {
                            // 获取所有匹配的已启用脚本
                            const matchingScripts = this.scriptManager.findScriptsForUrl(url)
                                .filter(script => script.enabled);
                            
                            // 查找尚未注入的脚本
                            const notInjectedScripts = matchingScripts.filter(script => 
                                !this.isScriptInjected(webviewId, script.id)
                            );
                            
                            if (notInjectedScripts.length > 0) {
                                console.log(`${logPrefix('VisibilityPolling')} 发现 ${notInjectedScripts.length} 个未注入的脚本，尝试注入`);
                                this.injectScriptsForUrl(url, iframe);
                            }
                        }
                        
                        reloadCounter = 0;
                    }
                }
            } catch (e) {
                console.error(`${logPrefix('VisibilityPolling')} 轮询出错:`, e);
                clearInterval(interval);
            }
        }, 1000);
        
        // 存储interval ID，以便可以在适当的时候清除
        iframe.setAttribute('data-cheekychimp-polling-id', String(interval));
    }

    /**
     * 清除与webview相关的注入记录
     * @param event 事件对象
     */
    private clearWebviewInjectionRecords = (event: Event): void => {
        try {
            if (event.target) {
                const webview = event.target as HTMLElement;
                const webviewId = this.getWebviewId(webview);
                this.clearInjectionRecords(webviewId);
                console.log(`${logPrefix('WebviewManager')} 已清除webview注入记录: ${webviewId}`);
                
                // 获取当前URL并重新注入脚本
                let url: string = '';
                if (webview instanceof HTMLIFrameElement) {
                    url = webview.src || '';
                } else {
                    url = webview.getAttribute('src') || '';
                }
                
                // 如果有URL，稍后重新注入脚本（给页面一些时间完全加载）
                if (url) {
                    console.log(`${logPrefix('WebviewManager')} 页面刷新检测，准备重新注入脚本: ${url}`);
                    // 延迟一小段时间，确保页面已完全加载
                    setTimeout(() => {
                        this.injectScriptsForUrl(url, webview);
                    }, 500);
                }
            }
        } catch (error) {
            console.error(`${logPrefix('WebviewManager')} 清除注入记录失败:`, error);
        }
    }

    /**
     * Inject scripts for a given URL
     */
    private injectScriptsForUrl(webview: HTMLElement, url: string): void {
        // Find matching scripts
        const scripts = this.scriptManager.findScriptsForUrl(url);
        
        if (scripts.length > 0) {
            console.log(`CheekyChimp: Found ${scripts.length} scripts for ${url}`);
            // Inject scripts
            this.scriptInjector.injectScripts(webview, url, scripts);
        }
    }

    /**
     * 检查脚本是否已经注入到特定webview
     */
    private isScriptInjected(webviewId: string, scriptId: string): boolean {
        try {
            const injectedScripts = this.injectionRecords.get(webviewId);
            const isInjected = injectedScripts?.has(scriptId) || false;
            
            // 进行额外检查，确认脚本确实被注入
            if (isInjected && !this.verifyScriptInjection(webviewId, scriptId)) {
                // 如果验证失败，移除记录并返回false
                this.removeInjectionRecord(webviewId, scriptId);
                return false;
            }
            
            return isInjected;
        } catch (error) {
            console.error(`${logPrefix('InjectionManager')} 检查脚本注入状态失败:`, error);
            return false;
        }
    }

    /**
     * 验证脚本是否真的被注入了
     * 这是一个可选的额外检查，用于处理某些边缘情况
     */
    private verifyScriptInjection(webviewId: string, scriptId: string): boolean {
        try {
            // 这里可以实现更复杂的验证逻辑
            // 例如，检查页面中是否存在某个特定的标记或变量
            
            // 由于难以可靠地检查脚本是否已注入（尤其是跨域情况），
            // 这里我们简单地返回true，依赖于我们的记录系统
            return true;
        } catch (error) {
            // 出错时假设注入失败
            console.warn(`${logPrefix('InjectionManager')} 验证脚本注入失败:`, error);
            return false;
        }
    }

    /**
     * 移除单个注入记录
     */
    private removeInjectionRecord(webviewId: string, scriptId: string): void {
        try {
            const injectedScripts = this.injectionRecords.get(webviewId);
            if (injectedScripts) {
                injectedScripts.delete(scriptId);
                console.log(`${logPrefix('InjectionManager')} 已移除脚本注入记录: ${scriptId}`);
            }
        } catch (error) {
            console.error(`${logPrefix('InjectionManager')} 移除注入记录失败:`, error);
        }
    }

    /**
     * 标记脚本已注入到特定webview
     */
    private markScriptAsInjected(webviewId: string, scriptId: string): void {
        try {
            if (!this.injectionRecords.has(webviewId)) {
                this.injectionRecords.set(webviewId, new Set());
            }
            
            const scriptSet = this.injectionRecords.get(webviewId);
            if (scriptSet) {
                scriptSet.add(scriptId);
                console.log(`${logPrefix('InjectionManager')} 已标记脚本为已注入: ${scriptId}`);
            }
        } catch (error) {
            console.error(`${logPrefix('InjectionManager')} 标记脚本为已注入失败:`, error);
        }
    }

    /**
     * 获取webview的唯一ID
     */
    private getWebviewId(webview: HTMLElement): string {
        try {
            // 检查是否已有ID
            if (webview.hasAttribute('data-cheekychimp-id')) {
                return webview.getAttribute('data-cheekychimp-id') || '';
            }
            
            // 生成新ID
            const id = `cheekychimp-webview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // 设置ID属性
            webview.setAttribute('data-cheekychimp-id', id);
            
            console.log(`${logPrefix('WebviewManager')} 为webview生成新ID: ${id}`);
            return id;
        } catch (error) {
            // 如果无法设置属性，则使用内置id或生成临时id
            const fallbackId = webview.id || `temp-${Date.now()}`;
            console.warn(`${logPrefix('WebviewManager')} 无法设置webview ID，使用回退ID: ${fallbackId}`);
            return fallbackId;
        }
    }

    /**
     * 注入菜单命令支持
     */
    private injectMenuCommandSupport(script: UserScript, iframe: HTMLIFrameElement): void {
        try {
            this.menuCommandInjector.injectMenuCommandSupport(script, iframe);
        } catch (error) {
            console.error(`[CheekyChimp] 注入菜单命令支持失败:`, error);
        }
    }
    
    /**
     * 注入脚本菜单UI
     */
    private injectScriptMenuUI(iframe: HTMLIFrameElement): void {
        try {
            // 监听菜单命令的执行
            const handleExecuteCommand = (commandId: string | number) => {
                // 找到关联的webview并执行命令
                this.menuCommandInjector.executeCommand(iframe, commandId);
            };
            
            // 注入菜单UI
            this.scriptMenuUI.injectIntoIframe(iframe);
            
            // 监听来自iframe的菜单点击消息
            window.addEventListener('message', (event) => {
                try {
                    // 确保消息来自预期的iframe
                    if (event.source !== iframe.contentWindow) return;
                    
                    const data = event.data;
                    if (!data || typeof data !== 'object') return;
                    
                    // 处理菜单点击消息
                    if (data.type === 'cheekychimp-menu-clicked') {
                        // 更新菜单内容
                        this.updateScriptMenu();
                        // 显示菜单
                        this.scriptMenuUI.showMenu();
                    }
                } catch (error) {
                    console.error(`[CheekyChimp] 处理iframe消息失败:`, error);
                }
            });
        } catch (error) {
            console.error(`[CheekyChimp] 注入脚本菜单UI失败:`, error);
        }
    }
    
    /**
     * 更新脚本菜单内容
     */
    private updateScriptMenu(): void {
        try {
            // 获取所有命令
            const commands = this.menuCommandInjector.getAllCommands();
            
            // 确保菜单UI已初始化
            if (!this.scriptMenuUI.isInitialized()) {
                this.scriptMenuUI.initialize((commandId) => {
                    // 找到命令对应的webview并执行
                    const command = commands.find(cmd => cmd.id === commandId);
                    if (!command) return;
                    
                    // 遍历所有webview找到匹配的脚本
                    this.app.workspace.iterateAllLeaves(leaf => {
                        const webviewEl = leaf.view.containerEl.querySelector('iframe');
                        if (webviewEl) {
                            this.menuCommandInjector.executeCommand(webviewEl, command.id);
                        }
                    });
                });
            }
            
            // 更新菜单内容
            this.scriptMenuUI.updateMenu(commands);
        } catch (error) {
            console.error(`[CheekyChimp] 更新脚本菜单失败:`, error);
        }
    }

    /**
     * 从注入的脚本中获取并添加菜单命令到菜单
     */
    private addScriptCommandsToMenu(menu: Menu): void {
        this.hasAddedScriptCommands = false;
        try {
            // 使用MenuCommandManager获取所有命令
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
                                        // 查找命令对应的webview并执行
                                        this.app.workspace.iterateAllLeaves(leaf => {
                                            const webviewEl = leaf.view.containerEl.querySelector('iframe');
                                            if (webviewEl) {
                                                this.menuCommandInjector.executeCommand(webviewEl, command.id);
                                            }
                                        });
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
            
            // 如果没有从MenuCommandInjector获取到命令，尝试其他方法（兼容旧版）
            
            // 查找所有已开启的脚本
            const enabledScripts = this.scriptManager.getAllScripts().filter(s => s.enabled);
            
            // 遍历脚本查找菜单命令
            let commandCount = 0;
            
            // 首先尝试从localStorage中查找已注册的命令
            for (const script of enabledScripts) {
                const commandsKey = `tampermonkey_commands:${script.id}`;
                try {
                    const savedCommands = localStorage.getItem(commandsKey);
                    if (savedCommands) {
                        const commands = JSON.parse(savedCommands);
                        if (commands && commands.length > 0) {
                            for (const command of commands) {
                                menu.addItem((item) => {
                                    item.setTitle(command.name)
                                        .onClick(() => {
                                            // 触发自定义事件执行命令
                                            const event = new CustomEvent(`cheekychimp-run-command-${command.id}`);
                                            document.dispatchEvent(event);
                                            new Notice(`执行命令: ${command.name}`);
                                        });
                                });
                                commandCount++;
                            }
                        }
                    }
                } catch (e) {
                    console.error('解析脚本命令失败:', e);
                }
                
                // 也检查 cheekychimp_commands 格式的命令
                const ccCommandsKey = `cheekychimp_commands:${script.id}`;
                try {
                    const savedCCCommands = localStorage.getItem(ccCommandsKey);
                    if (savedCCCommands) {
                        const ccCommands = JSON.parse(savedCCCommands);
                        if (ccCommands && ccCommands.length > 0) {
                            for (const command of ccCommands) {
                                menu.addItem((item) => {
                                    item.setTitle(command.name)
                                        .onClick(() => {
                                            // 触发自定义事件执行命令
                                            const event = new CustomEvent(`cheekychimp-run-command-${command.id}`);
                                            document.dispatchEvent(event);
                                            new Notice(`执行命令: ${command.name}`);
                                        });
                                });
                                commandCount++;
                            }
                        }
                    }
                } catch (e) {
                    console.error('解析CheekyChimp命令失败:', e);
                }
            }
            
            // 如果找到了命令，标记为已添加
            if (commandCount > 0) {
                this.hasAddedScriptCommands = true;
            }
            
            // 尝试从任何可能存在的webview中获取window._gmMenuCommands
            // 这里是额外的尝试，因为可能有些命令是直接保存在webview内存中的
            const webviews = document.querySelectorAll('iframe, webview');
            webviews.forEach(webview => {
                try {
                    if (webview instanceof HTMLIFrameElement && webview.contentWindow) {
                        // 尝试访问iframe内部的_gmMenuCommands (注意可能有跨域限制)
                        try {
                            const commands = (webview.contentWindow as any)._gmMenuCommands;
                            if (commands && commands.length > 0) {
                                for (const command of commands) {
                                    menu.addItem((item) => {
                                        item.setTitle(command.name)
                                            .onClick(() => {
                                                try {
                                                    command.callback();
                                                    new Notice(`执行命令: ${command.name}`);
                                                } catch (e) {
                                                    console.error('执行命令失败:', e);
                                                    new Notice(`执行命令失败: ${command.name}`);
                                                }
                                            });
                                    });
                                    commandCount++;
                                }
                                this.hasAddedScriptCommands = true;
                            }
                        } catch (e) {
                            // 可能是跨域错误，忽略
                        }
                    }
                } catch (e) {
                    console.warn('访问webview内容时出错:', e);
                }
            });
            
            console.log('找到脚本命令数量:', commandCount);
            
        } catch (e) {
            console.error('添加脚本命令到菜单失败:', e);
        }
    }

    // 添加setupIframe方法
    private setupIframe(iframe: HTMLIFrameElement): void {
        try {
            // 记录前一个状态，用于检测刷新
            let previousState = "";
            
            // 设置iframe的事件监听器
            iframe.addEventListener('load', () => {
                const url = iframe.src || '';
                if (url) {
                    // 生成当前状态标识（URL+时间戳）
                    const currentState = url + "_" + Date.now();
                    
                    // 无论URL是否改变，都尝试重新注入脚本
                    console.log(`${logPrefix('WebviewManager')} iframe加载或刷新，URL: ${url}`);
                    
                    // 清除注入记录，确保刷新时重新注入
                    const webviewId = this.getWebviewId(iframe);
                    this.clearInjectionRecords(webviewId);
                    
                    // 延迟一小段时间注入，确保页面已经完全加载
                    setTimeout(() => {
                        this.injectScriptsForUrl(iframe, url);
                    }, 300);
                    
                    previousState = currentState;
                }
            });
            
            // 尝试监控更复杂的刷新行为
            try {
                if (iframe.contentWindow && iframe.contentDocument) {
                    // 监听页面可见性变化，可能表示用户返回页面
                    iframe.contentWindow.addEventListener('visibilitychange', () => {
                        if (iframe.contentWindow && iframe.contentDocument && 
                            !iframe.contentDocument.hidden) {
                            console.log(`${logPrefix('WebviewManager')} 检测到iframe可见性变化，可能需要重新注入`);
                            const url = iframe.src || '';
                            if (url) {
                                this.refreshInjection(iframe, url);
                            }
                        }
                    });
                }
            } catch (e) {
                // 可能因跨域限制无法添加事件监听，忽略错误
                console.log(`${logPrefix('WebviewManager')} 无法添加额外iframe事件监听器: ${e.message}`);
            }

            // 立即处理当前URL
            const currentUrl = iframe.src || '';
            if (currentUrl) {
                this.injectScriptsForUrl(iframe, currentUrl);
            }
        } catch (error) {
            console.error(`${logPrefix('WebviewManager')} 设置iframe监听器失败:`, error);
        }
    }

    /**
     * 为所有webview和iframe注册刷新处理程序
     * 确保页面刷新后能重新注入脚本
     */
    private registerRefreshHandlers(): void {
        try {
            // 检查是否使用的是EnhancedScriptInjector
            if (!(this.scriptInjector instanceof EnhancedScriptInjector)) {
                console.log('不是EnhancedScriptInjector，跳过注册刷新处理程序');
                return;
            }

            console.log('注册刷新处理程序，确保页面刷新后重新注入脚本');
            
            // 监听layout-change事件，查找新的webview
            this.registerEvent(
                this.app.workspace.on('layout-change', () => {
                    console.log('检测到布局变化，查找webview');
                    this.app.workspace.iterateAllLeaves((leaf) => {
                        if (!leaf || !leaf.view) return;
                        
                        const containerEl = leaf.view.containerEl;
                        if (!containerEl) return;
                        
                        // 查找所有iframe和webview
                        const webviews = containerEl.querySelectorAll('iframe, webview');
                        webviews.forEach(webview => {
                            if (webview instanceof HTMLIFrameElement) {
                                // 获取URL
                                let url = '';
                                try {
                                    url = webview.src;
                                } catch(e) {
                                    url = webview.getAttribute('src') || '';
                                }
                                
                                if (url) {
                                    // 为iframe注册刷新处理程序
                                    this.scriptInjector.registerRefreshHandler(webview, url);
                                    console.log(`为iframe注册刷新处理程序: ${url}`);
                                }
                            } else if (webview instanceof HTMLElement) {
                                // 获取URL
                                const url = webview.getAttribute('src') || '';
                                if (url) {
                                    // 为webview注册刷新处理程序
                                    this.scriptInjector.registerRefreshHandler(webview, url);
                                    console.log(`为webview注册刷新处理程序: ${url}`);
                                }
                            }
                        });
                    });
                })
            );
            
            // 立即检查现有webview
            this.app.workspace.iterateAllLeaves((leaf) => {
                if (!leaf || !leaf.view) return;
                
                const containerEl = leaf.view.containerEl;
                if (!containerEl) return;
                
                // 查找所有iframe和webview
                const webviews = containerEl.querySelectorAll('iframe, webview');
                webviews.forEach(webview => {
                    if (webview instanceof HTMLIFrameElement) {
                        // 获取URL
                        let url = '';
                        try {
                            url = webview.src;
                        } catch(e) {
                            url = webview.getAttribute('src') || '';
                        }
                        
                        if (url) {
                            // 为iframe注册刷新处理程序
                            this.scriptInjector.registerRefreshHandler(webview, url);
                            console.log(`为iframe注册刷新处理程序: ${url}`);
                        }
                    } else if (webview instanceof HTMLElement) {
                        // 获取URL
                        const url = webview.getAttribute('src') || '';
                        if (url) {
                            // 为webview注册刷新处理程序
                            this.scriptInjector.registerRefreshHandler(webview, url);
                            console.log(`为webview注册刷新处理程序: ${url}`);
                        }
                    }
                });
            });
        } catch (error) {
            console.error('注册刷新处理程序时出错:', error);
        }
    }
}