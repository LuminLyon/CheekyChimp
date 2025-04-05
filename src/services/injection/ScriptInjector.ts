import { App } from 'obsidian';
import { ObsidianStorage } from '../obsidian-storage';
import { ScriptManager } from '../script-manager';
import { UserScript } from '../../models/script';
import { logPrefix } from './utils';
// import { IframeInjector } from './IframeInjector';
// import { WebviewInjector } from './WebviewInjector';
import { GMApiFactory } from './GMApiFactory';
import { ScriptInjectionOptions, RunAtTiming } from './types';
import { BaseInjector } from './interfaces';
import { logger } from '../LogService';

/**
 * 脚本注入管理器，负责协调各种注入器
 */
export class ScriptInjector {
    private initialized = false;
    // 注释不存在的类型
    // private iframeInjector: IframeInjector;
    // private webviewInjector: WebviewInjector;
    private injectors: BaseInjector[] = [];
    private readonly scripts: UserScript[] = [];
    
    constructor(
        private app: App,
        private scriptStorage: ObsidianStorage,
        private scriptManager: ScriptManager,
        private options: ScriptInjectionOptions = {
            iframe: { enabled: true },
            webview: { enabled: true }
        }
    ) {
        logger.debug("ScriptInjector已创建", { options });
    }
    
    /**
     * 初始化注入系统
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn("ScriptInjector已经初始化，跳过重复初始化");
            return;
        }
        
        logger.info("开始初始化ScriptInjector");
        console.log(`${logPrefix('ScriptInjector')}: 开始初始化`);
        
        // 从脚本商店加载所有可用脚本
        await this.loadScripts();
        
        // 创建GM API工厂
        const gmApiFactory = new GMApiFactory(this.scriptStorage);
        
        // 注释不存在的代码
        // 创建注入器
        // this.iframeInjector = new IframeInjector(this.scripts, gmApiFactory, this.options);
        // this.webviewInjector = new WebviewInjector(this.scripts, gmApiFactory, this.options);
        
        // 将所有注入器添加到数组
        // this.injectors = [this.iframeInjector, this.webviewInjector];
        
        // 初始化所有注入器
        logger.debug("开始初始化所有注入器");
        // for (const injector of this.injectors) {
        //     await injector.initialize();
        // }
        
        this.initialized = true;
        logger.info("ScriptInjector初始化完成");
        console.log(`${logPrefix('ScriptInjector')}: 初始化完成`);
    }
    
    /**
     * 清理资源
     */
    public cleanup(): void {
        logger.debug("清理ScriptInjector资源");
        // 清理所有注入器
        // for (const injector of this.injectors) {
        //     injector.cleanup();
        // }
        this.injectors = [];
        this.initialized = false;
        logger.info("ScriptInjector资源已清理");
    }
    
    /**
     * 刷新并重新加载所有脚本
     */
    public async refreshScripts(): Promise<void> {
        logger.info("刷新ScriptInjector中的脚本");
        console.log(`${logPrefix('ScriptInjector')}: 刷新脚本`);
        
        // 清理旧实例
        this.cleanup();
        
        // 重新加载所有
        await this.initialize();
        
        logger.info("脚本刷新完成");
        console.log(`${logPrefix('ScriptInjector')}: 脚本刷新完成`);
    }
    
    /**
     * 从脚本商店加载脚本
     */
    private async loadScripts(): Promise<void> {
        try {
            // 清空当前脚本
            this.scripts.length = 0;
            
            // 获取所有脚本
            // 修复调用方式: 从scriptManager获取脚本而不是scriptStore
            const allScripts = this.scriptManager.getAllScripts();
            logger.info(`从ScriptManager读取到${allScripts.length}个脚本`);
            
            // 排序脚本
            const sortedScripts = this.sortScriptsByRunAt(allScripts);
            
            // 添加所有已启用的脚本
            for (const script of sortedScripts) {
                if (script.enabled) {
                    this.scripts.push(script);
                }
            }
            
            logger.info(`加载了${this.scripts.length}个启用的脚本`);
            console.log(`${logPrefix('ScriptInjector')}: 加载了${this.scripts.length}个启用的脚本`);
            
            // 详细记录脚本信息
            if (this.scripts.length > 0) {
                const scriptInfo = this.scripts.map(script => ({
                    id: script.id,
                    name: script.name,
                    includes: script.includes,
                    matches: script.matches,
                    excludes: script.excludes,
                    runAt: script.runAt || 'document-idle'
                }));
                logger.debug("已加载的脚本列表", scriptInfo);
            }
        } catch (error) {
            logger.error(`加载脚本时出错: ${error instanceof Error ? error.message : error}`, { error });
            console.error(`${logPrefix('ScriptInjector')}: 加载脚本时出错:`, error);
        }
    }
    
    /**
     * 对脚本按照runAt属性进行排序
     */
    private sortScriptsByRunAt(scripts: UserScript[]): UserScript[] {
        logger.debug("对脚本进行runAt排序");
        
        // 定义runAt的优先级顺序（数字越小优先级越高）
        const runAtPriority: Record<RunAtTiming, number> = {
            'document-start': 0,
            'document-body': 1,
            'document-end': 2,
            'document-idle': 3
        };
        
        // 过滤掉undefined值，设置默认的runAt
        const sortedScripts = [...scripts].sort((a, b) => {
            const aRunAt = a.runAt as RunAtTiming || 'document-idle';
            const bRunAt = b.runAt as RunAtTiming || 'document-idle';
            return runAtPriority[aRunAt] - runAtPriority[bRunAt];
        });
        
        // 记录排序结果
        if (sortedScripts.length > 0) {
            const sortInfo = sortedScripts.map(s => `${s.name} (${s.runAt || 'document-idle'})`);
            logger.debug("脚本排序结果", { order: sortInfo });
        }
        
        return sortedScripts;
    }
    
    /**
     * 获取已注入的脚本ID
     */
    public getInjectedScriptIds(): string[] {
        const allIds: string[] = [];
        
        // for (const injector of this.injectors) {
        //     if ('getInjectedScriptIds' in injector) {
        //         const ids = (injector as any).getInjectedScriptIds();
        //         allIds.push(...ids);
        //     }
        // }
        
        return Array.from(new Set(allIds)); // 去重
    }
}