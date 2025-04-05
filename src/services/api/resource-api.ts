import { UserScript } from '../../models/script';
import { ResourceLoadError } from '../error/error-types';

/**
 * 资源管理API，负责处理脚本资源的加载和访问
 */
export class ResourceAPI {
  private script: UserScript;
  private resourceCache: Map<string, string> = new Map();
  
  /**
   * 创建资源API实例
   * @param script 脚本对象
   */
  constructor(script: UserScript) {
    this.script = script;
    
    // 绑定方法
    this.getResourceText = this.getResourceText.bind(this);
    this.getResourceURL = this.getResourceURL.bind(this);
  }
  
  /**
   * 获取资源的文本内容
   * @param name 资源名称
   * @returns 资源内容，如果不存在则返回空字符串
   */
  getResourceText(name: string): string {
    try {
      console.log(`CheekyChimp: 获取资源文本 ${name}`);
      
      // 查找资源URL
      const resourceMap = this.script.resources.reduce((map, resource) => {
        map[resource.name] = resource.url;
        return map;
      }, {} as Record<string, string>);
      
      const resourceUrl = resourceMap[name];
      if (!resourceUrl) {
        console.warn(`CheekyChimp: 资源 ${name} 未找到`);
        return '';
      }
      
      // 检查缓存
      const cacheKey = `cheekychimp_resource:${this.script.id}:${name}`;
      
      // 尝试从localStorage获取缓存
      const cachedResource = localStorage.getItem(cacheKey);
      if (cachedResource) {
        console.log(`CheekyChimp: 使用缓存的资源 ${name}`);
        return cachedResource;
      }
      
      // 如果没有缓存，启动后台加载
      console.log(`CheekyChimp: 资源${name}未缓存，启动后台加载`);
      this.loadResourceInBackground(name, resourceUrl, cacheKey);
      
      // 对于特定资源类型，提供默认内容
      if (name === 'swalStyle' && this.script.name.includes('夜间模式')) {
        return this.getDefaultSwalStyle();
      }
      
      return '';
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`CheekyChimp: 获取资源 ${name} 失败:`, err);
      return '';
    }
  }
  
  /**
   * 获取资源的URL
   * @param name 资源名称
   * @returns 资源URL，如果不存在则返回空字符串
   */
  getResourceURL(name: string): string {
    try {
      // 查找资源URL
      const resourceMap = this.script.resources.reduce((map, resource) => {
        map[resource.name] = resource.url;
        return map;
      }, {} as Record<string, string>);
      
      const resourceUrl = resourceMap[name];
      if (!resourceUrl) {
        console.warn(`CheekyChimp: 资源 ${name} 未找到`);
        return '';
      }
      
      return resourceUrl;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`CheekyChimp: 获取资源URL ${name} 失败:`, err);
      return '';
    }
  }
  
  /**
   * 在后台加载资源并缓存
   * @param name 资源名称
   * @param url 资源URL
   * @param cacheKey 缓存键
   */
  private loadResourceInBackground(name: string, url: string, cacheKey: string): void {
    setTimeout(() => {
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`获取资源失败: ${response.status} ${response.statusText}`);
          }
          return response.text();
        })
        .then(content => {
          try {
            // 缓存到localStorage
            localStorage.setItem(cacheKey, content);
            console.log(`CheekyChimp: 已缓存资源 ${name} 供下次使用`);
            
            // 同时缓存到内存
            this.resourceCache.set(name, content);
          } catch (error) {
            console.warn(`CheekyChimp: 无法缓存资源，可能超出存储限制`, error);
          }
        })
        .catch(error => {
          console.error(`CheekyChimp: 后台获取资源 ${name} 失败:`, error);
        });
    }, 0);
  }
  
  /**
   * 获取默认SweetAlert样式（针对夜间模式脚本）
   */
  private getDefaultSwalStyle(): string {
    return `
      .swal2-popup { background: #fff; color: #333; border-radius: 5px; padding: 20px; }
      .swal2-title { color: #595959; font-size: 1.8em; margin: 0; }
      .swal2-content { color: #545454; }
      .swal2-actions { margin-top: 15px; }
      .swal2-confirm { background: #3085d6; color: #fff; border: 0; border-radius: 3px; padding: 8px 20px; }
      .swal2-cancel { background: #aaa; color: #fff; border: 0; border-radius: 3px; padding: 8px 20px; margin-left: 10px; }
      .darkmode-popup { font-size: 14px !important; }
      .darkmode-center { display: flex; align-items: center; }
      .darkmode-setting-label { display: flex; align-items: center; justify-content: space-between; padding-top: 15px; }
      .darkmode-setting-label-col { display: flex; align-items: flex-start; padding-top: 15px; flex-direction: column; }
      .darkmode-setting-radio { width: 16px; height: 16px; }
      .darkmode-setting-textarea { width: 100%; margin: 14px 0 0; height: 100px; resize: none; border: 1px solid #bbb; box-sizing: border-box; padding: 5px 10px; border-radius: 5px; color: #666; line-height: 1.2; }
      .darkmode-setting-input { border: 1px solid #bbb; box-sizing: border-box; padding: 5px 10px; border-radius: 5px; width: 100px; }
    `;
  }
} 