import { ScriptStorage } from '../models/script';
import { Plugin } from 'obsidian';

/**
 * Implements the ScriptStorage interface using Obsidian's data storage
 */
export class ObsidianStorage implements ScriptStorage {
    private plugin: Plugin;
    private cache: Map<string, any> = new Map();
    
    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }
    
    /**
     * Get a value from storage
     */
    async getValue(name: string, defaultValue?: any): Promise<any> {
        // Check cache first
        if (this.cache.has(name)) {
            return this.cache.get(name);
        }
        
        // Load from plugin data
        const data = await this.plugin.loadData() || {};
        const value = name in data ? data[name] : defaultValue;
        
        // Cache the value
        this.cache.set(name, value);
        
        return value;
    }
    
    /**
     * Set a value in storage
     */
    async setValue(name: string, value: any): Promise<void> {
        // Update cache
        this.cache.set(name, value);
        
        // Load current data
        const data = await this.plugin.loadData() || {};
        
        // Update data
        data[name] = value;
        
        // Save data
        await this.plugin.saveData(data);
    }
    
    /**
     * Delete a value from storage
     */
    async deleteValue(name: string): Promise<void> {
        // Remove from cache
        this.cache.delete(name);
        
        // Load current data
        const data = await this.plugin.loadData() || {};
        
        // Delete property
        if (name in data) {
            delete data[name];
            
            // Save data
            await this.plugin.saveData(data);
        }
    }
    
    /**
     * List all stored values
     */
    async listValues(): Promise<string[]> {
        // Load data
        const data = await this.plugin.loadData() || {};
        
        // Return keys
        return Object.keys(data);
    }
    
    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
    }
} 