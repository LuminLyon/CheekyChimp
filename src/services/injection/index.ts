// 导出主要类
export { ScriptInjector } from './ScriptInjector';
export { IframeInjector } from './IframeInjector';
export { WebviewInjector } from './WebviewInjector';
export { GMApiFactory } from './GMApiFactory';

// 导出工具函数
export {
    logPrefix,
    extractConnectDomains,
    isConnectAllowed,
    getScriptMetaStr,
    checkScriptMatch,
    patternToRegex,
    matchPattern,
    generateRandomId,
    createSandbox,
    extractUrlInfo,
    getScriptRunAtTiming
} from './utils';

// 导出类型
export type {
    MenuCommand,
    ScriptInjectionOptions,
    ScriptMatchResult,
    ResourceCacheItem,
    InjectionContext,
    InjectionResult,
    ResourceLoadResult,
    SandboxConfig,
    InjectionMethod,
    EventListenerConfig,
    EventMonitor,
    RunAtTiming
} from './types'; 