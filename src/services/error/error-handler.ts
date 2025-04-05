import { 
  CheekyChimpError, 
  ScriptInjectionError, 
  ScriptParsingError,
  ResourceLoadError,
  APICallError,
  StorageError
} from './error-types';
import { Logger } from '../logging/logger';

/**
 * 错误处理级别
 */
export enum ErrorHandlingLevel {
  /**
   * 仅记录日志，不显示给用户
   */
  LOG = 'log',
  
  /**
   * 记录警告日志，可能显示给用户
   */
  WARN = 'warn',
  
  /**
   * 显示错误通知给用户
   */
  NOTIFY = 'notify',
  
  /**
   * 严重错误，必须显示给用户
   */
  ERROR = 'error'
}

/**
 * 统一错误处理服务
 */
export class ErrorHandler {
  private static logger = new Logger('ErrorHandler');

  /**
   * 处理错误
   * @param error 错误对象
   * @param context 错误发生的上下文
   * @param level 错误处理级别
   */
  public static handle(error: Error, context: string, level: ErrorHandlingLevel = ErrorHandlingLevel.LOG): void {
    // 记录错误
    const errorMessage = `${context}: ${error.message}`;
    
    switch (level) {
      case ErrorHandlingLevel.ERROR:
        this.logger.error(errorMessage, error);
        this.showErrorNotification(errorMessage);
        break;
        
      case ErrorHandlingLevel.NOTIFY:
        this.logger.warn(errorMessage, error);
        this.showErrorNotification(errorMessage);
        break;
        
      case ErrorHandlingLevel.WARN:
        this.logger.warn(errorMessage, error);
        break;
        
      case ErrorHandlingLevel.LOG:
      default:
        this.logger.info(errorMessage);
        break;
    }
  }
  
  /**
   * 显示错误通知
   * @param message 错误消息
   */
  private static showErrorNotification(message: string): void {
    try {
      // 简单的错误通知实现
      console.error(`CheekyChimp错误: ${message}`);
      
      // 如果在浏览器环境，可以使用更友好的通知
      if (typeof window !== 'undefined') {
        // 尝试使用Obsidian的Notice API，如果可用
        if (typeof (window as any).Notice === 'function') {
          new (window as any).Notice(`CheekyChimp错误: ${message}`);
        } else {
          // 后备方案：使用原生alert (不推荐，但作为最后手段)
          // 仅在重要错误时考虑
          // alert(`CheekyChimp错误: ${message}`);
        }
      }
    } catch (e) {
      // 确保错误处理本身不会抛出更多错误
      console.error('显示错误通知时出错:', e);
    }
  }
} 