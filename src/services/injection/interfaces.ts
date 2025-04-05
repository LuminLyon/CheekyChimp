import { UserScript } from '../../models/script';
import { InjectionResult, InjectionContext } from './types';

/**
 * 基础注入器接口
 * 定义所有注入器必须实现的核心方法
 */
export interface BaseInjector {
    /**
     * 初始化注入器
     * 设置观察器、处理现有元素等
     */
    initialize(): Promise<void>;

    /**
     * 清理注入器资源
     * 断开观察器、清理内部状态等
     */
    cleanup(): void;

    /**
     * 向目标元素注入单个脚本
     * @param target 目标HTML元素（webview或iframe）
     * @param script 要注入的用户脚本
     * @param context 注入上下文信息
     */
    injectScript(target: HTMLElement, script: UserScript, context: InjectionContext): Promise<InjectionResult>;

    /**
     * 获取已注入的脚本ID列表
     */
    getInjectedScriptIds(): string[];
} 