import { UserScript } from '../../models/script';
import { NotificationDetails } from './gm-api-types';
import { APICallError } from '../error/error-types';

/**
 * UI API服务，负责处理用户界面相关功能
 */
export class UIAPI {
  private script: UserScript;
  
  /**
   * 创建UI API实例
   * @param script 脚本对象
   */
  constructor(script: UserScript) {
    this.script = script;
    
    // 绑定方法
    this.addStyle = this.addStyle.bind(this);
    this.addStyleAsync = this.addStyleAsync.bind(this);
    this.registerMenuCommand = this.registerMenuCommand.bind(this);
    this.registerMenuCommandAsync = this.registerMenuCommandAsync.bind(this);
    this.unregisterMenuCommand = this.unregisterMenuCommand.bind(this);
    this.addElement = this.addElement.bind(this);
    this.addElementAsync = this.addElementAsync.bind(this);
    this.notification = this.notification.bind(this);
  }
  
  /**
   * 添加CSS样式
   * @param css CSS样式内容
   * @returns 样式元素或undefined（如果失败）
   */
  addStyle(css: string): HTMLStyleElement | void {
    try {
      const style = document.createElement('style');
      style.textContent = css;
      style.setAttribute('data-cheekychimp-style', this.script.id);
      document.head.appendChild(style);
      return style;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('CheekyChimp: 添加样式失败:', err);
    }
  }
  
  /**
   * 异步添加CSS样式
   * @param css CSS样式内容
   * @returns Promise，解析为样式元素
   */
  async addStyleAsync(css: string): Promise<HTMLStyleElement> {
    try {
      const style = document.createElement('style');
      style.textContent = css;
      style.setAttribute('data-cheekychimp-style', this.script.id);
      document.head.appendChild(style);
      return style;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new APICallError('GM.addStyle', err.message);
    }
  }
  
  /**
   * 注册菜单命令
   * @param name 命令名称
   * @param fn 命令回调函数
   * @param accessKey 快捷键（可选）
   * @returns 命令ID
   */
  registerMenuCommand(name: string, fn: Function, accessKey?: string): number {
    try {
      console.log(`CheekyChimp: 脚本注册菜单命令:`, name);
      
      // 生成唯一命令ID
      const commandId = Date.now() + Math.floor(Math.random() * 1000);
      
      // 存储命令到localStorage
      const commandsKey = `cheekychimp_commands:${this.script.id}`;
      let commands = [];
      try {
        const savedCommands = localStorage.getItem(commandsKey);
        if (savedCommands) {
          commands = JSON.parse(savedCommands);
        }
      } catch (e) {
        // 如果解析失败，使用空数组
      }
      
      commands.push({
        id: commandId,
        name: name,
        accessKey: accessKey || ''
      });
      
      localStorage.setItem(commandsKey, JSON.stringify(commands));
      
      // 创建菜单项目
      setTimeout(() => {
        this.createMenuButton(name, fn, commandId);
      }, 500);
      
      return commandId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('CheekyChimp: 注册菜单命令失败:', err);
      return -1;
    }
  }
  
  /**
   * 异步注册菜单命令
   * @param name 命令名称
   * @param fn 命令回调函数
   * @param accessKey 快捷键（可选）
   * @returns Promise，解析为命令ID
   */
  async registerMenuCommandAsync(name: string, fn: Function, accessKey?: string): Promise<number> {
    return this.registerMenuCommand(name, fn, accessKey);
  }
  
