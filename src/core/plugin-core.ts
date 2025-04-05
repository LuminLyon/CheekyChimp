import { App, Plugin, addIcon } from 'obsidian';
import { CheekyChimpSettings } from '../ui/settings-tab';
import { ScriptManager } from '../services/script-manager';
import { ObsidianStorage } from '../services/obsidian-storage';
import { BackupScriptInjector } from '../services/backup-script-injector';
import { WebViewManager } from './webview-manager';
import { MainMenuUI } from '../ui/menu/main-menu';
import { MenuCommandManager } from '../services/injection/MenuCommandManager';
import { MenuCommandInjector } from '../services/injection/menu-command-injector';
import { ScriptMenuUI } from '../services/injection/script-menu-ui';
import { i18n } from '../services/i18n-service';
import { ErrorHandler } from '../services/error/error-handler';
import { Logger } from '../services/logging/logger';

/**
 * CheekyChimp插件核心功能
 */
export class PluginCore {
    private scriptManager: ScriptManager;
    private scriptStorage: ObsidianStorage;
    private scriptInjector: BackupScriptInjector;
    private webViewManager: WebViewManager;
    private menuCommandManager: MenuCommandManager;
    private menuCommandInjector: MenuCommandInjector;
    private scriptMenuUI: ScriptMenuUI;
    private mainMenuUI: MainMenuUI;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    
    constructor(
        private plugin: Plugin,
        private app: App,
        private settings: CheekyChimpSettings
    ) {
        // 初始化日志服务
        this.logger = new Logger('CheekyChimpCore');
        this.logger.info('初始化CheekyChimp插件核心');
        
        // 初始化错误处理器
        this.errorHandler = new ErrorHandler();
    }
    
    /**
     * 初始化插件核心功能
     */
    async initialize(): Promise<void> {
        // 初始化服务
        this.scriptStorage = new ObsidianStorage(this.plugin);
        this.scriptManager = new ScriptManager();
        this.menuCommandManager = new MenuCommandManager();
        this.menuCommandInjector = new MenuCommandInjector();
        this.scriptMenuUI = new ScriptMenuUI();
        
        // 初始化脚本注入器
        this.logger.info('使用备份版本的脚本注入器');
        this.scriptInjector = new BackupScriptInjector(this.scriptStorage, this.scriptManager);
        
        // 初始化WebView管理器
        this.webViewManager = new WebViewManager(this.app, this.scriptInjector);
        this.webViewManager.initialize();
        
        // 加载脚本到脚本管理器
        this.scriptManager.loadScripts(this.settings.scripts);
        
        // 注册脚本管理器事件
        this.registerScriptManagerEvents();
        
        // 初始化UI组件
        this.setupUI();
        
        // 注册事件处理器
        this.registerEventHandlers();
        
        this.logger.info('CheekyChimp插件核心初始化完成');
    }
    
    /**
     * 设置UI组件
     */
    private setupUI(): void {
        // 添加油猴图标到ribbon
        this.addMonkeyIcon();
        
        // 初始化主菜单UI
        this.mainMenuUI = new MainMenuUI(
            this.scriptManager, 
            this.menuCommandInjector,
            () => this.openSettings(),
            (url: string) => this.createScriptForUrl(url)
        );
    }
    
    /**
     * 注册事件处理器
     */
    private registerEventHandlers(): void {
        // 监听脚本编辑和创建事件
        const editScriptHandler = (e: Event) => {
            const customEvent = e as CustomEvent<{scriptId: string}>;
            const scriptId = customEvent.detail?.scriptId;
            if (scriptId) {
                this.openScriptEditor(scriptId);
            }
        };

        const createScriptHandler = (e: Event) => {
            const customEvent = e as CustomEvent<{url: string}>;
            const url = customEvent.detail?.url;
            if (url) {
                this.createScriptForUrl(url);
            }
        };

        // 使用标准DOM事件监听
        document.addEventListener('cheekychimp-edit-script', editScriptHandler);
        document.addEventListener('cheekychimp-create-script', createScriptHandler);
        
        // 在插件卸载时需要手动移除这些事件监听器
        this.plugin.register(() => {
            document.removeEventListener('cheekychimp-edit-script', editScriptHandler);
            document.removeEventListener('cheekychimp-create-script', createScriptHandler);
        });
    }
    
    /**
     * 添加油猴图标到ribbon
     */
    private addMonkeyIcon(): void {
        // 使用原始油猴图标
        addIcon('cheekychimp', `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M 108.11719 0 L 0 108.11914 L 0 403.88086 L 108.11719 512 L 403.88281 512 L 512 403.88086 L 512 108.11914 L 403.88281 0 L 108.11719 0 z M 196.56055 128 L 315.43945 128 C 324.4555 128 332 135.5445 332 144.56055 L 332 196.56055 L 384 196.56055 C 393.0161 196.56055 400.56055 204.10499 400.56055 213.12109 L 400.56055 298.87891 C 400.56055 307.89501 393.0161 315.43945 384 315.43945 L 332 315.43945 L 332 367.43945 C 332 376.4555 324.4555 384 315.43945 384 L 196.56055 384 C 187.5445 384 180 376.4555 180 367.43945 L 180 315.43945 L 128 315.43945 C 118.98389 315.43945 111.43945 307.89501 111.43945 298.87891 L 111.43945 213.12109 C 111.43945 204.10499 118.98389 196.56055 128 196.56055 L 180 196.56055 L 180 144.56055 C 180 135.5445 187.5445 128 196.56055 128 z"/>
        </svg>`);

        // 添加ribbon图标
        this.plugin.addRibbonIcon('cheekychimp', 'CheekyChimp', (evt: MouseEvent) => {
            this.mainMenuUI.showMenu(evt);
        });
    }
    
    /**
     * 打开插件设置页面
     */
    openSettings(): void {
        // 使用Obsidian API打开设置
        try {
            // @ts-ignore - App类型定义中没有setting，但实际上存在
            if (this.app.setting) {
                // @ts-ignore
                this.app.setting.open();
                // 尝试打开特定标签
                try {
                    // @ts-ignore
                    this.app.setting.openTabById('obsidian-cheekychimp');
                } catch (e) {
                    this.logger.warn('无法直接打开CheekyChimp设置标签，将打开通用设置页面');
                }
            } else {
                // 如果没有setting API，使用备用方法
                // 触发命令打开设置
                const appInstance = this.app as any;
                if (appInstance.commands && typeof appInstance.commands.executeCommandById === 'function') {
                    appInstance.commands.executeCommandById('app:open-settings');
                    this.logger.info('通过命令打开设置页面');
                } else {
                    this.logger.error('无法打开设置页面，找不到合适的API方法');
                }
            }
        } catch (e) {
            this.logger.error('打开设置页面时出错', e);
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
            this.logger.info(`正在打开脚本编辑器: ${script.name}`);
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
            this.logger.info(`为域名 ${domain} 创建了新脚本`);
            
            // 打开编辑器
            this.openScriptEditor(script.id);
        } catch (error) {
            this.logger.error('创建脚本失败:', error);
        }
    }
    
    /**
     * 注册脚本管理器事件
     */
    private registerScriptManagerEvents(): void {
        // 监听脚本变化
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
     * 保存设置
     */
    private async saveSettings(): Promise<void> {
        // 更新设置中的脚本
        this.settings.scripts = this.scriptManager.getAllScripts();
        
        // 保存设置
        await this.plugin.saveData(this.settings);
    }
} 