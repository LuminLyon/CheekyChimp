/**
 * 日志服务，用于收集和导出调试日志
 */
export class LogService {
    private static instance: LogService;
    private logs: LogEntry[] = [];
    private maxLogEntries = 1000; // 最大日志条目数，防止内存溢出
    private verboseMode = false;
    private injectionLogs: InjectionLog[] = []; // 专门存储注入日志
    private maxInjectionLogs = 100; // 最大注入日志数

    // 私有构造函数，单例模式
    private constructor() {}

    /**
     * 获取单例实例
     */
    public static getInstance(): LogService {
        if (!LogService.instance) {
            LogService.instance = new LogService();
        }
        return LogService.instance;
    }

    /**
     * 开启详细日志模式
     */
    public enableVerboseMode(): void {
        this.verboseMode = true;
        this.debug("详细日志模式已启用");
    }

    /**
     * 禁用详细日志模式
     */
    public disableVerboseMode(): void {
        this.debug("详细日志模式已禁用");
        this.verboseMode = false;
    }

    /**
     * 记录信息级日志
     */
    public info(message: string, context?: any): void {
        this.addLog("INFO", message, context);
        console.info(`[CheekyChimp:INFO] ${message}`, context ? context : "");
    }

    /**
     * 记录调试级日志
     */
    public debug(message: string, context?: any): void {
        this.addLog("DEBUG", message, context);
        if (this.verboseMode) {
            console.debug(`[CheekyChimp:DEBUG] ${message}`, context ? context : "");
        }
    }

    /**
     * 记录警告级日志
     */
    public warn(message: string, context?: any): void {
        this.addLog("WARN", message, context);
        console.warn(`[CheekyChimp:WARN] ${message}`, context ? context : "");
    }

    /**
     * 记录错误级日志
     */
    public error(message: string, error?: any): void {
        this.addLog("ERROR", message, error);
        console.error(`[CheekyChimp:ERROR] ${message}`, error ? error : "");
    }

    /**
     * 记录注入事件
     */
    public logInjection(target: string, url: string, success: boolean, details?: any): void {
        const message = `脚本注入${success ? "成功" : "失败"}: ${target}, URL: ${url}`;
        this.addLog(success ? "INFO" : "ERROR", message, details);
        
        // 记录到专门的注入日志
        this.addInjectionLog({
            timestamp: new Date().toISOString(),
            target,
            url,
            success,
            details
        });
        
        if (success) {
            console.info(`[CheekyChimp:INJECT] ${message}`);
        } else {
            console.error(`[CheekyChimp:INJECT] ${message}`, details ? details : "");
        }
    }

    /**
     * 添加注入日志
     */
    private addInjectionLog(log: InjectionLog): void {
        // 保持日志条目数量在限制以内
        if (this.injectionLogs.length >= this.maxInjectionLogs) {
            this.injectionLogs.shift(); // 移除最早的日志
        }
        this.injectionLogs.push(log);
    }

    /**
     * 获取所有注入日志
     */
    public getInjectionLogs(): InjectionLog[] {
        return [...this.injectionLogs];
    }

    /**
     * 清空日志
     */
    public clearLogs(): void {
        this.logs = [];
        this.injectionLogs = [];
        this.info("日志已清空");
    }

