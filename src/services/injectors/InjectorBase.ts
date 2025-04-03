import { GMInfo } from '../api/GMApiTypes';
import { ResourceLoader } from '../resources/ResourceLoader';
import { StorageService } from '../storage/StorageService';
import { GMApiFactory } from '../api/GMApiFactory';

/**
 * 注入器配置
 */
export interface InjectorConfig {
    scriptInfo: GMInfo;
    sourceCode: string;
    resourceLoader: ResourceLoader;
    storageService: StorageService;
    logPrefix?: string;
}

/**
 * 脚本注入器基类
 */
export abstract class InjectorBase {
    protected config: InjectorConfig;
    protected apiFactory: GMApiFactory;

    constructor(config: InjectorConfig) {
        this.config = config;
        
        // 创建API工厂
        this.apiFactory = new GMApiFactory(
            config.scriptInfo, 
            config.resourceLoader, 
            config.storageService,
            window
        );
    }

    /**
     * 注入脚本到目标窗口
     * @param targetWindow 目标窗口对象
     */
    public abstract inject(targetWindow: Window): void;

    /**
     * 创建带有调试前缀的日志函数
     * @param prefix 日志前缀
     */
    protected createLogger(prefix: string = this.config.logPrefix || '[CheekyChimp]') {
        return {
            log: (...args: any[]) => console.log(prefix, ...args),
            warn: (...args: any[]) => console.warn(prefix, ...args),
            error: (...args: any[]) => console.error(prefix, ...args),
            info: (...args: any[]) => console.info(prefix, ...args),
            debug: (...args: any[]) => console.debug(prefix, ...args)
        };
    }

    /**
     * 包装用户脚本代码
     * @param sourceCode 源代码
     * @param targetWindow 目标窗口
     */
    protected wrapUserScript(sourceCode: string, targetWindow: Window): string {
        return `
        (function(window) {
            try {
                ${sourceCode}
            } catch (error) {
                console.error('[CheekyChimp] 用户脚本执行错误:', error);
            }
        })(window);
        `;
    }

    /**
     * 准备脚本注入
     * @param targetWindow 目标窗口
     */
    protected prepareInjection(targetWindow: Window): any {
        // 获取完整的GM API
        const gmAPI = this.apiFactory.createAPI();
        
        // 在目标窗口上附加API
        Object.entries(gmAPI).forEach(([key, value]) => {
            (targetWindow as any)[key] = value;
        });
        
        return gmAPI;
    }

    /**
     * 创建并注入脚本元素
     * @param scriptContent 脚本内容
     * @param targetWindow 目标窗口
     */
    protected injectScriptElement(scriptContent: string, targetWindow: Window): HTMLScriptElement {
        const document = targetWindow.document;
        const script = document.createElement('script');
        script.textContent = scriptContent;
        
        // 触发 DOMContentLoaded 后注入
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(script);
            });
        } else {
            document.head.appendChild(script);
        }
        
        return script;
    }

    /**
     * 通过Function构造函数注入
     * @param scriptContent 脚本内容
     * @param targetWindow 目标窗口
     */
    protected injectViaFunction(scriptContent: string, targetWindow: Window): void {
        // 使用全局Function构造函数而不是targetWindow.Function
        const fn = new Function('window', scriptContent);
        fn.call(null, targetWindow);
    }
} 