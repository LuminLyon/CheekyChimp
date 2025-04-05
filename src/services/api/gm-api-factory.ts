import { UserScript, ScriptStorage } from '../../models/script';
import { GM_API, XMLHttpRequestDetails, XMLHttpRequestControl, NotificationDetails } from './gm-api-types';
import { StorageAPI } from './storage-api';
import { ResourceAPI } from './resource-api';
import { UIAPI } from './ui-api';
import { XHRAPI } from './xhr-api';
import { ScriptInjectionError } from '../error/error-types';
import { ErrorHandler } from '../error/error-handler';

/**
 * GM API创建选项
 */
export interface GMAPIOptions {
  /** 脚本对象 */
  script: UserScript;
  /** 当前页面URL */
  url: string;
  /** 存储服务 */
  storage: ScriptStorage;
  /** 是否启用调试 */
  debug?: boolean;
}

/**
 * GM API工厂，负责创建完整的GM API
 */
export class GMAPIFactory {
  /**
   * 创建GM API实例
   * @param options API创建选项
   * @returns GM API实例
   */
  static create(options: GMAPIOptions): GM_API {
    try {
      const { script, url, storage, debug = false } = options;
      
      // 创建各个API组件
      const storageAPI = new StorageAPI(storage, script);
      const resourceAPI = new ResourceAPI(script);
      const uiAPI = new UIAPI(script);
      const xhrAPI = new XHRAPI(script, url);
      
      // 构建完整的GM API
      const api: GM_API = {
        // GM信息对象
        GM_info: this.createGMInfo(script),
        
        // 存储相关API
        GM_getValue: storageAPI.getValue,
        GM_setValue: storageAPI.setValue,
        GM_deleteValue: storageAPI.deleteValue,
        GM_listValues: storageAPI.listValues,
        
        // 资源相关API
        GM_getResourceText: resourceAPI.getResourceText,
        GM_getResourceURL: resourceAPI.getResourceURL,
        
        // UI相关API
        GM_addStyle: uiAPI.addStyle,
        GM_registerMenuCommand: uiAPI.registerMenuCommand,
        GM_unregisterMenuCommand: uiAPI.unregisterMenuCommand,
        GM_addElement: uiAPI.addElement,
        GM_notification: (detailsOrText: any, titleOrCallback?: any, image?: string, onclick?: () => void) => {
          let details: NotificationDetails;
          
          if (typeof detailsOrText === 'string') {
            details = {
              text: detailsOrText,
              title: titleOrCallback as string,
              image: image,
              onclick: onclick
            };
          } else {
            details = detailsOrText as NotificationDetails;
          }
          
          uiAPI.notification(details);
          
          return undefined;
        },
        
        // XHR相关API
        GM_xmlhttpRequest: xhrAPI.xmlHttpRequest,
        
        // 其他API
        GM_openInTab: (url: string, options?: any) => {
          console.warn('GM_openInTab 未完全实现');
          window.open(url, '_blank');
          return null;
        },
        
        GM_setClipboard: (data: string, info?: any) => {
          navigator.clipboard.writeText(data)
            .catch(error => console.error('复制文本失败: ', error));
        },
        
        // unsafeWindow
        unsafeWindow: window,
        
        // 新版API命名空间
        GM: {
          getValue: storageAPI.getValueAsync,
          setValue: storageAPI.setValueAsync,
          deleteValue: storageAPI.deleteValueAsync,
          listValues: storageAPI.listValuesAsync,
          xmlHttpRequest: xhrAPI.xmlHttpRequest,
          addStyle: uiAPI.addStyleAsync,
          registerMenuCommand: uiAPI.registerMenuCommandAsync,
          addElement: uiAPI.addElementAsync
        }
      };
      
      // 调试信息
      if (debug) {
        console.log(`为脚本 "${script.name}" 创建GM API`);
      }
      
      return api;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new ScriptInjectionError(options.script.name, `创建GM API失败: ${err.message}`);
    }
  }
  
  /**
   * 创建GM_info对象
   * @param script 脚本对象
   * @returns GM_info对象
   */
  private static createGMInfo(script: UserScript) {
    return {
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
      version: '0.1.0',
      scriptHandler: 'Obsidian CheekyChimp',
      scriptMetaStr: this.getScriptMetaStr(script)
    };
  }
  
  /**
   * 从脚本中提取元数据字符串
   * @param script 脚本对象
   * @returns 元数据字符串
   */
  private static getScriptMetaStr(script: UserScript): string {
    const source = script.source;
    const headerStartIndex = source.indexOf('==UserScript==');
    const headerEndIndex = source.indexOf('==/UserScript==');
    
    if (headerStartIndex === -1 || headerEndIndex === -1 || headerEndIndex <= headerStartIndex) {
      return '';
    }
    
    return source.substring(headerStartIndex, headerEndIndex + 13);
  }
} 