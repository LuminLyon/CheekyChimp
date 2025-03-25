import { UserScript, ScriptStorage, GM_API } from '../models/script';

/**
 * 创建GM API实现
 */
export class GmApiService {
    constructor(private scriptStorage: ScriptStorage) {}
    
    /**
     * 为脚本创建GM API对象
     * @param script 用户脚本
     * @param url 当前页面URL
     */
    async createGmApi(script: UserScript, url: string): Promise<GM_API> {
        // 创建GM info对象
        const info = {
            script: {
                name: script.name,
                namespace: script.namespace,
                description: script.description,
                version: script.version,
                includes: script.includes,
                excludes: script.excludes,
                matches: script.matches,
                resources: script.resources,
                requires: script.requires
            },
            version: '0.1.0', // 插件版本
            scriptHandler: 'Obsidian Tampermonkey',
            scriptMetaStr: this.getScriptMetaStr(script)
        };
        
        // 创建脚本的存储命名空间
        const scriptStorage = {
            getValue: async (name: string, defaultValue?: any): Promise<any> => {
                const key = `${script.id}:${name}`;
                return await this.scriptStorage.getValue(key, defaultValue);
            },
            setValue: async (name: string, value: any): Promise<void> => {
                const key = `${script.id}:${name}`;
                await this.scriptStorage.setValue(key, value);
            },
            deleteValue: async (name: string): Promise<void> => {
                const key = `${script.id}:${name}`;
                await this.scriptStorage.deleteValue(key);
            },
            listValues: async (): Promise<string[]> => {
                const allKeys = await this.scriptStorage.listValues();
                const prefix = `${script.id}:`;
                return allKeys
                    .filter(key => key.startsWith(prefix))
                    .map(key => key.substring(prefix.length));
            }
        };
        
        // 创建GM API
        return {
            GM_info: info,
            
            // 存储函数
            GM_getValue: (name: string, defaultValue?: any): any => {
                // 实现同步版本，带默认值
                return localStorage.getItem(`tampermonkey:${script.id}:${name}`) || defaultValue;
            },
            GM_setValue: (name: string, value: any): void => {
                localStorage.setItem(`tampermonkey:${script.id}:${name}`, value);
                scriptStorage.setValue(name, value);
            },
            GM_deleteValue: (name: string): void => {
                localStorage.removeItem(`tampermonkey:${script.id}:${name}`);
                scriptStorage.deleteValue(name);
            },
            GM_listValues: (): string[] => {
                // 这是一个同步函数，但我们的存储是异步的
                // 暂时从localStorage返回缓存的值
                const keys = [];
                const prefix = `tampermonkey:${script.id}:`;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keys.push(key.substring(prefix.length));
                    }
                }
                return keys;
            },
            
            // 资源函数
            GM_getResourceText: (name: string): string => {
                // 待实现
                console.warn('GM_getResourceText 尚未完全实现');
                return '';
            },
            GM_getResourceURL: (name: string): string => {
                // 待实现
                console.warn('GM_getResourceURL 尚未完全实现');
                return '';
            },
            
            // UI函数
            GM_addStyle: (css: string): void => {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            },
            GM_registerMenuCommand: (name: string, fn: Function, accessKey?: string): void => {
                // 待实现
                console.warn('GM_registerMenuCommand 尚未完全实现');
            },
            GM_unregisterMenuCommand: (menuCmdId: number): void => {
                // 待实现
                console.warn('GM_unregisterMenuCommand 尚未完全实现');
            },
            
            // 网络函数
            GM_xmlhttpRequest: (details: any): any => {
                // 需要在Obsidian中进行特殊处理
                console.warn('GM_xmlhttpRequest 尚未完全实现');
                return null;
            },
            
            // 其他函数
            GM_openInTab: (url: string, options?: any): any => {
                // 需要使用Obsidian的API
                console.warn('GM_openInTab 尚未完全实现');
                window.open(url, '_blank');
                return null;
            },
            GM_setClipboard: (data: string, info?: any): void => {
                // 使用剪贴板API
                navigator.clipboard.writeText(data)
                    .catch(err => console.error('复制文本失败: ', err));
            },
            GM_notification: (details: any, ondone?: Function): void => {
                // 需要使用Obsidian的通知API
                console.warn('GM_notification 尚未完全实现');
                alert(typeof details === 'string' ? details : details.text);
            },
            
            // 访问window对象
            unsafeWindow: window as any
        };
    }
    
    /**
     * 从脚本中提取元数据字符串
     */
    private getScriptMetaStr(script: UserScript): string {
        const metaLines = [];
        
        metaLines.push('// ==UserScript==');
        
        if (script.name) metaLines.push(`// @name ${script.name}`);
        if (script.namespace) metaLines.push(`// @namespace ${script.namespace}`);
        if (script.version) metaLines.push(`// @version ${script.version}`);
        if (script.description) metaLines.push(`// @description ${script.description}`);
        if (script.author) metaLines.push(`// @author ${script.author}`);
        if (script.homepage) metaLines.push(`// @homepage ${script.homepage}`);
        if (script.icon) metaLines.push(`// @icon ${script.icon}`);
        
        script.includes.forEach(include => {
            metaLines.push(`// @include ${include}`);
        });
        
        script.matches.forEach(match => {
            metaLines.push(`// @match ${match}`);
        });
        
        script.excludes.forEach(exclude => {
            metaLines.push(`// @exclude ${exclude}`);
        });
        
        script.requires.forEach(require => {
            metaLines.push(`// @require ${require}`);
        });
        
        script.resources.forEach(resource => {
            metaLines.push(`// @resource ${resource.name} ${resource.url}`);
        });
        
        if (script.runAt) metaLines.push(`// @run-at ${script.runAt}`);
        
        metaLines.push('// ==/UserScript==');
        
        return metaLines.join('\n');
    }
} 