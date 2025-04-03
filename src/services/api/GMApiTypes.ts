/**
 * GM XMLHttpRequest 详情
 */
export interface GMXmlHttpRequestDetails {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
    headers?: Record<string, string>;
    data?: string | FormData;
    timeout?: number;
    responseType?: XMLHttpRequestResponseType;
    overrideMimeType?: string;
    anonymous?: boolean;
    withCredentials?: boolean;
    onload?: (response: GMXmlHttpRequestResponse) => void;
    onerror?: (error: any) => void;
    onabort?: () => void;
    ontimeout?: () => void;
}

/**
 * GM XMLHttpRequest 响应
 */
export interface GMXmlHttpRequestResponse {
    responseText: string;
    response: any;
    status: number;
    statusText: string;
    readyState: number;
    responseHeaders: string;
    finalUrl: string;
}

/**
 * GM 通知详情
 */
export interface GMNotificationDetails {
    text: string;
    title?: string;
    image?: string;
    onclick?: () => void;
    ondone?: () => void;
}

/**
 * GM 菜单命令
 */
export interface GMMenuCommand {
    id: number;
    name: string;
    callback: () => void;
    accessKey?: string;
}

/**
 * GM Info对象
 */
export interface GMInfo {
    script: {
        name: string;
        namespace: string;
        description: string;
        version: string;
        includes: string[];
        excludes: string[];
        matches: string[];
        resources: Array<{name: string; url: string}>;
        requires: string[];
    };
    version: string;
    scriptHandler: string;
    scriptMetaStr: string;
}

/**
 * GM资源定义
 */
export interface GMResourceDefinition {
    name: string;
    url: string;
    content?: string;
    loaded: boolean;
}

/**
 * 旧版GM API接口
 */
export interface GMFunctions {
    GM_info: GMInfo;
    GM_getValue(name: string, defaultValue?: any): any;
    GM_setValue(name: string, value: any): void;
    GM_deleteValue(name: string): void;
    GM_listValues(): string[];
    GM_getResourceText(name: string): string;
    GM_getResourceURL(name: string): string;
    GM_addStyle(css: string): HTMLStyleElement | void;
    GM_xmlhttpRequest(details: GMXmlHttpRequestDetails): { abort: () => void };
    GM_registerMenuCommand(name: string, fn: Function, accessKey?: string): number;
    GM_unregisterMenuCommand(menuCmdId: number): void;
    GM_openInTab(url: string, options?: { active?: boolean; insert?: boolean; setParent?: boolean }): void;
    GM_setClipboard(data: string, info?: { type?: string; mimetype?: string }): void;
    GM_notification(details: GMNotificationDetails | string, ondone?: () => void): void;
    GM_addElement?(tagName: string, attributes: Record<string, any>): HTMLElement;
    unsafeWindow: Window;
}

/**
 * 新版GM API接口
 */
export interface GMNewFunctions {
    info: GMInfo;
    getValue(name: string, defaultValue?: any): Promise<any>;
    setValue(name: string, value: any): Promise<void>;
    deleteValue(name: string): Promise<void>;
    listValues(): Promise<string[]>;
    getResourceUrl(name: string): Promise<string>;
    xmlHttpRequest(details: GMXmlHttpRequestDetails): { abort: () => void };
    addStyle(css: string): Promise<HTMLStyleElement>;
    registerMenuCommand(name: string, fn: Function, accessKey?: string): Promise<number>;
    unregisterMenuCommand(menuCmdId: number): Promise<void>;
    openInTab(url: string, options?: { active?: boolean; insert?: boolean; setParent?: boolean }): Promise<void>;
    setClipboard(data: string, info?: { type?: string; mimetype?: string }): Promise<void>;
    notification(details: GMNotificationDetails | string, ondone?: () => void): Promise<void>;
}

/**
 * 完整的GM API接口
 */
export interface GM_API extends GMFunctions {
    GM?: GMNewFunctions;
} 