import { UserScript, ScriptStorage } from '../../models/script';
import { StorageError } from '../error/error-types';

/**
 * 存储API服务，负责管理脚本数据的存储和访问
 */
export class StorageAPI {
  private storage: ScriptStorage;
  private script: UserScript;
  
  /**
   * 创建存储API实例
   * @param storage 存储服务
   * @param script 脚本对象
   */
  constructor(storage: ScriptStorage, script: UserScript) {
    this.storage = storage;
    this.script = script;
    
    // 绑定方法的this，使其可以作为独立函数使用
    this.getValue = this.getValue.bind(this);
    this.setValue = this.setValue.bind(this);
    this.deleteValue = this.deleteValue.bind(this);
    this.listValues = this.listValues.bind(this);
    this.getValueAsync = this.getValueAsync.bind(this);
    this.setValueAsync = this.setValueAsync.bind(this);
    this.deleteValueAsync = this.deleteValueAsync.bind(this);
    this.listValuesAsync = this.listValuesAsync.bind(this);
  }
  
  /**
   * 生成存储键
   * @param name 原始键名
   * @returns 带有脚本ID前缀的存储键
   */
  private getStorageKey(name: string): string {
    return `${this.script.id}:${name}`;
  }
  
  /**
   * 同步获取存储的值
   * @param name 键名
   * @param defaultValue 默认值
   * @returns 存储的值或默认值
   */
  getValue(name: string, defaultValue?: any): any {
    try {
      // 首先尝试从localStorage获取(同步方式)
      const localStorageKey = `cheekychimp:${this.script.id}:${name}`;
      const value = localStorage.getItem(localStorageKey);
      
      if (value !== null) {
        return value;
      }
      
      // 如果localStorage中没有，返回默认值
      return defaultValue;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`获取存储值失败 (${name}):`, err);
      return defaultValue;
    }
  }
  
  /**
   * 同步设置存储的值
   * @param name 键名
   * @param value 值
   */
  setValue(name: string, value: any): void {
    try {
      // 存储到localStorage(同步方式)
      const localStorageKey = `cheekychimp:${this.script.id}:${name}`;
      localStorage.setItem(localStorageKey, value);
      
      // 也异步存储到插件的存储中
      this.setValueAsync(name, value).catch(error => {
        console.error(`异步存储值失败 (${name}):`, error);
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`设置存储值失败 (${name}):`, err);
    }
  }
  
  /**
   * 同步删除存储的值
   * @param name 键名
   */
  deleteValue(name: string): void {
    try {
      // 从localStorage删除(同步方式)
      const localStorageKey = `cheekychimp:${this.script.id}:${name}`;
      localStorage.removeItem(localStorageKey);
      
      // 也异步从插件的存储中删除
      this.deleteValueAsync(name).catch(error => {
        console.error(`异步删除值失败 (${name}):`, error);
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`删除存储值失败 (${name}):`, err);
    }
  }
  
  /**
   * 同步列出所有存储的键
   * @returns 键名数组
   */
  listValues(): string[] {
    try {
      const keys = [];
      const prefix = `cheekychimp:${this.script.id}:`;
      
      // 从localStorage获取键(同步方式)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key.substring(prefix.length));
        }
      }
      
      return keys;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("列出存储键失败:", err);
      return [];
    }
  }
  
  /**
   * 异步获取存储的值
   * @param name 键名
   * @param defaultValue 默认值
   * @returns Promise，解析为存储的值或默认值
   */
  async getValueAsync(name: string, defaultValue?: any): Promise<any> {
    try {
      const key = this.getStorageKey(name);
      return await this.storage.getValue(key, defaultValue);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new StorageError('get', `获取键 "${name}" 失败: ${err.message}`);
    }
  }
  
  /**
   * 异步设置存储的值
   * @param name 键名
   * @param value 值
   * @returns Promise，在操作完成时解析
   */
  async setValueAsync(name: string, value: any): Promise<void> {
    try {
      const key = this.getStorageKey(name);
      await this.storage.setValue(key, value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new StorageError('set', `设置键 "${name}" 失败: ${err.message}`);
    }
  }
  
  /**
   * 异步删除存储的值
   * @param name 键名
   * @returns Promise，在操作完成时解析
   */
  async deleteValueAsync(name: string): Promise<void> {
    try {
      const key = this.getStorageKey(name);
      await this.storage.deleteValue(key);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new StorageError('delete', `删除键 "${name}" 失败: ${err.message}`);
    }
  }
  
  /**
   * 异步列出所有存储的键
   * @returns Promise，解析为键名数组
   */
  async listValuesAsync(): Promise<string[]> {
    try {
      const allKeys = await this.storage.listValues();
      const prefix = `${this.script.id}:`;
      
      // 过滤属于当前脚本的键并移除前缀
      return allKeys
        .filter(key => key.startsWith(prefix))
        .map(key => key.substring(prefix.length));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new StorageError('list', `列出存储键失败: ${err.message}`);
    }
  }
} 