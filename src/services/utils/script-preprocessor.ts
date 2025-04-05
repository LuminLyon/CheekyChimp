import { UserScript } from '../../models/script';
import { ResourceLoadError } from '../error/error-types';
import { ErrorHandler, ErrorHandlingLevel } from '../error/error-handler';

/**
 * 脚本预处理器，负责处理脚本的依赖和资源
 */
export class ScriptPreprocessor {
  // 缓存已加载的资源，避免重复加载
  private resourceCache: Map<string, string> = new Map();
  
  /**
   * 构造函数
   */
  constructor() {}
  
  /**
   * 预处理脚本
   * @param script 要处理的脚本
   * @returns 处理后的脚本内容
   */
  async process(script: UserScript): Promise<string> {
    try {
      // 提取脚本的依赖和资源
      const { requires, resources } = this.extractResources(script);
      
      // 如果没有依赖，直接返回原始脚本内容
      if (requires.length === 0) {
        return script.source;
      }
      
      // 加载依赖脚本
      let dependencies = '';
      for (const requireUrl of requires) {
        try {
          const content = await this.loadExternalResource(requireUrl);
          dependencies += `\n// Require: ${requireUrl}\n${content}\n`;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          ErrorHandler.handle(
            new ResourceLoadError(err.message, requireUrl, err),
            `加载依赖 ${requireUrl}`,
            ErrorHandlingLevel.NOTIFY
          );
        }
      }
      
      // 将依赖插入到脚本中
      return this.injectDependencies(script.source, dependencies);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      ErrorHandler.handle(err, `预处理脚本 "${script.name}"`, ErrorHandlingLevel.NOTIFY);
      return script.source; // 出错时返回原始脚本
    }
  }
  
  /**
   * 从脚本中提取资源和依赖
   * @param script 脚本对象
   * @returns 依赖和资源列表
   */
  private extractResources(script: UserScript): { requires: string[], resources: {name: string, url: string}[] } {
    return {
      requires: script.requires || [],
      resources: script.resources || []
    };
  }
  
  /**
   * 加载外部资源
   * @param url 资源URL
   * @returns 资源内容
   */
  private async loadExternalResource(url: string): Promise<string> {
    // 检查缓存
    if (this.resourceCache.has(url)) {
      return this.resourceCache.get(url)!;
    }
    
    try {
      // 获取资源
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      
      // 缓存资源
      this.resourceCache.set(url, content);
      
      return content;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new ResourceLoadError(err.message, url, err);
    }
  }
  
  /**
   * 将依赖注入到脚本中
   * @param source 原始脚本源码
   * @param dependencies 依赖代码
   * @returns 处理后的脚本内容
   */
  private injectDependencies(source: string, dependencies: string): string {
    // 寻找脚本的头部注释结束位置
    const headerEndIndex = source.indexOf('==/UserScript==');
    
    if (headerEndIndex === -1) {
      // 如果找不到头部注释，将依赖添加到脚本开头
      return `${dependencies}\n${source}`;
    }
    
    // 找到头部注释结束后的换行符位置
    const afterHeaderIndex = source.indexOf('\n', headerEndIndex);
    
    if (afterHeaderIndex === -1) {
      // 如果找不到换行符，将依赖添加到脚本末尾
      return `${source}\n${dependencies}`;
    }
    
    // 将依赖插入到头部注释之后
    return source.slice(0, afterHeaderIndex + 1) + 
           dependencies + 
           source.slice(afterHeaderIndex + 1);
  }
} 