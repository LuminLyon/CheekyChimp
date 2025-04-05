// API类型导出
export * from './services/api/GMApiTypes';
export { GMApiFactory } from './services/api/GMApiFactory';

// 存储服务导出
export type { 
    StorageService,
    LocalStorageService,
    MemoryStorageService
} from './services/storage/StorageService';

// 资源加载器导出
export { ResourceLoader } from './services/resources/ResourceLoader';

// 注入器导出
export type { BaseInjector as InjectorBase } from './services/injection/interfaces';
export type { BaseInjector as InjectorConfig } from './services/injection/interfaces';
// 暂时注释掉不存在的导入
// export { DirectInjector } from './services/injectors/DirectInjector';
// export { IframeInjector } from './services/injectors/IframeInjector';
// export { WebviewInjector } from './services/injectors/WebviewInjector';

// 主ScriptInjector导出
export { 
    ScriptInjector
} from './services/injection/ScriptInjector';
export type { 
    ScriptInjectionOptions as ScriptInjectorConfig
} from './services/injection/types';

// 导出所有重构后的模块
// 错误处理模块
export * from './services/error/error-handler';
export type { CheekyChimpError, ScriptInjectionError, ScriptParsingError, ResourceLoadError, APICallError, StorageError } from './services/error/error-types';

// 日志模块
export * from './services/logging/logger';
export type { LogLevel } from './services/logging/logger';

// 注入策略模块
export * from './services/injection/index';
// 暂时注释掉不存在的导入
// export type { InjectionStrategy } from './services/injection/injection-strategy';
// export { InjectionStrategyFactory } from './services/injection/injection-strategy';
// export { IframeInjectionStrategy } from './services/injection/injection-strategy';
// export { WebviewInjectionStrategy } from './services/injection/injection-strategy';

// 网站适配器
export * from './services/injection/site-adapters/site-adapter-interface';
export * from './services/injection/site-adapters/generic-adapter';
export * from './services/injection/site-adapters/site-adapter-factory';

// 原有服务（兼容层）
export * from './services/backup-script-injector';

// 重导出所有模块，便于外部使用
export * from './models/script';
export type { GM_API } from './services/api/GMApiTypes';
export * from './services/script-manager';
export * from './services/obsidian-storage';

// 其他服务
// export { BackupScriptInjector } from './services/backup-script-injector';

// 菜单命令管理
export * from './services/injection/menu-command-injector';
export type { MenuCommand } from './services/injection/types';
export * from './services/injection/MenuCommandManager';
export * from './services/injection/script-menu-ui';

// i18n
export * from './services/i18n-service';

// UI组件
export * from './ui/settings-tab';