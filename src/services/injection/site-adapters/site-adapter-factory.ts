import { SiteAdapter } from './site-adapter-interface';
import { GenericAdapter } from './generic-adapter';
import { logPrefix } from '../utils';

/**
 * 站点适配器工厂
 * 用于根据URL获取合适的站点适配器
 */
export class SiteAdapterFactory {
    private static instance: SiteAdapterFactory;
    private adapters: SiteAdapter[] = [];
    
    /**
     * 私有构造函数，注册所有已知的站点适配器
     */
    private constructor() {
        // 仅注册通用适配器，处理所有网站
        this.registerAdapter(GenericAdapter.getInstance());
        
        console.log(`${logPrefix('SiteAdapterFactory')} 已注册通用适配器`);
    }
    
    /**
     * 获取工厂单例实例
     */
    public static getInstance(): SiteAdapterFactory {
        if (!SiteAdapterFactory.instance) {
            SiteAdapterFactory.instance = new SiteAdapterFactory();
        }
        return SiteAdapterFactory.instance;
    }
    
    /**
     * 注册站点适配器
     * @param adapter 要注册的适配器
     */
    public registerAdapter(adapter: SiteAdapter): void {
        this.adapters.push(adapter);
    }
    
    /**
     * 根据URL获取合适的站点适配器
     * @param url 页面URL
     * @returns 适配该URL的站点适配器
     */
    public getAdapter(url: string): SiteAdapter {
        // 因为我们只注册了通用适配器，所以直接返回它
        return this.adapters[0];
    }
} 