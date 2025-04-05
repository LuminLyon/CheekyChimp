import { ObsidianStorage } from './obsidian-storage';
import { ScriptManager } from './script-manager';
import { UserScript, GM_API } from '../models/script';
import { logPrefix } from './injection/utils';

/**
 * 增强版脚本注入器 - 结合两个版本的优点
 * 1. 保留模块化架构
 * 2. 融入原始版本的有效注入和检测机制
 * 3. 改进注入检测和事件监听
 * 4. 添加调试选项
 */
export class EnhancedScriptInjector {
  // 注入设置
  private settings = {
    // 是否启用调试模式
    debug: false,
    // 是否检测重复注入
    checkDuplicateInjection: true,
    // 注入标记前缀
    injectionMarkerPrefix: 'cheekychimp-injected-',
    // 是否自动重新注入
    autoReinject: true,
    // 最大重试次数
    maxRetries: 3
  };

  // 记录已注入的脚本 URL -> scriptId[]
  private injectedScripts = new Map<string, Set<string>>();

  // 添加logger属性
  logger = {
    info: (message: string, ...args: any[]) => {
      console.log(`[EnhancedScriptInjector] ${message}`, ...args);
      if (this.settings.debug) {
        this.showDebugNotification(`INFO: ${message}`);
      }
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[EnhancedScriptInjector] ${message}`, ...args);
      if (this.settings.debug) {
        this.showDebugNotification(`WARN: ${message}`, 'warning');
      }
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[EnhancedScriptInjector] ${message}`, ...args);
      if (this.settings.debug) {
        this.showDebugNotification(`ERROR: ${message}`, 'error');
      }
    },
    debug: (message: string, ...args: any[]) => {
      if (this.settings.debug) {
        console.debug(`[EnhancedScriptInjector] ${message}`, ...args);
      }
    }
  };

  /**
   * 创建增强版脚本注入器实例
   */
  constructor(
    private storage: ObsidianStorage,
    private scriptManager: ScriptManager,
    settings?: Partial<typeof this.settings>
  ) {
    // 合并用户提供的设置
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }
    this.logger.info('增强版注入器初始化完成');
  }

  /**
   * 设置注入器选项
   */
  setSettings(settings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...settings };
    this.logger.debug('已更新注入器设置', this.settings);
  }

  /**
   * 启用调试模式
   */
  enableDebug(enable: boolean = true): void {
    this.settings.debug = enable;
    this.logger.info(`调试模式${enable ? '已启用' : '已禁用'}`);
  }

  /**
   * 显示调试通知（在调试模式下）
   */
  private showDebugNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    // 这里可以根据Obsidian API来实现通知
    // 暂时使用console输出
    const prefix = type === 'error' ? '🔴' : type === 'warning' ? '🟠' : '🔵';
    console.log(`${prefix} ${message}`);
    
    // 未来可以实现一个通知系统，将消息显示到UI中
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

      // 根据run-at属性分类脚本
      const documentStartScripts = scripts.filter(s => s.runAt === 'document-start');
      const documentEndScripts = scripts.filter(s => s.runAt === 'document-end');
      const documentIdleScripts = scripts.filter(s => 
        s.runAt === 'document-idle' || !s.runAt
      );

      this.logger.debug(`分类脚本: start=${documentStartScripts.length}, end=${documentEndScripts.length}, idle=${documentIdleScripts.length}`);

      // 处理iframe元素
      if (webview instanceof HTMLIFrameElement) {
        // 注入document-start脚本
        for (const script of documentStartScripts) {
          if (await this.shouldInjectScript(webview, script, url)) {
            await this.injectSingleScript(webview, url, script);
          }
        }
        
        // 处理document-end脚本
        this.setupContentLoadedListener(webview, url, documentEndScripts);
        
        // 处理document-idle脚本
        this.setupLoadListener(webview, url, documentIdleScripts);
      } 
      // 处理其他类型的webview
      else {
        // 为所有脚本添加webview支持
        for (const script of scripts) {
          if (await this.shouldInjectScript(webview, script, url)) {
            await this.injectSingleScript(webview, url, script);
          }
        }
      }
    } catch (error) {
      this.logger.error(`注入脚本过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 为给定URL和WebView/iframe注入匹配的脚本
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
   * 检查是否应该注入脚本
   * - 避免重复注入
   * - 支持强制重新注入
   */
  private async shouldInjectScript(
    webview: HTMLElement, 
    script: UserScript, 
    url: string, 
    forceReinject: boolean = false
  ): Promise<boolean> {
    // 如果不检查重复注入或强制重新注入，则直接返回true
    if (!this.settings.checkDuplicateInjection || forceReinject) {
      return true;
    }

    try {
      // 检查DOM中是否已有注入标记
      if (webview instanceof HTMLIFrameElement && webview.contentDocument) {
        const markerId = `${this.settings.injectionMarkerPrefix}${script.id}`;
        const existingMarker = webview.contentDocument.getElementById(markerId);
        
        if (existingMarker) {
          this.logger.debug(`脚本 ${script.name} 已注入到 ${url}，跳过`);
          return false;
        }
      }

      // 检查内存中的注入记录
      const pageScripts = this.injectedScripts.get(url);
      if (pageScripts && pageScripts.has(script.id)) {
        this.logger.debug(`脚本 ${script.name} 已在内存中标记为注入到 ${url}，跳过`);
        return false;
      }

      return true;
    } catch (error) {
      // 如果检查过程中出错（如跨域访问限制），为安全起见返回true
      this.logger.warn(`检查脚本注入状态时出错: ${error.message}，将继续注入`);
      return true;
    }
  }

  /**
   * 注入单个脚本，处理所有相关逻辑
   */
  private async injectSingleScript(
    webview: HTMLElement, 
    url: string, 
    script: UserScript, 
    retryCount: number = 0
  ): Promise<boolean> {
    try {
      this.logger.debug(`开始注入脚本 "${script.name}" 到 ${url}`);
      
      // 准备GM API和脚本包装
      const scriptWithGM = this.prepareScriptWithGMAPI(script, url);
      
      // 根据元素类型选择不同的注入方法
      let success = false;
      if (webview instanceof HTMLIFrameElement) {
        success = await this.injectScriptToIframe(webview, scriptWithGM, script);
      } else {
        success = await this.injectScriptToWebview(webview, scriptWithGM, script);
      }
      
      if (success) {
        // 记录注入成功
        this.markScriptAsInjected(url, script.id);
        this.logger.info(`脚本 "${script.name}" 注入成功`);
        return true;
      } else {
        throw new Error("注入失败");
      }
    } catch (error) {
      this.logger.error(`脚本 "${script.name}" 注入失败: ${error.message}`);
      
      // 尝试重试
      if (retryCount < this.settings.maxRetries) {
        this.logger.debug(`尝试重新注入脚本 "${script.name}"，尝试次数: ${retryCount + 1}/${this.settings.maxRetries}`);
        return await this.injectSingleScript(webview, url, script, retryCount + 1);
      }
      
      return false;
    }
  }

  /**
   * 记录脚本已被注入
   */
  private markScriptAsInjected(url: string, scriptId: string): void {
    if (!this.injectedScripts.has(url)) {
      this.injectedScripts.set(url, new Set());
    }
    this.injectedScripts.get(url)?.add(scriptId);
  }

  /**
   * 向iframe注入脚本
   */
  private async injectScriptToIframe(
    iframe: HTMLIFrameElement, 
    scriptContent: string,
    script: UserScript
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        // 确保iframe已经加载
        const checkIframeReady = () => {
          try {
            // 检查iframe是否可访问
            if (iframe.contentWindow && iframe.contentDocument) {
              // 检查是否已经注入
              const markerId = `${this.settings.injectionMarkerPrefix}${script.id}`;
              if (iframe.contentDocument.getElementById(markerId)) {
                this.logger.debug(`脚本 ${script.name} 已有标记，跳过注入`);
                resolve(true);
                return;
              }
              
              // 创建脚本元素
              const scriptElement = iframe.contentDocument.createElement('script');
              scriptElement.textContent = scriptContent;
              scriptElement.setAttribute('data-script-id', script.id);
              scriptElement.setAttribute('data-script-name', script.name);
              
              // 设置加载和错误处理
              scriptElement.onload = () => {
                this.addInjectionMarker(iframe, script);
                resolve(true);
              };
              
              scriptElement.onerror = (error) => {
                this.logger.error(`脚本 ${script.name} 加载失败: ${error}`);
                resolve(false);
              };
              
              // 添加到document
              if (iframe.contentDocument.head) {
                iframe.contentDocument.head.appendChild(scriptElement);
              } else if (iframe.contentDocument.body) {
                iframe.contentDocument.body.appendChild(scriptElement);
              } else {
                iframe.contentDocument.documentElement.appendChild(scriptElement);
              }
            } else {
              // 持续检查直到iframe准备就绪
              setTimeout(checkIframeReady, 100);
            }
          } catch (error) {
            this.logger.error(`准备iframe时出错: ${error.message}`);
            resolve(false);
          }
        };
        
        checkIframeReady();
      } catch (error) {
        this.logger.error(`向iframe注入脚本时出错: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * 添加注入标记到iframe
   */
  private addInjectionMarker(iframe: HTMLIFrameElement, script: UserScript): void {
    try {
      if (!iframe.contentDocument || !iframe.contentDocument.body) {
        return;
      }
      
      // 创建一个隐藏元素作为标记
      const marker = iframe.contentDocument.createElement('div');
      marker.id = `${this.settings.injectionMarkerPrefix}${script.id}`;
      marker.style.display = 'none';
      marker.dataset.scriptId = script.id;
      marker.dataset.scriptName = script.name;
      marker.dataset.injectionTime = Date.now().toString();
      
      // 添加到body
      iframe.contentDocument.body.appendChild(marker);
      this.logger.debug(`已为脚本 ${script.name} 添加注入标记`);
    } catch (error) {
      this.logger.warn(`无法添加注入标记: ${error.message}`);
    }
  }

  /**
   * 向webview注入脚本
   */
  private async injectScriptToWebview(
    webview: HTMLElement, 
    scriptContent: string,
    script: UserScript
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        // 对于webview元素，尝试使用不同的注入方法
        const webviewEl = webview as any;
        
        // 方法1: 使用executeJavaScript (Electron webview)
        if (typeof webviewEl.executeJavaScript === 'function') {
          // 包装脚本，添加标记逻辑
          const wrappedScript = `
            (function() {
              try {
                // 检查是否已注入
                if (document.getElementById('${this.settings.injectionMarkerPrefix}${script.id}')) {
                  console.log('脚本已注入，跳过');
                  return true;
                }
                
                // 执行脚本
                ${scriptContent}
                
                // 添加标记
                const marker = document.createElement('div');
                marker.id = '${this.settings.injectionMarkerPrefix}${script.id}';
                marker.style.display = 'none';
                marker.dataset.scriptId = '${script.id}';
                marker.dataset.scriptName = '${script.name}';
                marker.dataset.injectionTime = '${Date.now()}';
                document.body.appendChild(marker);
                
                return true;
              } catch(e) {
                console.error('执行脚本出错:', e);
                return false;
              }
            })();
          `;
          
          webviewEl.executeJavaScript(wrappedScript)
            .then((result: boolean) => resolve(result))
            .catch((error: Error) => {
              this.logger.error(`使用executeJavaScript注入失败: ${error.message}`);
              this.injectWithFallbackMethod(webview, scriptContent, script)
                .then(resolve)
                .catch(() => resolve(false));
            });
        } 
        // 方法2: 使用contentWindow访问
        else if (webviewEl.contentWindow) {
          try {
            // 使用eval
            const result = this.injectWithEval(webviewEl, scriptContent, script);
            resolve(result);
          } catch (error) {
            this.logger.error(`使用contentWindow注入失败: ${error.message}`);
            this.injectWithFallbackMethod(webview, scriptContent, script)
              .then(resolve)
              .catch(() => resolve(false));
          }
        } 
        // 方法3: 备用方法
        else {
          this.injectWithFallbackMethod(webview, scriptContent, script)
            .then(resolve)
            .catch(() => resolve(false));
        }
      } catch (error) {
        this.logger.error(`向webview注入脚本时出错: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * 使用eval方法注入脚本
   */
  private injectWithEval(
    webview: any, 
    scriptContent: string, 
    script: UserScript
  ): boolean {
    try {
      // 检查是否已注入
      const checkScript = `
        document.getElementById('${this.settings.injectionMarkerPrefix}${script.id}') !== null
      `;
      
      const alreadyInjected = webview.contentWindow.eval(checkScript);
      if (alreadyInjected) {
        this.logger.debug(`脚本 ${script.name} 已注入到contentWindow，跳过`);
        return true;
      }
      
      // 注入脚本
      webview.contentWindow.eval(scriptContent);
      
      // 添加标记
      const markerScript = `
        const marker = document.createElement('div');
        marker.id = '${this.settings.injectionMarkerPrefix}${script.id}';
        marker.style.display = 'none';
        marker.dataset.scriptId = '${script.id}';
        marker.dataset.scriptName = '${script.name}';
        marker.dataset.injectionTime = '${Date.now()}';
        document.body.appendChild(marker);
      `;
      
      webview.contentWindow.eval(markerScript);
      return true;
    } catch (error) {
      this.logger.error(`使用eval注入脚本失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 使用备用方法注入脚本
   */
  private async injectWithFallbackMethod(
    webview: HTMLElement, 
    scriptContent: string, 
    script: UserScript
  ): Promise<boolean> {
    try {
      // 使用URL方法注入
      const blob = new Blob([scriptContent], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      
      const webviewEl = webview as any;
      
      // 方法1: 如果webview支持事件通信
      if (typeof webviewEl.send === 'function') {
        webviewEl.send('cheekychimp-inject-script', {
          scriptContent,
          scriptId: script.id,
          scriptName: script.name
        });
        return true;
      }
      
      // 方法2: 创建隐藏iframe作为桥接器
      return new Promise<boolean>((resolve) => {
        const bridgeFrame = document.createElement('iframe');
        bridgeFrame.style.display = 'none';
        bridgeFrame.onload = () => {
          try {
            // 添加脚本到桥接iframe
            const iframeDoc = bridgeFrame.contentDocument || bridgeFrame.contentWindow?.document;
            if (iframeDoc) {
              const scriptElement = iframeDoc.createElement('script');
              scriptElement.textContent = `
                (function() {
                  try {
                    // 尝试通过top或parent访问目标webview
                    const targetWindow = top || parent;
                    if (targetWindow) {
                      const event = new CustomEvent('cheekychimp-inject', {
                        detail: {
                          script: ${JSON.stringify(scriptContent)},
                          scriptId: '${script.id}',
                          scriptName: '${script.name}'
                        }
                      });
                      targetWindow.dispatchEvent(event);
                    }
                  } catch(e) {
                    console.error('桥接注入失败:', e);
                  }
                })();
              `;
              iframeDoc.head.appendChild(scriptElement);
              
              // 5秒后移除桥接iframe
              setTimeout(() => {
                document.body.removeChild(bridgeFrame);
              }, 5000);
              
              resolve(true);
            } else {
              resolve(false);
            }
          } catch (error) {
            this.logger.error(`桥接iframe注入失败: ${error.message}`);
            resolve(false);
          }
        };
        
        // 添加到文档
        document.body.appendChild(bridgeFrame);
        
        // 清理URL对象
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      });
    } catch (error) {
      this.logger.error(`备用注入方法失败: ${error.message}`);
      return false;
    }
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
   * 为iframe设置DOMContentLoaded监听器
   * 用于document-end脚本
   */
  private setupContentLoadedListener(
    iframe: HTMLIFrameElement, 
    url: string, 
    scripts: UserScript[]
  ): void {
    if (!scripts.length) return;
    
    try {
      // 检查iframe是否已加载
      if (iframe.contentDocument) {
        if (iframe.contentDocument.readyState === 'loading') {
          // 文档正在加载，添加事件监听器
          iframe.contentDocument.addEventListener('DOMContentLoaded', async () => {
            for (const script of scripts) {
              if (await this.shouldInjectScript(iframe, script, url)) {
                await this.injectSingleScript(iframe, url, script);
              }
            }
          });
        } else {
          // 文档已经加载完成，直接注入
          for (const script of scripts) {
            if (this.shouldInjectScript(iframe, script, url)) {
              this.injectSingleScript(iframe, url, script);
            }
          }
        }
      } else {
        // iframe可能跨域，使用load事件
        iframe.addEventListener('load', async () => {
          for (const script of scripts) {
            if (await this.shouldInjectScript(iframe, script, url)) {
              await this.injectSingleScript(iframe, url, script);
            }
          }
        });
      }
    } catch (error) {
      this.logger.error(`设置ContentLoaded监听器出错: ${error.message}`);
    }
  }

  /**
   * 为iframe设置load监听器
   * 用于document-idle脚本
   */
  private setupLoadListener(
    iframe: HTMLIFrameElement, 
    url: string, 
    scripts: UserScript[]
  ): void {
    if (!scripts.length) return;
    
    try {
      // 使用iframe的load事件
      const loadHandler = async () => {
        // 延迟一点时间，确保页面完全加载
        setTimeout(async () => {
          for (const script of scripts) {
            if (await this.shouldInjectScript(iframe, script, url)) {
              await this.injectSingleScript(iframe, url, script);
            }
          }
        }, 100);
      };
      
      // 添加load事件监听
      iframe.addEventListener('load', loadHandler);
      
      // 检查iframe是否已经加载完成
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        loadHandler();
      }
    } catch (error) {
      this.logger.error(`设置Load监听器出错: ${error.message}`);
    }
  }

  /**
   * 为元素注册刷新事件监听
   * 确保页面刷新后重新注入脚本
   */
  registerRefreshHandler(element: HTMLElement, url: string): void {
    try {
      if (element instanceof HTMLIFrameElement) {
        // 为iframe添加刷新监听
        element.addEventListener('load', async () => {
          if (this.settings.autoReinject) {
            // 清除此URL的注入记录，以允许重新注入
            this.injectedScripts.delete(url);
            this.logger.debug(`检测到iframe刷新，准备重新注入脚本: ${url}`);
            
            // 重新注入脚本
            await this.injectScriptsForUrl(element, url);
          }
        });
      } else {
        // 为其他webview元素添加刷新监听
        const webviewEl = element as any;
        if (typeof webviewEl.addEventListener === 'function') {
          // 监听导航事件
          webviewEl.addEventListener('did-navigate', async () => {
            if (this.settings.autoReinject) {
              // 获取新的URL
              const newUrl = webviewEl.src || webviewEl.getAttribute('src') || url;
              
              // 清除旧URL的注入记录
              this.injectedScripts.delete(url);
              this.logger.debug(`检测到webview导航，准备重新注入脚本: ${newUrl}`);
              
              // 重新注入脚本
              await this.injectScriptsForUrl(element, newUrl);
            }
          });
          
          // 监听刷新事件
          webviewEl.addEventListener('did-navigate-in-page', async () => {
            if (this.settings.autoReinject) {
              // 重新注入脚本，但不清除记录（在页内导航）
              this.logger.debug(`检测到webview页内导航，检查脚本: ${url}`);
              await this.injectScriptsForUrl(element, url);
            }
          });
        }
      }
    } catch (error) {
      this.logger.error(`注册刷新处理程序出错: ${error.message}`);
    }
  }

  /**
   * 手动重新注入脚本到指定元素
   * 用于用户手动触发重新注入
   */
  async reinjectScripts(element: HTMLElement, url: string): Promise<void> {
    try {
      // 清除此URL的注入记录
      this.injectedScripts.delete(url);
      this.logger.info(`手动重新注入脚本到: ${url}`);
      
      // 获取URL的匹配脚本
      const scripts = this.scriptManager.findScriptsForUrl(url);
      if (!scripts.length) {
        this.logger.info(`没有匹配URL [${url}] 的脚本`);
        return;
      }
      
      // 强制重新注入脚本，忽略重复检查
      for (const script of scripts) {
        await this.injectSingleScript(element, url, script);
      }
    } catch (error) {
      this.logger.error(`手动重新注入脚本出错: ${error.message}`);
    }
  }

  /**
   * 为脚本准备GM API并包装脚本
   */
  private prepareScriptWithGMAPI(script: UserScript, url: string): string {
    // 创建GM API
    const gmAPI = this.buildGMAPI(script, url);
    const gmInfo = this.buildGMInfo(script, url);
    
    // 包装脚本
    return this.wrapScriptWithAPI(script.source, gmAPI, gmInfo);
  }

  /**
   * 构建GM Info对象
   * 此方法应该从BackupScriptInjector中复制
   */
  private buildGMInfo(script: UserScript, url: string): any {
    // 实现从BackupScriptInjector复制
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
      scriptHandler: 'Obsidian CheekyChimp (Enhanced)',
      scriptMetaStr: this.getScriptMetaStr(script)
    };
  }

  /**
   * 构建GM API对象
   * 此方法应该从BackupScriptInjector中复制
   */
  private buildGMAPI(script: UserScript, url: string): any {
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
        return []; // 实际实现应该过滤属于此脚本的键
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
      GM_registerMenuCommand: (name: string, fn: Function, accessKey?: string): number => {
        // 实现菜单命令注册
        return 0;
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
      
      // 访问原始window对象
      unsafeWindow: window as any,
      
      // 支持新版GM API - Promise接口
      GM: {
        getValue: (name: string, defaultValue?: any) => Promise.resolve(self.storage.getValue(`${script.id}:${name}`, defaultValue) || defaultValue),
        setValue: (name: string, value: any) => {
          self.storage.setValue(`${script.id}:${name}`, value);
          return Promise.resolve();
        },
        deleteValue: (name: string) => {
          self.storage.deleteValue(`${script.id}:${name}`);
          return Promise.resolve();
        },
        listValues: () => Promise.resolve([]),
        getResourceUrl: (name: string) => Promise.resolve(''),
        xmlHttpRequest: (details: any) => null,
        addStyle: (css: string) => Promise.resolve(null),
        registerMenuCommand: (name: string, fn: Function, accessKey?: string) => Promise.resolve(0)
      }
    };
  }

  /**
   * 包装脚本与GM API
   * 此方法应该从BackupScriptInjector中复制
   */
  private wrapScriptWithAPI(scriptSource: string, gmAPI: any, gmInfo: any): string {
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
                console.error('[CheekyChimp Enhanced] 加载依赖失败:', url);
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
    
    // 创建一个包含所有GM API的上下文
    let gmApiStr = '';
    
    // 添加每个API函数
    gmApiStr += `
      const GM_getValue = function(name, defaultValue) {
        try {
          const value = window.localStorage.getItem('CheekyChimp_' + '${gmInfo.script.name}_' + name);
          return value === null ? defaultValue : JSON.parse(value);
        } catch(e) {
          console.error('[CheekyChimp Enhanced] GM_getValue错误:', e);
          return defaultValue;
        }
      };
      
      const GM_setValue = function(name, value) {
        try {
          window.localStorage.setItem('CheekyChimp_' + '${gmInfo.script.name}_' + name, JSON.stringify(value));
        } catch(e) {
          console.error('[CheekyChimp Enhanced] GM_setValue错误:', e);
        }
      };
      
      const GM_deleteValue = function(name) {
        try {
          window.localStorage.removeItem('CheekyChimp_' + '${gmInfo.script.name}_' + name);
        } catch(e) {
          console.error('[CheekyChimp Enhanced] GM_deleteValue错误:', e);
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
          console.error('[CheekyChimp Enhanced] GM_listValues错误:', e);
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
          console.error('[CheekyChimp Enhanced] GM_addStyle错误:', e);
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
          console.error('[CheekyChimp Enhanced] GM_xmlhttpRequest错误:', e);
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
        console.log('[CheekyChimp Enhanced] 注册菜单命令:', name);
        return 1; // 返回一个虚拟ID
      };
      
      const GM_unregisterMenuCommand = function(id) {
        console.log('[CheekyChimp Enhanced] 注销菜单命令:', id);
      };
      
      const GM_openInTab = function(url, options) {
        try {
          window.open(url, '_blank');
        } catch(e) {
          console.error('[CheekyChimp Enhanced] GM_openInTab错误:', e);
        }
      };
      
      const GM_setClipboard = function(text) {
        try {
          // 这在实际情况下需要特殊权限
          console.log('[CheekyChimp Enhanced] 设置剪贴板内容:', text);
        } catch(e) {
          console.error('[CheekyChimp Enhanced] GM_setClipboard错误:', e);
        }
      };
      
      // 资源访问函数
      const GM_getResourceText = function(name) {
        console.log('[CheekyChimp Enhanced] 获取资源文本:', name);
        return '';
      };
      
      const GM_getResourceURL = function(name) {
        console.log('[CheekyChimp Enhanced] 获取资源URL:', name);
        return '';
      };
      
      // 通知函数
      const GM_notification = function(details) {
        try {
          console.log('[CheekyChimp Enhanced] 显示通知:', details.title || '通知', details.text);
          if (typeof Notification !== 'undefined') {
            new Notification(details.title || '通知', {
              body: details.text,
              icon: details.image
            });
          }
        } catch(e) {
          console.error('[CheekyChimp Enhanced] GM_notification错误:', e);
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
          console.error('[CheekyChimp Enhanced] 运行脚本时出错:', e);
        }
      })();
    `;
  }

  /**
   * 获取脚本元数据字符串
   */
  private getScriptMetaStr(script: UserScript): string {
    const metaLines = [];
    
    metaLines.push('// ==UserScript==');
    
    if (script.name) metaLines.push(`// @name ${script.name}`);
    if (script.namespace) metaLines.push(`// @namespace ${script.namespace}`);
    if (script.version) metaLines.push(`// @version ${script.version}`);
    if (script.description) metaLines.push(`// @description ${script.description}`);
    if (script.author) metaLines.push(`// @author ${script.author}`);
    if (script.homepage) metaLines.push(`// @homepage ${script.homepage}`);
    if (script.icon) metaLines.push(`// @icon ${script.icon}`);
    
    script.includes.forEach(include => {
      metaLines.push(`// @include ${include}`);
    });
    
    script.matches.forEach(match => {
      metaLines.push(`// @match ${match}`);
    });
    
    script.excludes.forEach(exclude => {
      metaLines.push(`// @exclude ${exclude}`);
    });
    
    script.requires.forEach(require => {
      metaLines.push(`// @require ${require}`);
    });
    
    script.resources.forEach(resource => {
      metaLines.push(`// @resource ${resource.name} ${resource.url}`);
    });
    
    if (script.runAt) metaLines.push(`// @run-at ${script.runAt}`);
    
    metaLines.push('// ==/UserScript==');
    
    return metaLines.join('\n');
  }
} 