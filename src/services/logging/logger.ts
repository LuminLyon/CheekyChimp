/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * 日志记录服务
 */
export class Logger {
  private static readonly LOG_PREFIX = 'CheekyChimp';
  private static globalLogLevel: LogLevel = LogLevel.INFO;

  /**
   * 创建日志记录器实例
   * @param moduleName 模块名称
   */
  constructor(private moduleName: string = '') {
    this.moduleName = moduleName;
  }

  /**
   * 设置全局日志级别
   * @param level 日志级别
   */
  static setGlobalLogLevel(level: LogLevel): void {
    Logger.globalLogLevel = level;
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param optionalParams 可选参数
   */
  debug(message: string, ...optionalParams: any[]): void {
    if (Logger.globalLogLevel <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message), ...optionalParams);
    }
  }

  /**
   * 记录信息日志
   * @param message 日志消息
   * @param optionalParams 可选参数
   */
  info(message: string, ...optionalParams: any[]): void {
    if (Logger.globalLogLevel <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message), ...optionalParams);
    }
  }

  /**
   * 记录警告日志
   * @param message 日志消息
   * @param optionalParams 可选参数
   */
  warn(message: string, ...optionalParams: any[]): void {
    if (Logger.globalLogLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...optionalParams);
    }
  }

  /**
   * 记录错误日志
   * @param message 日志消息
   * @param optionalParams 可选参数
   */
  error(message: string, ...optionalParams: any[]): void {
    if (Logger.globalLogLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message), ...optionalParams);
    }
  }

  /**
   * 格式化日志消息
   * @param level 日志级别
   * @param message 消息内容
   * @returns 格式化后的消息
   */
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const modulePrefix = this.moduleName ? `[${this.moduleName}]` : '';
    return `${Logger.LOG_PREFIX} ${timestamp} ${level}${modulePrefix}: ${message}`;
  }
} 