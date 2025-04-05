/**
 * 网站适配器接口
 * 定义所有站点适配器的通用功能
 */
export interface SiteAdapter {
    /**
     * 检查URL是否由该适配器处理
     * @param url 要检查的URL
     * @returns 是否匹配该适配器
     */
    isMatch(url: string): boolean;
    
    /**
     * 设置特定网站的支持
     * @param element iframe或webview元素
     */
    setupSupport(element: HTMLElement): void;
    
    /**
     * 注入样式
     * @param element iframe或webview元素
     */
    injectStyles(element: HTMLElement): void;
    
    /**
     * 增强元素功能
     * @param element iframe或webview元素
     */
    enhanceElement(element: HTMLElement): void;
    
    /**
     * 处理来自网站的消息
     * @param data 消息数据
     * @param element iframe或webview元素
     */
    handleMessage(data: any, element: HTMLElement): void;
} 