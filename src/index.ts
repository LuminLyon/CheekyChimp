// API类型导出
export * from './services/api/GMApiTypes';
export { GMApiFactory } from './services/api/GMApiFactory';

// 存储服务导出
export type { StorageService } from './services/storage/StorageService';
export { LocalStorageService, MemoryStorageService } from './services/storage/StorageService';

// 资源加载器导出
export { ResourceLoader } from './services/resources/ResourceLoader';

// 注入器导出
export type { InjectorConfig } from './services/injectors/InjectorBase';
export { InjectorBase } from './services/injectors/InjectorBase';
export { DirectInjector } from './services/injectors/DirectInjector';
export { IframeInjector } from './services/injectors/IframeInjector';
export { WebviewInjector } from './services/injectors/WebviewInjector';

// 主ScriptInjector导出
export { 
    ScriptInjector,
    type ScriptInjectorConfig
} from './services/ScriptInjector';