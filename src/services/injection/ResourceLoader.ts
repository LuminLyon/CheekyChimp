import { Logger } from '../utils/Logger';

/**
 * 资源类型
 */
export enum ResourceType {
    SCRIPT,
    STYLE,
    OTHER
}

/**
 * 资源加载结果
 */
export interface ResourceLoadResult {
    content: string;
    type: ResourceType;
    url: string;
    timestamp: number;
    success: boolean;
    error?: Error;
}

/**
 * 资源加载器 - 负责加载和缓存外部资源
 */
export class ResourceLoader {
    private resourceCache: Map<string, ResourceLoadResult> = new Map();
    private logger: Logger;
    
    constructor() {
        this.logger = new Logger('ResourceLoader');
    }
    
    /**
     * 加载外部资源
     * @param url 资源URL
     * @param forceRefresh 是否强制刷新缓存
     */
    public async loadExternalResource(url: string, forceRefresh = false): Promise<string> {
        // 检查缓存
        if (!forceRefresh && this.resourceCache.has(url)) {
            const cached = this.resourceCache.get(url);
            if (cached && cached.success) {
                this.logger.debug(`使用缓存的资源: ${url}`);
                return cached.content;
            }
        }
        
        try {
            this.logger.info(`加载外部资源: ${url}`);
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
            
            // 缓存资源
            this.resourceCache.set(url, {
                content,
                type: this.detectResourceType(url),
                url,
                timestamp: Date.now(),
                success: true
            });
            
            this.logger.info(`已加载资源: ${url}`);
            return content;
        } catch (error) {
            this.logger.error(`加载资源失败 ${url}:`, error);
            
            // 缓存失败结果以避免反复请求失败的资源
            this.resourceCache.set(url, {
                content: '',
                type: ResourceType.OTHER,
                url,
                timestamp: Date.now(),
                success: false,
                error
            });
            
            return '';
        }
    }
    
    /**
     * 检测资源类型
     * @param url 资源URL
     */
    private detectResourceType(url: string): ResourceType {
        const lowercaseUrl = url.toLowerCase();
        
        if (lowercaseUrl.endsWith('.js') || lowercaseUrl.includes('javascript')) {
            return ResourceType.SCRIPT;
        } else if (lowercaseUrl.endsWith('.css') || lowercaseUrl.includes('stylesheet')) {
            return ResourceType.STYLE;
        } else {
            return ResourceType.OTHER;
        }
    }
    
    /**
     * 清除缓存
     * @param url 特定资源URL，不提供则清除所有缓存
     */
    public clearCache(url?: string): void {
        if (url) {
            this.resourceCache.delete(url);
            this.logger.debug(`已清除资源缓存: ${url}`);
        } else {
            this.resourceCache.clear();
            this.logger.debug('已清除所有资源缓存');
        }
    }
    
    /**
     * 获取所有缓存的资源
     */
    public getCachedResources(): string[] {
        return Array.from(this.resourceCache.keys());
    }
} 