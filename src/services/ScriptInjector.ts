import { GMInfo } from './api/GMApiTypes';
import { ResourceLoader } from './resources/ResourceLoader';
import { LocalStorageService, StorageService } from './storage/StorageService';
import { DirectInjector } from './injectors/DirectInjector';
import { IframeInjector } from './injectors/IframeInjector';
import { WebviewInjector } from './injectors/WebviewInjector';
import { InjectorConfig } from './injectors/InjectorBase';

/**
 * 脚本注入配置
 */
export interface ScriptInjectorConfig {
    scriptInfo: GMInfo;
    sourceCode: string;
    injectFrames?: boolean;
    injectWebviews?: boolean;
    resources?: Array<{name: string; url: string}>;
    storageNamespace?: string;
    logPrefix?: string;
}

/**
 * 主脚本注入器
 * 用于管理和协调不同类型的注入过程
 */
export class ScriptInjector {
    private config: ScriptInjectorConfig;
    private resourceLoader: ResourceLoader;
    private storageService: StorageService;
    private directInjector: DirectInjector;
    private iframeInjector: IframeInjector | null = null;
    private webviewInjector: WebviewInjector | null = null;
    private logger: (...args: any[]) => void;

    constructor(config: ScriptInjectorConfig) {
        this.config = {
            injectFrames: true,
            injectWebviews: false,
            logPrefix: '[CheekyChimp]',
            ...config
        };
        
        // 创建日志工具
        this.logger = this.createLogger(this.config.logPrefix);
        
        // 初始化资源加载器
        this.resourceLoader = this.initResourceLoader();
        
        // 初始化存储服务
        this.storageService = this.initStorageService();
        
        // 创建注入器基础配置
        const injectorConfig: InjectorConfig = {
            scriptInfo: this.config.scriptInfo,
            sourceCode: this.config.sourceCode,
            resourceLoader: this.resourceLoader,
            storageService: this.storageService,
            logPrefix: this.config.logPrefix
        };
        
        // 创建直接注入器（用于当前页面）
        this.directInjector = new DirectInjector(injectorConfig);
        
        // 创建iframe注入器（如果启用）
        if (this.config.injectFrames) {
            this.iframeInjector = new IframeInjector(injectorConfig);
        }
        
        // 创建webview注入器（如果启用）
        if (this.config.injectWebviews) {
            this.webviewInjector = new WebviewInjector(injectorConfig);
        }
    }

    /**
     * 启动注入过程
     */
    public inject(): void {
        this.logger(`开始脚本注入过程 - ${this.config.scriptInfo.script.name} v${this.config.scriptInfo.script.version}`);
        
        try {
            // 注入到当前页面
            this.directInjector.inject(window);
            
            // 注入到iframe（如果启用）
            if (this.iframeInjector) {
                this.iframeInjector.inject(window);
            }
            
            // 注入到webview（如果启用）
            if (this.webviewInjector) {
                this.webviewInjector.inject(window);
            }
            
            this.logger(`脚本注入完成`);
        } catch (error) {
            console.error(`${this.config.logPrefix} 脚本注入失败:`, error);
        }
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        // 停止iframe观察
        if (this.iframeInjector) {
            (this.iframeInjector as any).disconnect?.();
        }
        
        // 停止webview观察
        if (this.webviewInjector) {
            (this.webviewInjector as any).disconnect?.();
        }
        
        // 释放资源
        this.resourceLoader.dispose();
    }

    /**
     * 初始化资源加载器
     */
    private initResourceLoader(): ResourceLoader {
        const resources = this.config.scriptInfo.script.resources.map(res => ({
            name: res.name,
            url: res.url,
            loaded: false
        }));
        
        return new ResourceLoader(resources);
    }

    /**
     * 初始化存储服务
     */
    private initStorageService(): StorageService {
        // 使用脚本命名空间作为存储前缀
        const namespace = this.config.storageNamespace || this.config.scriptInfo.script.namespace;
        return new LocalStorageService(namespace);
    }

    /**
     * 创建带有前缀的日志函数
     */
    private createLogger(prefix: string = '[CheekyChimp]'): (...args: any[]) => void {
        return (...args: any[]) => console.log(prefix, ...args);
    }
} 