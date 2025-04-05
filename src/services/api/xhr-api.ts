import { UserScript } from '../../models/script';
import { XMLHttpRequestDetails, XMLHttpRequestControl } from './gm-api-types';
import { APICallError } from '../error/error-types';

/**
 * XMLHttpRequest API服务，负责处理脚本的跨域请求
 */
export class XHRAPI {
  private script: UserScript;
  private url: string;
  private connectDomains: string[] = [];
  
  /**
   * 创建XHR API实例
   * @param script 脚本对象
   * @param url 当前页面URL
   */
  constructor(script: UserScript, url: string) {
    this.script = script;
    this.url = url;
    this.connectDomains = this.extractConnectDomains(script.source);
    
    // 绑定方法
    this.xmlHttpRequest = this.xmlHttpRequest.bind(this);
  }
  
  /**
   * 发送跨域请求
   * @param details 请求详情
   * @returns 请求控制对象
   */
  xmlHttpRequest(details: XMLHttpRequestDetails): XMLHttpRequestControl | null {
    console.log(`CheekyChimp: 执行xmlhttpRequest ${details.url}`);
    
    try {
      // 创建请求中止控制器
      const abortController = new AbortController();
      const signal = abortController.signal;
      
      // 准备请求配置
      const fetchOptions: RequestInit = {
        method: details.method || 'GET',
        signal: signal,
        credentials: details.withCredentials ? 'include' : 'same-origin'
      };
      
      // 添加请求头
      if (details.headers) {
        fetchOptions.headers = details.headers;
      }
      
      // 添加请求体
      if (details.data) {
        fetchOptions.body = details.data;
      }
      
      // 检查目标域名是否在允许列表中
      const targetHost = new URL(details.url).hostname;
      if (!this.isConnectAllowed(targetHost)) {
        console.warn(`CheekyChimp: 请求 ${targetHost} 不在@connect列表中，可能被阻止`);
      }
      
      // 创建控制对象
      const control: XMLHttpRequestControl = {
        abort: () => {
          abortController.abort();
        }
      };
      
      // 执行请求
      fetch(details.url, fetchOptions)
        .then(async response => {
          // 准备响应头字符串
          let responseHeaders = '';
          if (response.headers) {
            if (typeof response.headers.forEach === 'function') {
              const headerPairs: string[] = [];
              response.headers.forEach((value, key) => {
                headerPairs.push(`${key}: ${value}`);
              });
              responseHeaders = headerPairs.join('\n');
            } else {
              responseHeaders = response.headers.toString();
            }
          }
          
          // 获取响应文本
          const responseText = await response.text();
          
          // 调用成功回调
          if (details.onload && typeof details.onload === 'function') {
            details.onload({
              finalUrl: response.url,
              readyState: 4,
              status: response.status,
              statusText: response.statusText,
              responseHeaders: responseHeaders,
              responseText: responseText,
              response: responseText
            });
          }
        })
        .catch(error => {
          // 处理中止请求
          if (error.name === 'AbortError' && details.onabort) {
            details.onabort();
            return;
          }
          
          // 处理其他错误
          if (details.onerror && typeof details.onerror === 'function') {
            details.onerror(error);
          }
        });
      
      return control;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('CheekyChimp: XMLHttpRequest执行失败:', err);
      
      // 调用错误回调
      if (details.onerror && typeof details.onerror === 'function') {
        details.onerror(err);
      }
      
      return null;
    }
  }
  
  /**
   * 从脚本源代码中提取@connect域名
   * @param source 脚本源代码
   * @returns 允许连接的域名列表
   */
  private extractConnectDomains(source: string): string[] {
    const connectDomains: string[] = [];
    const connectRegex = /\/\/\s*@connect\s+([^\s]+)/g;
    let match;
    
    while ((match = connectRegex.exec(source)) !== null) {
      if (match[1]) {
        connectDomains.push(match[1].trim());
      }
    }
    
    // 如果脚本没有指定@connect，允许访问脚本同域名
    if (connectDomains.length === 0) {
      try {
        const pageHost = new URL(this.url).hostname;
        connectDomains.push(pageHost);
      } catch (e) {
        // 忽略URL解析错误
      }
    }
    
    return connectDomains;
  }
  
  /**
   * 检查一个域名是否允许连接
   * @param hostname 目标域名
   * @returns 是否允许连接
   */
  private isConnectAllowed(hostname: string): boolean {
    // 如果没有指定@connect，允许所有域名
    if (this.connectDomains.length === 0) {
      return true;
    }
    
    // 检查域名是否匹配允许列表
    return this.connectDomains.some(domain => {
      if (domain === '*') {
        return true;
      }
      
      // 检查精确匹配
      if (hostname === domain) {
        return true;
      }
      
      // 检查子域名
      if (domain.startsWith('.') && hostname.endsWith(domain)) {
        return true;
      }
      
      return false;
    });
  }
} 