import { ObsidianStorage } from './obsidian-storage';
import { ScriptManager } from './script-manager';
import { UserScript, GM_API } from '../models/script';

/**
 * 备份版本的脚本注入器 - 尽可能保留所有原有功能
 */
export class BackupScriptInjector {
  // 添加logger属性以满足接口要求
  logger = {
    info: (message: string, ...args: any[]) => console.log(`[BackupScriptInjector] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[BackupScriptInjector] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[BackupScriptInjector] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[BackupScriptInjector] ${message}`, ...args)
  };

  /**
   * 创建脚本注入器实例
   */
  constructor(
    private storage: ObsidianStorage,
    private scriptManager: ScriptManager
  ) {
    this.logger.info('初始化完成');
  }

  /**
   * 为指定元素和URL注入匹配的脚本
   */
  async injectScripts(webview: HTMLElement, url: string, scripts: UserScript[]): Promise<void> {
    try {
      if (!scripts || scripts.length === 0) {
        return;
      }

      this.logger.info(`为URL [${url}] 注入 ${scripts.length} 个脚本`);
      
      // 设置网站特定适配器
      this.setupSiteAdapter(webview, url);

      // 对每个脚本进行注入
      for (const script of scripts) {
        try {
          // 准备脚本的GM API
          const scriptWithGM = this.prepareScriptWithGMAPI(script, url);
          
          // 注入处理后的脚本
          await this.injectScript(webview, scriptWithGM);
          this.logger.info(`脚本 ${script.name} 注入成功`);
        } catch (error) {
          this.logger.error(`脚本 ${script.name} 注入失败: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`注入脚本出错: ${error.message}`);
    }
  }

  /**
   * 为给定URL和WebView/iframe注入匹配的脚本
   * 保持与重构版本相同的接口
   */
  async injectScriptsForUrl(element: HTMLElement, url: string): Promise<void> {
    try {
      if (!url || !element) {
        this.logger.warn('无效的URL或element参数');
        return;
      }

      this.logger.info(`为URL [${url}] 查找匹配的脚本`);

      // 获取匹配该URL的所有启用脚本
      const matchingScripts = this.scriptManager.findScriptsForUrl(url);
      if (!matchingScripts.length) {
        this.logger.info(`没有匹配URL [${url}] 的脚本`);
        return;
      }

      // 注入找到的脚本
      await this.injectScripts(element, url, matchingScripts);
    } catch (error) {
      this.logger.error(`脚本注入过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 注入单个脚本
   */
  private async injectScript(webview: HTMLElement, script: string): Promise<void> {
    // 根据元素类型选择不同的注入方法
    if (webview instanceof HTMLIFrameElement) {
      await this.injectScriptToIframe(webview, script);
    } else {
      // 假设是webview
      await this.injectScriptToWebview(webview, script);
    }
  }

  /**
   * 向iframe注入脚本
   */
  private async injectScriptToIframe(iframe: HTMLIFrameElement, script: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 确保iframe已经加载
        const checkIframeReady = () => {
          try {
            // 检查iframe是否可访问
            if (iframe.contentWindow && iframe.contentDocument) {
              const scriptElement = iframe.contentDocument.createElement('script');
              scriptElement.textContent = script;
              
              scriptElement.onload = () => {
                resolve();
              };
              
              scriptElement.onerror = (error) => {
                reject(new Error(`脚本加载失败: ${error}`));
              };
              
              iframe.contentDocument.head.appendChild(scriptElement);
            } else {
              // 持续检查直到iframe准备就绪
              setTimeout(checkIframeReady, 100);
            }
          } catch (error) {
            reject(error);
          }
        };
        
        checkIframeReady();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 向webview注入脚本
   */
  private async injectScriptToWebview(webview: HTMLElement, script: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 对于webview元素，尝试使用executeJavaScript方法
        const webviewEl = webview as any;
        if (typeof webviewEl.executeJavaScript === 'function') {
          webviewEl.executeJavaScript(script, false)
            .then(() => resolve())
            .catch((error: Error) => reject(error));
        } else {
          // 如果不支持executeJavaScript，尝试使用eval
          if (webviewEl.contentWindow) {
            try {
              (webviewEl.contentWindow as any).eval(script);
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('无法访问webview的contentWindow'));
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 设置网站特定适配器
   */
  setupSiteAdapter(element: HTMLElement, url: string): void {
    try {
      // 检查是否是哔哩哔哩网站
      if (url.includes('bilibili.com')) {
        this.logger.info(`检测到哔哩哔哩网站: ${url}`);
        this.setupBilibiliSupport(element);
      }
      
      // 未来可添加更多网站的适配支持
    } catch (error) {
      this.logger.error(`设置站点适配器出错: ${error.message}`);
    }
  }

  /**
   * 设置哔哩哔哩网站支持
   */
  private setupBilibiliSupport(element: HTMLElement): void {
    try {
      if (element instanceof HTMLIFrameElement) {
        // 允许哔哩哔哩iframe全屏
        element.allowFullscreen = true;
        element.setAttribute('allowfullscreen', 'true');
        
        // 添加哔哩哔哩特定的样式修复
        this.injectBilibiliStyles(element);
        
        this.logger.info('哔哩哔哩支持设置完成');
      }
    } catch (error) {
      this.logger.error(`设置哔哩哔哩支持出错: ${error.message}`);
    }
  }

  /**
   * 注入哔哩哔哩特定的样式修复
   */
  private injectBilibiliStyles(iframe: HTMLIFrameElement): void {
    try {
      // 检查iframe是否可访问
      if (!iframe.contentDocument) {
        return;
      }
      
      // 创建样式元素
      const styleElement = iframe.contentDocument.createElement('style');
      styleElement.textContent = `
        /* 修复全屏按钮的z-index问题 */
        .bilibili-player-video-btn-fullscreen,
        .bilibili-player-video-web-fullscreen {
          z-index: 100000 !important;
        }
        
        /* 修复播放器控制栏的z-index问题 */
        .bilibili-player-video-control-wrap {
          z-index: 100000 !important;
        }
      `;
      
      // 添加样式到iframe文档
      iframe.contentDocument.head.appendChild(styleElement);
    } catch (error) {
      this.logger.error(`注入哔哩哔哩样式出错: ${error.message}`);
    }
  }

  /**
   * 为脚本准备GM API并包装脚本
   */
  private prepareScriptWithGMAPI(script: UserScript, url: string): string {
    // 准备脚本的GM API
    const gmInfo = this.buildGMInfo(script, url);
    const gmAPI = this.buildGMAPI(script, url);
    
    // 将API和脚本包装在一起
    return this.wrapScriptWithAPI(script.source, gmAPI, gmInfo);
  }

  /**
   * 构建GM_info对象
   */
  private buildGMInfo(script: UserScript, url: string): any {
    return {
      script: {
        name: script.name,
        namespace: script.namespace || '',
        description: script.description || '',
        version: script.version || '0.1',
        includes: script.includes || [],
        matches: script.matches || [],
        excludes: script.excludes || [],
        resources: script.resources || [],
        requires: script.requires || [],
        unwrap: false,
        'run-at': script.runAt || 'document-idle'
      },
      scriptHandler: 'CheekyChimp',
      version: '1.0',
      scriptMetaStr: '',
      platform: {
        name: 'obsidian'
      }
    };
  }

  /**
   * 构建Greasemonkey API
   */
  private buildGMAPI(script: UserScript, url: string): GM_API {
    const self = this; // 保存this引用
    
    // 基本GM API实现
    return {
      GM_info: this.buildGMInfo(script, url),
      
      // 存储API
      GM_getValue: (name: string, defaultValue?: any): any => {
        return this.storage.getValue(`${script.id}:${name}`, defaultValue) || defaultValue;
      },
      
      GM_setValue: (name: string, value: any): void => {
        this.storage.setValue(`${script.id}:${name}`, value);
      },
      
      GM_deleteValue: (name: string): void => {
        this.storage.deleteValue(`${script.id}:${name}`);
      },
      
      GM_listValues: (): string[] => {
        return []; // 实际应该过滤属于该脚本的键
      },
      
      // 资源API
      GM_getResourceText: (name: string): string => {
        return ''; // 应实现资源获取
      },
      
      GM_getResourceURL: (name: string): string => {
        return ''; // 应实现资源URL获取
      },
      
      // UI API
      GM_addStyle: (css: string): void => {
        // 实现添加样式
      },
      
      // XHR API
      GM_xmlhttpRequest: (details: any): any => {
        return null; // 应实现XHR请求
      },
      
      // 菜单API
      GM_registerMenuCommand: (name: string, fn: Function, accessKey?: string): void => {
        // 实现菜单命令注册
      },
      
      GM_unregisterMenuCommand: (menuCmdId: number): void => {
        // 实现菜单命令注销
      },
      
      // 其他API
      GM_openInTab: (url: string, options?: any): any => {
        return null; // 应实现打开标签页
      },
      
      GM_setClipboard: (data: string, info?: any): void => {
        // 实现剪贴板操作
      },
      
      GM_notification: (details: any, ondone?: Function): void => {
        // 实现通知
      },
      
      unsafeWindow: window as any
    } as GM_API;
  }

  /**
   * 将脚本和API包装在一起
   */
  private wrapScriptWithAPI(scriptSource: string, gmAPI: GM_API, gmInfo: any): string {
    // 这是一个精简版的包装器，实际的原始代码可能包含更多功能
    
    // 添加脚本依赖（如果有）
    let dependencies = '';
    if (gmInfo.script.requires && gmInfo.script.requires.length > 0) {
      dependencies = `
        // 加载依赖脚本
        function loadDependencies() {
          const deps = ${JSON.stringify(gmInfo.script.requires)};
          let loaded = 0;
          
          return new Promise((resolve) => {
            if (deps.length === 0) {
              resolve();
              return;
            }
            
            deps.forEach((url) => {
              const script = document.createElement('script');
              script.src = url;
              script.onload = () => {
                loaded++;
                if (loaded === deps.length) {
                  resolve();
                }
              };
              script.onerror = () => {
                console.error('[CheekyChimp] 加载依赖失败:', url);
                loaded++;
                if (loaded === deps.length) {
                  resolve();
                }
              };
              document.head.appendChild(script);
            });
          });
        }
        
        // 等待依赖加载完成
        await loadDependencies();
      `;
    }
    
    // 创建一个包含所有GM API的上下文对象，防止JSON序列化问题
    let gmApiStr = '';
    
    // 添加每个API函数
    gmApiStr += `
      const GM_getValue = function(name, defaultValue) {
        try {
          const value = window.localStorage.getItem('CheekyChimp_' + '${gmInfo.script.name}_' + name);
          return value === null ? defaultValue : JSON.parse(value);
        } catch(e) {
          console.error('[CheekyChimp] GM_getValue错误:', e);
          return defaultValue;
        }
      };
      
      const GM_setValue = function(name, value) {
        try {
          window.localStorage.setItem('CheekyChimp_' + '${gmInfo.script.name}_' + name, JSON.stringify(value));
        } catch(e) {
          console.error('[CheekyChimp] GM_setValue错误:', e);
        }
      };
      
      const GM_deleteValue = function(name) {
        try {
          window.localStorage.removeItem('CheekyChimp_' + '${gmInfo.script.name}_' + name);
        } catch(e) {
          console.error('[CheekyChimp] GM_deleteValue错误:', e);
        }
      };
      
      const GM_listValues = function() {
        try {
          const values = [];
          const prefix = 'CheekyChimp_' + '${gmInfo.script.name}_';
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              values.push(key.substring(prefix.length));
            }
          }
          return values;
        } catch(e) {
          console.error('[CheekyChimp] GM_listValues错误:', e);
          return [];
        }
      };
      
      const GM_addStyle = function(css) {
        try {
          const style = document.createElement('style');
          style.textContent = css;
          document.head.appendChild(style);
          return style;
        } catch(e) {
          console.error('[CheekyChimp] GM_addStyle错误:', e);
        }
      };
      
      // 创建一个模拟版的XMLHttpRequest函数
      const GM_xmlhttpRequest = function(details) {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open(details.method || 'GET', details.url, true);
          
          if (details.headers) {
            for (const header in details.headers) {
              xhr.setRequestHeader(header, details.headers[header]);
            }
          }
          
          if (details.responseType) {
            xhr.responseType = details.responseType;
          }
          
          xhr.onload = function() {
            if (details.onload) {
              details.onload({
                responseText: xhr.responseText,
                responseXML: xhr.responseXML,
                readyState: xhr.readyState,
                responseHeaders: xhr.getAllResponseHeaders(),
                status: xhr.status,
                statusText: xhr.statusText,
                response: xhr.response
              });
            }
          };
          
          xhr.onerror = function() {
            if (details.onerror) {
              details.onerror({
                error: 'Network error',
                readyState: xhr.readyState,
                status: xhr.status,
                statusText: xhr.statusText
              });
            }
          };
          
          xhr.onabort = details.onabort;
          xhr.ontimeout = details.ontimeout;
          xhr.onprogress = details.onprogress;
          
          if (details.data) {
            xhr.send(details.data);
          } else {
            xhr.send();
          }
          
          return {
            abort: function() {
              xhr.abort();
            }
          };
        } catch(e) {
          console.error('[CheekyChimp] GM_xmlhttpRequest错误:', e);
          if (details.onerror) {
            details.onerror({
              error: e.toString(),
              readyState: 0,
              status: 0,
              statusText: 'Error'
            });
          }
        }
      };
      
      // 其他GM函数的实现
      const GM_registerMenuCommand = function(name, fn) {
        // 在实际实现中，这会创建一个菜单项
        console.log('[CheekyChimp] 注册菜单命令:', name);
        return 1; // 返回一个虚拟ID
      };
      
      const GM_unregisterMenuCommand = function(id) {
        console.log('[CheekyChimp] 注销菜单命令:', id);
      };
      
      const GM_openInTab = function(url, options) {
        try {
          window.open(url, '_blank');
        } catch(e) {
          console.error('[CheekyChimp] GM_openInTab错误:', e);
        }
      };
      
      const GM_setClipboard = function(text) {
        try {
          // 这在实际情况下需要特殊权限
          console.log('[CheekyChimp] 设置剪贴板内容:', text);
        } catch(e) {
          console.error('[CheekyChimp] GM_setClipboard错误:', e);
        }
      };
      
      // 资源访问函数
      const GM_getResourceText = function(name) {
        console.log('[CheekyChimp] 获取资源文本:', name);
        return '';
      };
      
      const GM_getResourceURL = function(name) {
        console.log('[CheekyChimp] 获取资源URL:', name);
        return '';
      };
      
      // 通知函数
      const GM_notification = function(details) {
        try {
          console.log('[CheekyChimp] 显示通知:', details.title || '通知', details.text);
          if (typeof Notification !== 'undefined') {
            new Notification(details.title || '通知', {
              body: details.text,
              icon: details.image
            });
          }
        } catch(e) {
          console.error('[CheekyChimp] GM_notification错误:', e);
        }
      };
      
      // 现代GM API
      const GM = {
        getValue: (name, defaultValue) => Promise.resolve(GM_getValue(name, defaultValue)),
        setValue: (name, value) => { 
          GM_setValue(name, value); 
          return Promise.resolve(); 
        },
        deleteValue: (name) => { 
          GM_deleteValue(name); 
          return Promise.resolve(); 
        },
        listValues: () => Promise.resolve(GM_listValues()),
        xmlHttpRequest: (details) => GM_xmlhttpRequest(details),
        addStyle: (css) => Promise.resolve(GM_addStyle(css)),
        registerMenuCommand: (name, fn) => Promise.resolve(GM_registerMenuCommand(name, fn))
      };
    `;
    
    // GM_info对象
    const gmInfoStr = `
      const GM_info = ${JSON.stringify(gmInfo, null, 2)};
    `;
    
    // 包装脚本
    return `
      (async function() {
        try {
          // 定义unsafeWindow
          const unsafeWindow = window;
          
          // 设置GM_info
          ${gmInfoStr}
          
          // 定义GM API
          ${gmApiStr}
          
          ${dependencies}
          
          // 保存原始控制台
          const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
          };
          
          // 修改控制台以便识别用户脚本日志
          console = Object.assign({}, console, {
            log: (...args) => originalConsole.log('[${gmInfo.script.name}]', ...args),
            warn: (...args) => originalConsole.warn('[${gmInfo.script.name}]', ...args),
            error: (...args) => originalConsole.error('[${gmInfo.script.name}]', ...args),
            info: (...args) => originalConsole.info('[${gmInfo.script.name}]', ...args),
            debug: (...args) => originalConsole.debug('[${gmInfo.script.name}]', ...args)
          });
          
          // 注入用户脚本
          ${scriptSource}
          
          // 恢复原始控制台
          console = originalConsole;
        } catch(e) {
          console.error('[CheekyChimp] 运行脚本时出错:', e);
        }
      })();
    `;
  }
} 