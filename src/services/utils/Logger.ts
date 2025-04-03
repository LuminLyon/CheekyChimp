/**
 * 日志级别枚举
 */
export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}

/**
 * 统一的日志处理类
 */
export class Logger {
    private static globalLevel: LogLevel = LogLevel.INFO;
    private source: string;
    
    /**
     * 创建一个新的日志记录器
     * @param source 日志来源组件名称
     */
    constructor(source: string) {
        this.source = source;
    }
    
    /**
     * 设置全局日志级别
     */
    public static setGlobalLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }
    
    /**
     * 输出调试级别日志
     */
    public debug(message: string, ...args: any[]): void {
        if (Logger.globalLevel <= LogLevel.DEBUG) {
            console.debug(`[CheekyChimp:${this.source}] ${message}`, ...args);
        }
    }
    
    /**
     * 输出信息级别日志
     */
    public info(message: string, ...args: any[]): void {
        if (Logger.globalLevel <= LogLevel.INFO) {
            console.info(`[CheekyChimp:${this.source}] ${message}`, ...args);
        }
    }
    
    /**
     * 输出警告级别日志
     */
    public warn(message: string, ...args: any[]): void {
        if (Logger.globalLevel <= LogLevel.WARN) {
            console.warn(`[CheekyChimp:${this.source}] ${message}`, ...args);
        }
    }
    
    /**
     * 输出错误级别日志
     */
    public error(message: string, ...args: any[]): void {
        if (Logger.globalLevel <= LogLevel.ERROR) {
            console.error(`[CheekyChimp:${this.source}] ${message}`, ...args);
        }
    }
} 