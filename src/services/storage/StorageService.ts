/**
 * 存储服务接口
 */
export interface StorageService {
    /**
     * 获取存储值
     * @param name 键名
     * @param defaultValue 默认值
     */
    getValue(name: string, defaultValue?: any): any;

    /**
     * 设置存储值
     * @param name 键名
     * @param value 值
     */
    setValue(name: string, value: any): void;

    /**
     * 删除存储值
     * @param name 键名
     */
    deleteValue(name: string): void;

    /**
     * 列出所有存储键名
     */
    listValues(): string[];
}

/**
 * 本地存储服务实现
 */
export class LocalStorageService implements StorageService {
    private prefix: string;

    constructor(namespace: string) {
        this.prefix = `gm_${namespace}_`;
    }

    public getValue(name: string, defaultValue?: any): any {
        const key = this.getKey(name);
        const value = localStorage.getItem(key);
        
        if (value === null) {
            return defaultValue;
        }
        
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }

    public setValue(name: string, value: any): void {
        const key = this.getKey(name);
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        localStorage.setItem(key, stringValue);
    }

    public deleteValue(name: string): void {
        const key = this.getKey(name);
        localStorage.removeItem(key);
    }

    public listValues(): string[] {
        const keys: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key && key.startsWith(this.prefix)) {
                keys.push(key.substring(this.prefix.length));
            }
        }
        
        return keys;
    }

    private getKey(name: string): string {
        return `${this.prefix}${name}`;
    }
}

/**
 * 内存存储服务实现（用于没有持久化需求的场景）
 */
export class MemoryStorageService implements StorageService {
    private storage: Map<string, any> = new Map();

    public getValue(name: string, defaultValue?: any): any {
        return this.storage.has(name) ? this.storage.get(name) : defaultValue;
    }

    public setValue(name: string, value: any): void {
        this.storage.set(name, value);
    }

    public deleteValue(name: string): void {
        this.storage.delete(name);
    }

    public listValues(): string[] {
        return Array.from(this.storage.keys());
    }
} 