import { InjectorBase, InjectorConfig } from './InjectorBase';

/**
 * 直接脚本注入器
 * 用于直接注入脚本到当前页面
 */
export class DirectInjector extends InjectorBase {
    private logger = this.createLogger('[DirectInjector]');

    constructor(config: InjectorConfig) {
        super(config);
    }

    /**
     * 注入脚本到目标窗口
     * @param targetWindow 目标窗口对象
     */
    public inject(targetWindow: Window): void {
        this.logger.info('准备直接注入脚本...');
        
        try {
            // 准备API
            this.prepareInjection(targetWindow);
            
            // 包装用户脚本
            const wrappedScript = this.wrapUserScript(this.config.sourceCode, targetWindow);
            
            // 注入脚本
            this.injectScriptElement(wrappedScript, targetWindow);
            
            this.logger.info('直接注入脚本成功');
        } catch (error) {
            this.logger.error('直接注入脚本失败:', error);
        }
    }
}