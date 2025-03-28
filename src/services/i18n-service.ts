/**
 * 国际化服务，用于支持多语言
 */
export class I18nService {
    private translations: Record<string, Record<string, string>> = {
        'zh': {
            // 通用
            'plugin_name': 'CheekyChimp',
            'plugin_description': 'Obsidian用户脚本管理器',
            
            // 设置
            'settings': '设置',
            'scripts_manager': '脚本管理器',
            'add_script': '添加脚本',
            'import_script': '导入脚本',
            'create_script': '创建脚本',
            'edit_script': '编辑脚本',
            'delete_script': '删除脚本',
            'enable_script': '启用脚本',
            'disable_script': '禁用脚本',
            'script_settings': '脚本设置',
            'active_scripts': '已启用的脚本',
            'no_active_scripts': '当前没有启用的脚本',
            
            // 通知
            'script_added': '脚本已添加',
            'script_updated': '脚本已更新',
            'script_deleted': '脚本已删除',
            'script_enabled': '脚本已启用',
            'script_disabled': '脚本已禁用',
            'script_error': '脚本错误',
            'script_load_error': '加载脚本失败',
            'script_execute_error': '执行脚本失败',
            
            // 错误
            'error_script_exists': '已存在同名脚本',
            'error_invalid_script': '无效的脚本',
            'error_script_not_found': '未找到脚本',
            'error_cross_origin': '跨域请求失败',
            'error_injection_failed': '注入脚本失败',
            
            // 确认对话框
            'confirm_delete': '确定要删除此脚本吗？此操作不可撤销。',
            'confirm_yes': '是',
            'confirm_no': '否',
            'confirm_cancel': '取消',
            
            // 日志
            'log_injecting': '正在注入脚本',
            'log_injection_success': '脚本注入成功',
            'log_injection_failure': '脚本注入失败'
        },
        'en': {
            // General
            'plugin_name': 'CheekyChimp',
            'plugin_description': 'UserScript Manager for Obsidian',
            
            // Settings
            'settings': 'Settings',
            'scripts_manager': 'Script Manager',
            'add_script': 'Add Script',
            'import_script': 'Import Script',
            'create_script': 'Create Script',
            'edit_script': 'Edit Script',
            'delete_script': 'Delete Script',
            'enable_script': 'Enable Script',
            'disable_script': 'Disable Script',
            'script_settings': 'Script Settings',
            'active_scripts': 'Active Scripts',
            'no_active_scripts': 'No active scripts',
            
            // Notifications
            'script_added': 'Script added',
            'script_updated': 'Script updated',
            'script_deleted': 'Script deleted',
            'script_enabled': 'Script enabled',
            'script_disabled': 'Script disabled',
            'script_error': 'Script error',
            'script_load_error': 'Failed to load script',
            'script_execute_error': 'Failed to execute script',
            
            // Errors
            'error_script_exists': 'Script with the same name already exists',
            'error_invalid_script': 'Invalid script',
            'error_script_not_found': 'Script not found',
            'error_cross_origin': 'Cross-origin request failed',
            'error_injection_failed': 'Script injection failed',
            
            // Confirmation dialogs
            'confirm_delete': 'Are you sure you want to delete this script? This cannot be undone.',
            'confirm_yes': 'Yes',
            'confirm_no': 'No',
            'confirm_cancel': 'Cancel',
            
            // Logs
            'log_injecting': 'Injecting script',
            'log_injection_success': 'Script injection successful',
            'log_injection_failure': 'Script injection failed'
        }
    };
    
    private currentLanguage: string = 'zh';
    
    constructor() {
        // 尝试检测系统语言
        this.detectLanguage();
    }
    
    /**
     * 检测系统语言
     */
    private detectLanguage(): void {
        try {
            const lang = window.navigator.language;
            if (lang.startsWith('zh')) {
                this.currentLanguage = 'zh';
            } else {
                this.currentLanguage = 'en';
            }
            console.log(`CheekyChimp: 检测到系统语言: ${lang}, 使用: ${this.currentLanguage}`);
        } catch (e) {
            console.warn('CheekyChimp: 无法检测系统语言，使用默认语言(zh)');
            this.currentLanguage = 'zh';
        }
    }
    
    /**
     * 设置当前语言
     */
    setLanguage(lang: 'zh' | 'en'): void {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
        } else {
            console.warn(`CheekyChimp: 不支持的语言 ${lang}, 使用默认语言(zh)`);
            this.currentLanguage = 'zh';
        }
    }
    
    /**
     * 获取当前语言
     */
    getLanguage(): string {
        return this.currentLanguage;
    }
    
    /**
     * 获取翻译文本
     */
    t(key: string, params?: Record<string, string>): string {
        const translations = this.translations[this.currentLanguage] || this.translations['zh'];
        let text = translations[key] || key;
        
        // 替换参数
        if (params) {
            Object.keys(params).forEach(paramKey => {
                text = text.replace(`{${paramKey}}`, params[paramKey]);
            });
        }
        
        return text;
    }
}

// 创建单例实例
export const i18n = new I18nService(); 