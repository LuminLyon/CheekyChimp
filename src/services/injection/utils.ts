import { UserScript } from '../../models/script';
import { RunAtTiming } from './types';

/**
 * 创建日志前缀，用于在日志中标识不同的组件
 */
export function logPrefix(name: string): string {
    return `[CheekyChimp:${name}]`;
}

/**
 * 从脚本源代码中提取@connect域名
 */
export function extractConnectDomains(scriptSource: string): string[] {
    const connectDomains = new Set<string>();
    
    // 基本规则：从元数据注释中提取@connect域名
    const connectRegex = /\/\/\s*@connect\s+([^\s]+)/g;
    let match;
    
    while ((match = connectRegex.exec(scriptSource)) !== null) {
        connectDomains.add(match[1]);
    }
    
    // 添加允许所有域名的标志 '*'
    if (scriptSource.includes('// @connect *')) {
        connectDomains.add('*');
    }
    
    return Array.from(connectDomains);
}

/**
 * 检查URL主机名是否允许连接
 */
export function isConnectAllowed(hostname: string, connectDomains: string[]): boolean {
    // 如果连接域允许所有域名，直接返回true
    if (connectDomains.includes('*') || connectDomains.includes('localhost')) {
        return true;
    }
    
    // 检查主机名是否直接匹配
    if (connectDomains.includes(hostname)) {
        return true;
    }
    
    // 检查主机名是否为子域名
    for (const domain of connectDomains) {
        // 跳过IP地址匹配
        if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
            if (domain === hostname) {
                return true;
            }
            continue;
        }
        
        // 子域名匹配
        if (hostname.endsWith('.' + domain)) {
            return true;
        }
    }
    
    return false;
}

/**
 * 生成脚本元数据字符串
 */
export function getScriptMetaStr(script: UserScript): string {
    const metaParts = [];
    
    // 基本元数据
    metaParts.push(`// ==UserScript==`);
    metaParts.push(`// @name ${script.name}`);
    
    if (script.namespace) {
        metaParts.push(`// @namespace ${script.namespace}`);
    }
    
    if (script.version) {
        metaParts.push(`// @version ${script.version}`);
    }
    
    if (script.description) {
        metaParts.push(`// @description ${script.description}`);
    }
    
    if (script.author) {
        metaParts.push(`// @author ${script.author}`);
    }
    
    // 匹配规则
    script.includes.forEach(include => {
        metaParts.push(`// @include ${include}`);
    });
    
    script.matches.forEach(match => {
        metaParts.push(`// @match ${match}`);
    });
    
    script.excludes.forEach(exclude => {
        metaParts.push(`// @exclude ${exclude}`);
    });
    
    // 资源和需求
    script.requires.forEach(require => {
        metaParts.push(`// @require ${require}`);
    });
    
    script.resources.forEach(resource => {
        metaParts.push(`// @resource ${resource.name} ${resource.url}`);
    });
    
    // 其他选项
    if (script.runAt) {
        metaParts.push(`// @run-at ${script.runAt}`);
    }
    
    // Connect规则
    const connectDomains = extractConnectDomains(script.source);
    connectDomains.forEach(domain => {
        metaParts.push(`// @connect ${domain}`);
    });
    
    // 授权
    metaParts.push(`// @grant unsafeWindow`);
    metaParts.push(`// @grant GM_getValue`);
    metaParts.push(`// @grant GM_setValue`);
    metaParts.push(`// @grant GM_deleteValue`);
    metaParts.push(`// @grant GM_listValues`);
    metaParts.push(`// @grant GM_getResourceText`);
    metaParts.push(`// @grant GM_getResourceURL`);
    metaParts.push(`// @grant GM_addStyle`);
    metaParts.push(`// @grant GM_registerMenuCommand`);
    metaParts.push(`// @grant GM_unregisterMenuCommand`);
    metaParts.push(`// @grant GM_xmlhttpRequest`);
    metaParts.push(`// @grant GM_openInTab`);
    metaParts.push(`// @grant GM_setClipboard`);
    metaParts.push(`// @grant GM_notification`);
    
    metaParts.push(`// ==/UserScript==`);
    
    return metaParts.join('\n');
}

/**
 * 检查页面是否匹配脚本
 */
export function checkScriptMatch(script: UserScript, url: string): boolean {
    if (!script.matches || script.matches.length === 0) {
        return false;
    }
    
    if (!script.enabled) {
        return false;
    }
    
    return script.matches.some(pattern => {
        return matchPattern(pattern, url);
    });
}

/**
 * 将Tampermonkey/Greasemonkey样式的URL模式转换为正则表达式
 */
export function patternToRegex(pattern: string): RegExp {
    // 特殊情况：通配符 *
    if (pattern === '*') {
        return /.*/;
    }
    
    // 处理 @match 规则
    if (pattern.includes('://')) {
        return matchPatternToRegex(pattern);
    }
    
    // 处理简单的 @include/@exclude 规则（只包含通配符 * 和 ? 的URL）
    let regexStr = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
        .replace(/\*/g, '.*')                  // * -> .*
        .replace(/\?/g, '.');                  // ? -> .
    
    return new RegExp(`^${regexStr}$`);
}