    /**
     * 获取所有日志
     */
    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    /**
     * 导出日志为文本
     */
    public exportLogsAsText(): string {
        let output = "===== CheekyChimp 调试日志 =====\n";
        output += `时间: ${new Date().toISOString()}\n`;
        output += `浏览器信息: ${navigator.userAgent}\n`;
        output += "==============================\n\n";

        // 添加注入摘要
        output += "==== 注入摘要 ====\n";
        const successfulInjections = this.injectionLogs.filter(log => log.success).length;
        const failedInjections = this.injectionLogs.filter(log => !log.success).length;
        output += `总注入尝试: ${this.injectionLogs.length}\n`;
        output += `成功注入: ${successfulInjections}\n`;
        output += `失败注入: ${failedInjections}\n\n`;

        // 添加最近的失败注入
        const recentFailures = this.injectionLogs
            .filter(log => !log.success)
            .slice(-5);  // 最近5个失败
            
        if (recentFailures.length > 0) {
            output += "==== 最近失败的注入 ====\n";
            recentFailures.forEach(failure => {
                output += `[${failure.timestamp}] 目标: ${failure.target}, URL: ${failure.url}\n`;
                if (failure.details) {
                    try {
                        const detailsStr = typeof failure.details === 'string' 
                            ? failure.details 
                            : JSON.stringify(failure.details, this.replacer, 2);
                        output += `  详情: ${detailsStr}\n`;
                    } catch (e) {
                        output += `  详情: [无法序列化的对象]\n`;
                    }
                }
                output += "\n";
            });
            output += "\n";
        }

        // 添加常规日志
        output += "==== 详细日志 ====\n";
        this.logs.forEach(entry => {
            output += `[${entry.timestamp}] [${entry.level}] ${entry.message}\n`;
            if (entry.context) {
                try {
                    const contextStr = typeof entry.context === 'string' 
                        ? entry.context 
                        : JSON.stringify(entry.context, this.replacer, 2);
                    output += `  详情: ${contextStr}\n`;
                } catch (e) {
                    output += `  详情: [无法序列化的对象]\n`;
                }
            }
            output += "\n";
        });

        return output;
    }

    /**
     * 导出日志为JSON
     */
    public exportLogsAsJSON(): string {
        return JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                injectionSummary: {
                    total: this.injectionLogs.length,
                    successful: this.injectionLogs.filter(log => log.success).length,
                    failed: this.injectionLogs.filter(log => !log.success).length
                },
                recentFailures: this.injectionLogs
                    .filter(log => !log.success)
                    .slice(-5),  // 最近5个失败
                logs: this.logs,
                injectionLogs: this.injectionLogs
            }, 
            this.replacer, 
            2
        );
    }

    /**
     * 下载日志为文本文件
     */
    public downloadLogs(format: 'text' | 'json' = 'text'): void {
        const content = format === 'text' ? this.exportLogsAsText() : this.exportLogsAsJSON();
        const fileName = `cheekychimp-logs-${new Date().toISOString().replace(/:/g, '-')}.${format === 'text' ? 'txt' : 'json'}`;
        
        const blob = new Blob([content], { type: format === 'text' ? 'text/plain' : 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        URL.revokeObjectURL(url);
        this.info(`日志已下载为: ${fileName}`);
    }

    /**
     * 添加日志条目
     */
    private addLog(level: LogLevel, message: string, context?: any): void {
        // 保持日志条目数量在限制以内
        if (this.logs.length >= this.maxLogEntries) {
            this.logs.shift(); // 移除最早的日志
        }

        this.logs.push({
            timestamp: new Date().toISOString(),
            level,
            message,
            context: context || null
        });
    }

    /**
     * JSON序列化时的替换函数，处理循环引用和特殊对象
     */
    private replacer(key: string, value: any): any {
        if (value instanceof HTMLElement) {
            return `HTMLElement: ${value.tagName}${value.id ? '#'+value.id : ''}${value.className ? '.'+value.className.replace(/ /g, '.') : ''}`;
        }
        
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack
            };
        }
        
        if (typeof value === 'function') {
            return '[Function]';
        }
        
        if (value instanceof Set || value instanceof Map) {
            return Array.from(value);
        }
        
        return value;
    }
}

/**
 * 日志级别
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * 日志条目接口
 */
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context: any;
}

/**
 * 注入日志接口
 */
export interface InjectionLog {
    timestamp: string;
    target: string;  // iframe, webview 等
    url: string;
    success: boolean;
    details?: any;
}

/**
 * 获取日志服务单例的快捷方法
 */
export const logger = LogService.getInstance(); 