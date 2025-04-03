import { GMResourceDefinition } from '../api/GMApiTypes';

/**
 * 资源加载器
 */
export class ResourceLoader {
    private resources: Map<string, GMResourceDefinition> = new Map();
    private resourceCache: Map<string, string> = new Map();
    private blobCache: Map<string, string> = new Map();

    /**
     * 构造函数
     * @param resourceDefinitions 资源定义
     */
    constructor(resourceDefinitions: GMResourceDefinition[] = []) {
        this.initResources(resourceDefinitions);
    }

    /**
     * 初始化资源
     * @param resourceDefinitions 资源定义
     */
    public initResources(resourceDefinitions: GMResourceDefinition[]): void {
        resourceDefinitions.forEach(resource => {
            this.resources.set(resource.name, {
                ...resource,
                loaded: resource.content !== undefined
            });
        });
    }

    /**
     * 获取资源文本
     * @param name 资源名称
     */
    public getResourceText(name: string): string {
        if (!this.resources.has(name)) {
            console.warn(`资源不存在: ${name}`);
            return '';
        }

        // 如果缓存中已有数据，直接返回
        if (this.resourceCache.has(name)) {
            return this.resourceCache.get(name) || '';
        }

        // 获取资源定义
        const resource = this.resources.get(name)!;

        // 如果资源已加载，直接返回内容
        if (resource.loaded && resource.content !== undefined) {
            this.resourceCache.set(name, resource.content);
            return resource.content;
        }

        // 尝试加载资源
        this.loadResource(name);
        return '';
    }

    /**
     * 获取资源URL
     * @param name 资源名称
     */
    public getResourceURL(name: string): string {
        if (!this.resources.has(name)) {
            console.warn(`资源不存在: ${name}`);
            return '';
        }

        // 如果已有缓存的Blob URL，直接返回
        if (this.blobCache.has(name)) {
            return this.blobCache.get(name) || '';
        }

        // 获取资源定义
        const resource = this.resources.get(name)!;

        // 如果资源已加载，创建Blob URL
        if (resource.loaded && resource.content !== undefined) {
            const blob = new Blob([resource.content], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            this.blobCache.set(name, url);
            return url;
        }

        // 尝试加载资源
        this.loadResource(name);
        return resource.url;
    }

    /**
     * 添加资源
     * @param name 资源名称
     * @param url 资源URL
     * @param content 资源内容（可选）
     */
    public addResource(name: string, url: string, content?: string): void {
        this.resources.set(name, {
            name,
            url,
            content,
            loaded: content !== undefined
        });

        // 清除缓存
        this.resourceCache.delete(name);
        this.blobCache.delete(name);
    }

    /**
     * 获取所有资源
     */
    public getAllResources(): GMResourceDefinition[] {
        return Array.from(this.resources.values());
    }

    /**
     * 加载资源
     * @param name 资源名称
     */
    private loadResource(name: string): Promise<string> {
        if (!this.resources.has(name)) {
            return Promise.reject(`资源不存在: ${name}`);
        }

        const resource = this.resources.get(name)!;

        // 如果已加载，直接返回内容
        if (resource.loaded && resource.content !== undefined) {
            return Promise.resolve(resource.content);
        }

        // 异步加载资源
        return new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', resource.url, true);
            xhr.responseType = 'text';
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const content = xhr.responseText;
                    
                    // 更新资源
                    this.resources.set(name, {
                        ...resource,
                        content,
                        loaded: true
                    });
                    
                    // 更新缓存
                    this.resourceCache.set(name, content);
                    
                    resolve(content);
                } else {
                    reject(`加载资源失败: ${xhr.status} ${xhr.statusText}`);
                }
            };
            
            xhr.onerror = () => {
                reject('加载资源时发生网络错误');
            };
            
            xhr.send();
        });
    }

    /**
     * 释放资源（清除Blob URL）
     */
    public dispose(): void {
        this.blobCache.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.error('释放Blob URL失败', e);
            }
        });
        
        this.blobCache.clear();
    }
} 