/**
 * 将 @match 模式转换为正则表达式
 * 处理 scheme://host/path 格式的规则
 */
function matchPatternToRegex(pattern: string): RegExp {
    // 处理特殊的"全部"匹配
    if (pattern === '*://*/*') {
        return /^(http|https):\/\/.*/;
    }
    
    // 解析匹配模式
    const match = /^((\*|http|https|file|ftp):\/\/)((\*|(?:\*\.)?[^/*]+)?)\/(.*)$/.exec(pattern);
    if (!match) {
        throw new Error(`无效的匹配模式: ${pattern}`);
    }
    
    const [, , scheme, , host, path] = match;
    
    // 构建正则表达式组件
    let regexStr = '^';
    
    // 协议
    if (scheme === '*') {
        regexStr += '(http|https)';
    } else {
        regexStr += scheme;
    }
    regexStr += '://';
    
    // 主机
    if (host === '*') {
        regexStr += '[^/]*';
    } else if (host.startsWith('*.')) {
        // 子域名 (*.example.com)
        const domainPart = host.substring(2);
        regexStr += '([^/]*\\.)?' + escapeRegExp(domainPart);
    } else {
        regexStr += escapeRegExp(host);
    }
    
    // 路径
    if (path === '*') {
        regexStr += '(/.*)?';
    } else if (path === '') {
        regexStr += '/?';
    } else {
        regexStr += '/' + path.split('*').map(escapeRegExp).join('.*');
    }
    
    regexStr += '$';
    return new RegExp(regexStr);
}

/**
 * 对正则表达式特殊字符进行转义
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 检查URL是否匹配指定的模式
 */
export function matchPattern(pattern: string, url: string): boolean {
    // 如果是正则表达式模式 (以/开头和结尾)
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
        try {
            const regex = new RegExp(pattern.slice(1, -1));
            return regex.test(url);
        } catch (e) {
            console.error(`无效的正则表达式: ${pattern}`, e);
            return false;
        }
    }
    
    // Tampermonkey/Greasemonkey 风格的通配符匹配
    try {
        const escapedPattern = pattern
            .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') // 转义特殊字符
            .replace(/\\\*/g, '.*') // * 转为 .*
            .replace(/\\\?/g, '.'); // ? 转为 .

        const regex = new RegExp(`^${escapedPattern}$`);
        return regex.test(url);
    } catch (e) {
        console.error(`无效的匹配模式: ${pattern}`, e);
        return false;
    }
}

/**
 * 生成随机ID
 */
export function generateRandomId(length: number = 12): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
}

/**
 * 创建沙盒隔离
 */
export function createSandbox(code: string, sandboxGlobals: Record<string, any>): Function {
    const globalKeys = Object.keys(sandboxGlobals);
    const globalValues = Object.values(sandboxGlobals);
    
    // 创建一个函数，将全局变量作为参数传入，然后执行代码
    try {
        const sandboxFn = new Function(...globalKeys, code);
        return () => sandboxFn.apply(null, globalValues);
    } catch (error) {
        console.error(`${logPrefix('Utils')}: 创建沙盒失败:`, error);
        return () => {
            throw new Error(`沙盒创建失败: ${error}`);
        };
    }
}

/**
 * 从URL中提取基本信息
 */
export function extractUrlInfo(url: string): { origin: string; protocol: string; host: string; pathname: string } {
    try {
        const urlObj = new URL(url);
        return {
            origin: urlObj.origin,
            protocol: urlObj.protocol,
            host: urlObj.host,
            pathname: urlObj.pathname
        };
    } catch (e) {
        console.warn(`${logPrefix('Utils')}: 解析URL失败:`, e);
        return {
            origin: '',
            protocol: '',
            host: '',
            pathname: ''
        };
    }
}

/**
 * 获取脚本的运行时机
 */
export function getScriptRunAtTiming(script: UserScript): RunAtTiming {
    return script.runAt || 'document-idle';
}

/**
 * 工具函数：检查传入的注入参数是否有效
 */
export function validateInjectionParams(webview: HTMLElement, url: string, scripts: UserScript[]): boolean {
    if (!webview) {
        console.warn('CheekyChimp: 注入失败: webview为空');
        return false;
    }
    
    if (!url) {
        console.warn('CheekyChimp: 注入失败: URL为空');
        return false;
    }
    
    if (!scripts || scripts.length === 0) {
        console.info('CheekyChimp: 没有可注入的脚本');
        return false;
    }
    
    return true;
}

/**
 * 工具函数：根据runAt属性对脚本进行分组
 */
export function groupScriptsByRunAt(scripts: UserScript[]): {
    documentStart: UserScript[],
    documentEnd: UserScript[],
    documentIdle: UserScript[]
} {
    return {
        documentStart: scripts.filter(s => s.runAt === 'document-start'),
        documentEnd: scripts.filter(s => s.runAt === 'document-end'),
        documentIdle: scripts.filter(s => s.runAt === 'document-idle' || !s.runAt)
    };
} 