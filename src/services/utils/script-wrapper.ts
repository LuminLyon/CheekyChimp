import { UserScript } from '../../models/script';
import { GM_API } from '../api/gm-api-types';

/**
 * 脚本包装器，负责将脚本包装在安全的环境中
 */
export class ScriptWrapper {
  /**
   * 将脚本包装在一个安全的作用域内
   * @param script 脚本对象
   * @param gmApi GM API对象
   * @param scriptContent 脚本内容（已预处理）
   * @returns 包装后的脚本内容
   */
  wrap(script: UserScript, gmApi: GM_API, scriptContent: string): string {
    return `
      (function() {
        try {
          // 定义GM_info对象
          const GM_info = ${JSON.stringify(gmApi.GM_info)};
          console.log('CheekyChimp: 准备执行脚本 "${script.name}"', GM_info);
          
          // 定义GM API函数
          const GM_getValue = function(name, defaultValue) {
            return ${this.getFunctionBody(gmApi.GM_getValue)};
          };
          
          const GM_setValue = function(name, value) {
            return ${this.getFunctionBody(gmApi.GM_setValue)};
          };
          
          const GM_deleteValue = function(name) {
            return ${this.getFunctionBody(gmApi.GM_deleteValue)};
          };
          
          const GM_listValues = function() {
            return ${this.getFunctionBody(gmApi.GM_listValues)};
          };
          
          const GM_getResourceText = function(name) {
            return ${this.getFunctionBody(gmApi.GM_getResourceText)};
          };
          
          const GM_getResourceURL = function(name) {
            return ${this.getFunctionBody(gmApi.GM_getResourceURL)};
          };
          
          const GM_addStyle = function(css) {
            return ${this.getFunctionBody(gmApi.GM_addStyle)};
          };
          
          const GM_xmlhttpRequest = function(details) {
            return ${this.getFunctionBody(gmApi.GM_xmlhttpRequest)};
          };
          
          const GM_registerMenuCommand = function(name, fn, accessKey) {
            return ${this.getFunctionBody(gmApi.GM_registerMenuCommand)};
          };
          
          const GM_unregisterMenuCommand = function(menuCmdId) {
            return ${this.getFunctionBody(gmApi.GM_unregisterMenuCommand)};
          };
          
          const GM_openInTab = function(url, options) {
            return ${this.getFunctionBody(gmApi.GM_openInTab)};
          };
          
          const GM_setClipboard = function(data, info) {
            return ${this.getFunctionBody(gmApi.GM_setClipboard)};
          };
          
          const GM_notification = function(details, title, image, onclick) {
            return ${this.getFunctionBody(gmApi.GM_notification)};
          };
          
          ${gmApi.GM_addElement ? `
          const GM_addElement = function(tagName, attributes) {
            return ${this.getFunctionBody(gmApi.GM_addElement)};
          };
          ` : ''}
          
          // 定义GM命名空间（新API）
          const GM = {
            getValue: async function(name, defaultValue) {
              return ${this.getFunctionBody(gmApi.GM?.getValue)};
            },
            
            setValue: async function(name, value) {
              return ${this.getFunctionBody(gmApi.GM?.setValue)};
            },
            
            deleteValue: async function(name) {
              return ${this.getFunctionBody(gmApi.GM?.deleteValue)};
            },
            
            listValues: async function() {
              return ${this.getFunctionBody(gmApi.GM?.listValues)};
            },
            
            xmlHttpRequest: function(details) {
              return ${this.getFunctionBody(gmApi.GM?.xmlHttpRequest)};
            },
            
            addStyle: async function(css) {
              return ${this.getFunctionBody(gmApi.GM?.addStyle)};
            },
            
            registerMenuCommand: async function(name, fn, accessKey) {
              return ${this.getFunctionBody(gmApi.GM?.registerMenuCommand)};
            },
            
            addElement: async function(tagName, attributes) {
              return ${this.getFunctionBody(gmApi.GM?.addElement)};
            }
          };
          
          // 获取unsafeWindow
          const unsafeWindow = window;
          
          // 执行用户脚本
          ${scriptContent}
          
        } catch(error) {
          console.error('CheekyChimp: 执行脚本 "${script.name}" 时发生错误:', error);
        }
      })();
    `;
  }
  
  /**
   * 获取函数主体
   * @param fn 函数引用
   * @returns 函数字符串
   */
  private getFunctionBody(fn: any): string {
    if (typeof fn !== 'function') {
      return 'function() { console.warn("CheekyChimp: 函数未实现"); return undefined; }';
    }
    
    const fnStr = fn.toString();
    
    // 提取函数主体
    const bodyStart = fnStr.indexOf('{');
    const bodyEnd = fnStr.lastIndexOf('}');
    
    if (bodyStart === -1 || bodyEnd === -1) {
      return 'function() { console.warn("CheekyChimp: 无法解析函数"); return undefined; }';
    }
    
    // 返回函数主体并替换this引用
    return fnStr.substring(bodyStart, bodyEnd + 1);
  }
} 