import { UserScript, ScriptStorage, GM_API } from '../../models/script';

/**
 * 脚本运行阶段类型
 */
export type RunAtTiming = 'document-start' | 'document-body' | 'document-end' | 'document-idle';

/**
 * 注入结果接口
 */
export interface InjectionResult {
    success: boolean;
    scriptIds: string[];
    count?: number;
    error?: string;
}

/**
 * 脚本预处理结果
 */
export interface ScriptPreprocessResult {
    processedCode: string;
    resources: {
        loaded: string[];
        failed: string[];
    };
    requires: {
        loaded: string[];
        failed: string[];
    };
}

/**
 * 资源定义接口
 */
export interface ResourceDefinition {
    name: string;
    url: string;
}

/**
 * 注入选项接口
 */
export interface InjectionOptions {
    timeout?: number;
    retryCount?: number;
    forceInjection?: boolean;
}

/**
 * GM菜单命令接口
 */
export interface MenuCommand {
    id: number;
    name: string;
    fn: Function;
    accessKey?: string;
}

/**
 * 注入器接口，定义注入器必须实现的方法
 */
export interface Injector {
    injectScripts(webview: HTMLElement, url: string, scripts: UserScript[]): Promise<void>;
    injectScript(webview: HTMLElement, url: string, script: UserScript): Promise<InjectionResult>;
}

/**
 * 注入错误类型，用于统一错误处理
 */
export class InjectionError extends Error {
    constructor(
        message: string,
        public readonly scriptId?: string,
        public readonly recoverable: boolean = false
    ) {
        super(message);
        this.name = 'InjectionError';
    }
}

/**
 * 脚本注入选项
 */
export interface ScriptInjectionOptions {
    /**
     * 是否开启调试日志
     */
    debug?: boolean;
    
    /**
     * iframe相关选项
     */
    iframe?: IframeInjectionOptions;
    
    /**
     * webview相关选项
     */
    webview?: WebviewInjectionOptions;
    
    /**
     * 资源加载选项
     */
    resources?: {
        /**
         * 是否预加载资源
         */
        preload?: boolean;
        
        /**
         * 缓存时间，单位为毫秒
         */
        cacheTime?: number;
    };
}

/**
 * 脚本匹配结果
 */
export interface ScriptMatchResult {
    /**
     * 是否匹配
     */
    matches: boolean;
    
    /**
     * 匹配的脚本列表
     */
    scripts: UserScript[];
}

/**
 * 资源缓存项
 */
export interface ResourceCacheItem {
    /**
     * 资源内容
     */
    content: string;
    
    /**
     * 缓存时间
     */
    timestamp: number;
}

/**
 * 注入上下文
 */
export interface InjectionContext {
    /**
     * 当前页面的URL
     */
    url: string;
    
    /**
     * 当前页面的原始域
     */
    origin: string;
    
    /**
     * 注入目标类型
     */
    targetType: 'main' | 'iframe' | 'webview';
    
    /**
     * 触发阶段
     */
    stage: 'document-start' | 'document-body' | 'document-end' | 'document-idle';
    
    /**
     * 相关DOM事件
     */
    event?: Event;
}

/**
 * 资源加载结果
 */
export interface ResourceLoadResult {
    /**
     * 是否成功加载
     */
    success: boolean;
    
    /**
     * 资源内容
     */
    content?: string;
    
    /**
     * 错误信息，如果有
     */
    error?: string;
}

/**
 * 沙盒环境配置
 */
export interface SandboxConfig {
    /**
     * 是否隔离DOM访问
     */
    isolateDOM?: boolean;
    
    /**
     * 是否允许网络请求
     */
    allowNetworkRequests?: boolean;
    
    /**
     * 允许访问的全局对象列表
     */
    allowedGlobals?: string[];
    
    /**
     * 超时时间，单位为毫秒
     */
    timeout?: number;
}

/**
 * 注入方法类型
 */
export type InjectionMethod = 'eval' | 'script-tag' | 'userscript' | 'iframe-messaging';

/**
 * 事件监听器配置
 */
export interface EventListenerConfig {
    /**
     * 事件类型
     */
    type: string;
    
    /**
     * 处理函数
     */
    handler: EventListener;
    
    /**
     * 事件选项
     */
    options?: boolean | AddEventListenerOptions;
}

/**
 * 监听的事件列表
 */
export interface EventMonitor {
    /**
     * 已注册的事件监听器
     */
    listeners: EventListenerConfig[];
    
    /**
     * 添加事件监听器
     */
    add(type: string, handler: EventListener, options?: boolean | AddEventListenerOptions): void;
    
    /**
     * 移除事件监听器
     */
    remove(type: string, handler: EventListener): void;
    
    /**
     * 移除所有事件监听器
     */
    removeAll(): void;
}

/**
 * iframe注入相关选项
 */
export interface IframeInjectionOptions {
    /**
     * 是否启用iframe注入
     */
    enabled: boolean;
    
    /**
     * 是否只注入同源iframe
     */
    sameOriginOnly?: boolean;
    
    /**
     * 是否允许使用srcdoc覆盖跨域iframe内容
     * 注意: 这会修改iframe的内容,可能导致原始内容无法正常工作
     */
    allowSrcDocOverride?: boolean;
}

/**
 * webview注入相关选项
 */
export interface WebviewInjectionOptions {
    /**
     * 是否启用webview注入
     */
    enabled: boolean;
    
    /**
     * 是否尝试注入到不支持executeJavaScript的webview
     */
    fallbackInjection?: boolean;
} 