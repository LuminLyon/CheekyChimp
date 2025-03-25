/**
 * UserScript class representing a script managed by Tampermonkey
 */
export class UserScript {
    /** Unique identifier for the script */
    id: string;
    /** Script name from @name metadata */
    name: string;
    /** Script namespace from @namespace metadata */
    namespace: string;
    /** Script version from @version metadata */
    version: string;
    /** Script description from @description metadata */
    description: string;
    /** URLs where script should run (@include) */
    includes: string[];
    /** URLs matching patterns (@match) */
    matches: string[];
    /** URLs where script should not run (@exclude) */
    excludes: string[];
    /** Resources required by the script (@resource) */
    resources: { name: string; url: string; }[];
    /** External scripts required by the script (@require) */
    requires: string[];
    /** Script author (@author) */
    author: string;
    /** Script homepage (@homepage) */
    homepage: string;
    /** Script icon (@icon) */
    icon: string;
    /** When to run the script (@run-at) */
    runAt: 'document-start' | 'document-end' | 'document-idle';
    /** Whether the script is enabled */
    enabled: boolean;
    /** The script source code */
    source: string;
    /** Last date when the script was updated */
    lastUpdated: number;
    /** Position/order of the script */
    position: number;

    constructor() {
        this.id = '';
        this.name = '';
        this.namespace = '';
        this.version = '';
        this.description = '';
        this.includes = [];
        this.matches = [];
        this.excludes = [];
        this.resources = [];
        this.requires = [];
        this.author = '';
        this.homepage = '';
        this.icon = '';
        this.runAt = 'document-idle';
        this.enabled = true;
        this.source = '';
        this.lastUpdated = Date.now();
        this.position = 0;
    }
}

/**
 * ScriptStorage class for handling script storage and retrieval
 */
export interface ScriptStorage {
    getValue(name: string, defaultValue?: any): Promise<any>;
    setValue(name: string, value: any): Promise<void>;
    deleteValue(name: string): Promise<void>;
    listValues(): Promise<string[]>;
}

/**
 * GM_API interface defining the Greasemonkey API functions
 */
export interface GM_API {
    GM_info: any;
    GM_getValue(name: string, defaultValue?: any): any;
    GM_setValue(name: string, value: any): void;
    GM_deleteValue(name: string): void;
    GM_listValues(): string[];
    GM_getResourceText(name: string): string;
    GM_getResourceURL(name: string): string;
    GM_addStyle(css: string): void;
    GM_xmlhttpRequest(details: any): any;
    GM_registerMenuCommand(name: string, fn: Function, accessKey?: string): void;
    GM_unregisterMenuCommand(menuCmdId: number): void;
    GM_openInTab(url: string, options?: any): any;
    GM_setClipboard(data: string, info?: any): void;
    GM_notification(details: any, ondone?: Function): void;
    unsafeWindow: Window;
}

/**
 * 权限定义接口
 */
export interface ScriptPermissions {
    /** 允许跨域请求的域名列表 */
    crossOriginDomains: string[];
    /** 允许访问的本地存储键前缀 */
    storagePrefixes: string[];
    /** 允许访问的API列表 */
    allowedApis: string[];
    /** 是否允许访问剪贴板 */
    allowClipboard: boolean;
    /** 是否允许打开新标签页 */
    allowOpenInTab: boolean;
    /** 是否允许显示通知 */
    allowNotifications: boolean;
}

/**
 * 安全配置接口
 */
export interface SecurityConfig {
    /** 是否启用CSP */
    enableCSP: boolean;
    /** CSP规则 */
    cspRules: string[];
    /** 是否启用沙箱 */
    enableSandbox: boolean;
    /** 沙箱配置 */
    sandboxConfig: {
        /** 允许访问的全局对象 */
        allowedGlobals: string[];
        /** 允许访问的DOM API */
        allowedDomApis: string[];
        /** 是否允许eval */
        allowEval: boolean;
    };
}

/**
 * 用户脚本配置接口
 */
export interface ScriptConfig {
    /** 脚本权限 */
    permissions: ScriptPermissions;
    /** 安全配置 */
    security: SecurityConfig;
    /** 是否启用调试模式 */
    debug: boolean;
    /** 调试日志级别 */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
} 