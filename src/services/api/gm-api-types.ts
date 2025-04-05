import { UserScript } from '../../models/script';

/**
 * XMLHttpRequest详情接口
 */
export interface XMLHttpRequestDetails {
  /** 请求URL */
  url: string;
  /** 请求方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求数据 */
  data?: string | FormData | Blob;
  /** 是否发送凭据（如cookies） */
  withCredentials?: boolean;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 响应类型 */
  responseType?: 'text' | 'json' | 'arraybuffer' | 'blob';
  /** 请求完成回调 */
  onload?: (response: XMLHttpRequestResponse) => void;
  /** 请求失败回调 */
  onerror?: (error: Error) => void;
  /** 请求超时回调 */
  ontimeout?: () => void;
  /** 请求取消回调 */
  onabort?: () => void;
  /** 请求状态变化回调 */
  onreadystatechange?: (response: XMLHttpRequestResponse) => void;
}

/**
 * XMLHttpRequest响应接口
 */
export interface XMLHttpRequestResponse {
  /** 最终URL（考虑重定向） */
  finalUrl: string;
  /** 请求状态 */
  readyState: number;
  /** HTTP状态码 */
  status: number;
  /** HTTP状态文本 */
  statusText: string;
  /** 响应头 */
  responseHeaders: string;
  /** 响应文本 */
  responseText: string;
  /** 响应对象 */
  response: any;
}

/**
 * XMLHttpRequest控制对象
 */
export interface XMLHttpRequestControl {
  /** 中止请求 */
  abort: () => void;
}

/**
 * 通知详情接口
 */
export interface NotificationDetails {
  /** 通知文本 */
  text: string;
  /** 通知标题 */
  title?: string;
  /** 通知图标 */
  image?: string;
  /** 通知超时（毫秒） */
  timeout?: number;
  /** 点击通知回调 */
  onclick?: () => void;
  /** 关闭通知回调 */
  ondone?: () => void;
}

/**
 * 标签页打开选项
 */
export interface TabOptions {
  /** 是否激活新标签页 */
  active?: boolean;
  /** 是否在后台打开 */
  insert?: boolean;
  /** 标签页打开位置 */
  setParent?: boolean;
}

/**
 * GM_info对象
 */
export interface GMInfo {
  /** 脚本信息 */
  script: {
    /** 脚本名称 */
    name: string;
    /** 脚本命名空间 */
    namespace: string;
    /** 脚本描述 */
    description: string;
    /** 脚本版本 */
    version: string;
    /** 包含URL列表 */
    includes: string[];
    /** 排除URL列表 */
    excludes: string[];
    /** 匹配URL列表 */
    matches: string[];
    /** 资源列表 */
    resources: { name: string; url: string; }[];
    /** 依赖列表 */
    requires: string[];
  };
  /** 脚本处理器版本 */
  version: string;
  /** 脚本处理器名称 */
  scriptHandler: string;
  /** 脚本元数据字符串 */
  scriptMetaStr: string;
}

/**
 * GM_API 接口，定义所有Greasemonkey API函数
 */
export interface GM_API {
  /** GM信息对象 */
  GM_info: GMInfo;
  
  /** 获取存储的值 */
  GM_getValue(name: string, defaultValue?: any): any;
  
  /** 设置存储的值 */
  GM_setValue(name: string, value: any): void;
  
  /** 删除存储的值 */
  GM_deleteValue(name: string): void;
  
  /** 列出所有存储的键 */
  GM_listValues(): string[];
  
  /** 获取资源文本 */
  GM_getResourceText(name: string): string;
  
  /** 获取资源URL */
  GM_getResourceURL(name: string): string;
  
  /** 添加CSS样式 */
  GM_addStyle(css: string): HTMLStyleElement | void;
  
  /** 发送XMLHttpRequest请求 */
  GM_xmlhttpRequest(details: XMLHttpRequestDetails): XMLHttpRequestControl | null;
  
  /** 注册菜单命令 */
  GM_registerMenuCommand(name: string, fn: Function, accessKey?: string): number;
  
  /** 注销菜单命令 */
  GM_unregisterMenuCommand(menuCmdId: number): void;
  
  /** 在新标签页打开URL */
  GM_openInTab(url: string, options?: TabOptions | boolean): { close: () => void } | null;
  
  /** 设置剪贴板内容 */
  GM_setClipboard(data: string, info?: string | { type?: string; mimetype?: string }): void;
  
  /** 显示通知 */
  GM_notification(details: NotificationDetails | string, title?: string, image?: string, onclick?: () => void): void;
  
  /** 添加DOM元素 */
  GM_addElement?(tagName: string, attributes: Record<string, string>): HTMLElement;
  
  /** 不安全的Window对象 */
  unsafeWindow: Window;
  
  /** GM命名空间（新API） */
  GM?: {
    /** 获取存储的值（异步） */
    getValue(name: string, defaultValue?: any): Promise<any>;
    
    /** 设置存储的值（异步） */
    setValue(name: string, value: any): Promise<void>;
    
    /** 删除存储的值（异步） */
    deleteValue(name: string): Promise<void>;
    
    /** 列出所有存储的键（异步） */
    listValues(): Promise<string[]>;
    
    /** 发送XMLHttpRequest请求 */
    xmlHttpRequest(details: XMLHttpRequestDetails): XMLHttpRequestControl | null;
    
    /** 添加CSS样式（异步） */
    addStyle(css: string): Promise<HTMLStyleElement>;
    
    /** 注册菜单命令（异步） */
    registerMenuCommand(name: string, fn: Function, accessKey?: string): Promise<number>;
    
    /** 添加DOM元素（异步） */
    addElement(tagName: string, attributes: Record<string, string>): Promise<HTMLElement>;
  };
} 