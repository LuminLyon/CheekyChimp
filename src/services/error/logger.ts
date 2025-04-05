/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 100  // 用于完全禁用日志
}

/**
 * 日志服务配置
 */
export interface LoggerConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 是否在控制台输出 */
  console: boolean;
  /** 是否包含时间戳 */
  timestamp: boolean;
  /** 前缀 */
  prefix: string;
}

/**
 * 日志服务，提供统一的日志记录功能
 */
export class Logger {
  private config: LoggerConfig;
  
  /**
   * 创建日志服务实例
   */
  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      console: true,
      timestamp: true,
      prefix: 'CheekyChimp',
      ...config
    };
  }
  
  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
  
  /**
   * 记录调试级别日志
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }
  
  /**
   * 记录信息级别日志
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }
  
  /**
   * 记录警告级别日志
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }
  
  /**
   * 记录错误级别日志
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }
  
  /**
   * 记录日志
   * @param level 日志级别
   * @param message 日志消息
   * @param args 附加参数
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }
    
    // 格式化日志消息
    const timestamp = this.config.timestamp ? `[${new Date().toISOString()}] ` : '';
    const prefix = `${timestamp}[${this.config.prefix}] `;
    const formattedMessage = `${prefix}${message}`;
    
    // 输出到控制台
    if (this.config.console) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, ...args);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, ...args);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, ...args);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, ...args);
          break;
      }
    }
    
    // 这里可以添加其他日志输出方式，如文件记录、远程日志服务等
  }
} 