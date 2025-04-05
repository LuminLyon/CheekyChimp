import { UserScript } from '../../models/script';
import { ResourceDefinition, ScriptPreprocessResult } from './types';
import { logPrefix } from './utils';

/**
 * 资源管理器，负责处理脚本的外部资源和依赖
 */
export class ResourceManager {
    /**
     * 缓存已加载的外部资源
     */
    private resourceCache: {[url: string]: string} = {};
    
    /**
     * 从脚本中提取@require和@resource标签
     */
    public extractResources(script: UserScript): {
        requires: string[],
        resources: ResourceDefinition[]
    } {
        const result = {
            requires: [] as string[],
            resources: [] as ResourceDefinition[]
        };
        
        // 从脚本源码中提取
        const requireMatches = Array.from(script.source.matchAll(/\/\/ @require\s+(https?:\/\/\S+)/g));
        const resourceMatches = Array.from(script.source.matchAll(/\/\/ @resource\s+(\S+)\s+(https?:\/\/\S+)/g));
        
        // 处理@require
        requireMatches.forEach(match => {
            if (match[1]) result.requires.push(match[1]);
        });
        
        // 处理@resource
        resourceMatches.forEach(match => {
            if (match[1] && match[2]) {
                result.resources.push({
                    name: match[1],
                    url: match[2]
                });
            }
        });
        
        // 合并脚本的requires属性
        if (script.requires && Array.isArray(script.requires)) {
            result.requires = [...new Set([...result.requires, ...script.requires])];
        }
        
        // 处理脚本的resources属性
        if (script.resources && Array.isArray(script.resources)) {
            script.resources.forEach(resource => {
                if (resource && resource.name && resource.url) {
                    result.resources.push(resource);
                }
            });
        }
        
        return result;
    }
    
    /**
     * 加载外部资源
     */
    public async loadExternalResource(url: string): Promise<string> {
        // 检查缓存
        if (this.resourceCache[url]) {
            return this.resourceCache[url];
        }
        
        try {
            console.log(`${logPrefix('ResourceManager')}: 加载外部资源 ${url}`);
            const response = await fetch(url, {
                cache: 'force-cache',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const content = await response.text();
            this.resourceCache[url] = content;
            console.log(`${logPrefix('ResourceManager')}: 已加载资源 ${url}`);
            return content;
        } catch (error) {
            console.error(`${logPrefix('ResourceManager')}: 加载资源失败 ${url}:`, error);
            return '';
        }
    }
    
    /**
     * 预处理脚本，处理外部依赖
     */
    public async preprocessScript(script: UserScript): Promise<ScriptPreprocessResult> {
        const { requires, resources } = this.extractResources(script);
        const result: ScriptPreprocessResult = {
            processedCode: script.source,
            resources: { loaded: [], failed: [] },
            requires: { loaded: [], failed: [] }
        };
        
        // 处理@resource
        let resourceCode = '';
        for (const resource of resources) {
            try {
                const content = await this.loadExternalResource(resource.url);
                if (content) {
                    resourceCode += `
                    // 注入资源: ${resource.name} 从 ${resource.url}
                    if (!window._gmResourceCache) window._gmResourceCache = {};
                    window._gmResourceCache['${resource.name}'] = ${JSON.stringify(content)};
                    
                    // 添加GM_getResourceText支持
                    if (!window.GM_getResourceText) {
                        window.GM_getResourceText = function(resourceName) {
                            return window._gmResourceCache[resourceName] || '';
                        };
                    }
                    `;
                    result.resources.loaded.push(resource.name);
                } else {
                    result.resources.failed.push(resource.name);
                }
            } catch (error) {
                console.error(`${logPrefix('ResourceManager')}: 处理资源失败 ${resource.name}:`, error);
                result.resources.failed.push(resource.name);
            }
        }
        
        // 处理@require
        let requireCode = '';
        for (const requireUrl of requires) {
            try {
                const content = await this.loadExternalResource(requireUrl);
                if (content) {
                    requireCode += `
                    // 注入依赖: ${requireUrl}
                    try {
                        ${content}
                    } catch(e) {
                        console.error('${logPrefix('ResourceManager')}: 执行依赖脚本失败:', e);
                    }
                    `;
                    result.requires.loaded.push(requireUrl);
                } else {
                    result.requires.failed.push(requireUrl);
                }
            } catch (error) {
                console.error(`${logPrefix('ResourceManager')}: 处理依赖失败 ${requireUrl}:`, error);
                result.requires.failed.push(requireUrl);
            }
        }
        
        // 组合最终代码
        result.processedCode = `
        // ==UserScript 预处理代码==
        (function() {
            // 资源和依赖初始化
            ${resourceCode}
            
            // 外部依赖
            ${requireCode}
            
            // 原始脚本
            ${script.source}
        })();
        `;
        
        return result;
    }
} 