  /**
   * 注销菜单命令
   * @param menuCmdId 命令ID
   */
  unregisterMenuCommand(menuCmdId: number): void {
    try {
      // 从localStorage中移除命令
      const commandsKey = `cheekychimp_commands:${this.script.id}`;
      let commands = [];
      try {
        const savedCommands = localStorage.getItem(commandsKey);
        if (savedCommands) {
          commands = JSON.parse(savedCommands);
          commands = commands.filter((cmd: any) => cmd.id !== menuCmdId);
          localStorage.setItem(commandsKey, JSON.stringify(commands));
        }
      } catch (e) {
        console.error('解析保存的命令失败:', e);
      }
      
      // 移除事件监听器
      document.removeEventListener(`cheekychimp-run-command-${menuCmdId}`, () => {});
      
      // 触发命令注销事件
      const event = new CustomEvent('cheekychimp-command-unregistered', {
        detail: {
          scriptId: this.script.id,
          commandId: menuCmdId
        }
      });
      document.dispatchEvent(event);
      
      console.log(`CheekyChimp: 已注销菜单命令 ID ${menuCmdId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`CheekyChimp: 注销菜单命令 ID ${menuCmdId} 失败:`, err);
    }
  }
  
  /**
   * 添加DOM元素
   * @param tagName 标签名
   * @param attributes 属性对象
   * @returns 创建的元素
   */
  addElement(tagName: string, attributes: Record<string, string>): HTMLElement {
    const element = document.createElement(tagName);
    for (const [attr, value] of Object.entries(attributes)) {
      element.setAttribute(attr, value);
    }
    document.body.appendChild(element);
    return element;
  }
  
  /**
   * 异步添加DOM元素
   * @param tagName 标签名
   * @param attributes 属性对象
   * @returns Promise，解析为创建的元素
   */
  async addElementAsync(tagName: string, attributes: Record<string, string>): Promise<HTMLElement> {
    return this.addElement(tagName, attributes);
  }
  
  /**
   * 显示通知
   * 该方法与GM_notification接口保持一致
   * @param details 通知详情对象或通知文本
   * @param _title 标题（当details为字符串时）- 为保持接口兼容
   * @param _image 图片URL（当details为字符串时）- 为保持接口兼容
   * @param _onclick 点击回调（当details为字符串时）- 为保持接口兼容
   */
  notification(
    details: NotificationDetails | string,
    _title?: string,
    _image?: string,
    _onclick?: () => void
  ): void {
    try {
      console.warn('CheekyChimp: GM_notification 未完全实现');
      
      // 处理不同参数形式
      let text: string;
      let callback: (() => void) | undefined;
      
      if (typeof details === 'string') {
        // 简单文本通知
        text = details;
        callback = _onclick;
      } else {
        // 详细通知对象
        text = details.text;
        callback = details.onclick;
      }
      
      // 显示简单提示
      alert(text);
      
      // 执行回调（如果有）
      if (callback) {
        setTimeout(callback, 10);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('CheekyChimp: 显示通知失败:', err);
    }
  }
  
  /**
   * 创建菜单按钮
   * @param name 按钮名称
   * @param fn 点击回调
   * @param commandId 命令ID
   */
  private createMenuButton(name: string, fn: Function, commandId: number): void {
    try {
      // 检查是否已经有菜单容器
      let menuContainer = document.getElementById('cheekychimp-menu-container');
      if (!menuContainer) {
        // 创建菜单容器
        menuContainer = document.createElement('div');
        menuContainer.id = 'cheekychimp-menu-container';
        menuContainer.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; display: none; background: white; border: 1px solid #ccc; border-radius: 5px; padding: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);';
        document.body.appendChild(menuContainer);
        
        // 创建菜单图标
        const menuIcon = document.createElement('div');
        menuIcon.id = 'cheekychimp-menu-icon';
        menuIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 512 512"><path fill="currentColor" d="M108.12 0L0 108.12v295.76L108.12 512h295.76L512 403.88V108.12L403.88 0zm71.84 107.25c9.02 0 16.56 7.54 16.56 16.56v49h58.07c9.02 0 16.56 7.54 16.56 16.56v87.19c0 9.02-7.54 16.56-16.56 16.56h-58.07v52c0 9.02-7.54 16.56-16.56 16.56h-127c-9.02 0-16.56-7.54-16.56-16.56v-52h-58.07c-9.02 0-16.56-7.54-16.56-16.56v-87.19c0-9.02 7.54-16.56 16.56-16.56h58.07v-49c0-9.02 7.54-16.56 16.56-16.56z"/></svg>';
        menuIcon.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 10000; cursor: pointer; width: 24px; height: 24px; background: white; border-radius: 50%; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
        document.body.appendChild(menuIcon);
        
        // 添加点击事件
        menuIcon.addEventListener('click', function() {
          menuContainer!.style.display = menuContainer!.style.display === 'none' ? 'block' : 'none';
        });
      }
      
      // 添加命令按钮
      const commandButton = document.createElement('button');
      commandButton.textContent = name;
      commandButton.style.cssText = 'display: block; width: 100%; margin: 5px 0; padding: 5px 10px; border: none; background: #f0f0f0; border-radius: 3px; cursor: pointer;';
      commandButton.addEventListener('click', () => {
        menuContainer!.style.display = 'none';
        try {
          fn();
        } catch(e) {
          console.error('CheekyChimp: 执行命令失败', e);
        }
      });
      menuContainer.appendChild(commandButton);
    } catch(error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('CheekyChimp: 创建菜单项失败', err);
    }
  }
} 