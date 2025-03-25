import { UserScript } from '../models/script';
import { ScriptParser } from './script-parser';

export interface ScriptManagerEvents {
    onScriptAdded: (script: UserScript) => void;
    onScriptRemoved: (scriptId: string) => void;
    onScriptUpdated: (script: UserScript) => void;
    onScriptEnabled: (scriptId: string) => void;
    onScriptDisabled: (scriptId: string) => void;
}

/**
 * Script manager service for managing user scripts
 */
export class ScriptManager {
    private scripts: Map<string, UserScript> = new Map();
    private eventListeners: Partial<ScriptManagerEvents> = {};

    constructor() {}

    /**
     * Add event listener
     */
    on<K extends keyof ScriptManagerEvents>(
        event: K, 
        callback: ScriptManagerEvents[K]
    ): void {
        this.eventListeners[event] = callback;
    }

    /**
     * Get all scripts
     */
    getAllScripts(): UserScript[] {
        return Array.from(this.scripts.values())
            .sort((a, b) => a.position - b.position);
    }

    /**
     * Get script by ID
     */
    getScript(id: string): UserScript | undefined {
        return this.scripts.get(id);
    }

    /**
     * Add a new script
     */
    addScript(source: string): UserScript {
        try {
            const script = ScriptParser.parseScript(source);
            
            // Check if script with same ID exists
            if (this.scripts.has(script.id)) {
                throw new Error(`Script with name '${script.name}' already exists`);
            }
            
            // Set position to last
            script.position = this.scripts.size;
            
            // Add script
            this.scripts.set(script.id, script);
            
            // Trigger event
            if (this.eventListeners.onScriptAdded) {
                this.eventListeners.onScriptAdded(script);
            }
            
            return script;
        } catch (error) {
            throw new Error(`Failed to add script: ${error.message}`);
        }
    }

    /**
     * Update an existing script
     */
    updateScript(id: string, source: string): UserScript {
        if (!this.scripts.has(id)) {
            throw new Error(`Script with ID '${id}' not found`);
        }
        
        try {
            // 保存旧脚本信息
            const oldScript = this.scripts.get(id);
            
            // 解析新的脚本内容
            const parsedScript = ScriptParser.parseScript(source);
            
            // 保留原始ID，避免ID被改变
            parsedScript.id = id;
            
            // 保留位置和启用状态
            parsedScript.position = oldScript?.position || 0;
            parsedScript.enabled = oldScript?.enabled || true;
            
            // 更新最后更新时间戳
            parsedScript.lastUpdated = Date.now();
            
            // 更新脚本
            this.scripts.set(id, parsedScript);
            
            // 触发事件
            if (this.eventListeners.onScriptUpdated) {
                this.eventListeners.onScriptUpdated(parsedScript);
            }
            
            return parsedScript;
        } catch (error) {
            throw new Error(`Failed to update script: ${error.message}`);
        }
    }

    /**
     * Remove a script
     */
    removeScript(id: string): void {
        if (!this.scripts.has(id)) {
            throw new Error(`Script with ID '${id}' not found`);
        }
        
        // Remove script
        this.scripts.delete(id);
        
        // Re-order positions
        const allScripts = this.getAllScripts();
        allScripts.forEach((script, index) => {
            script.position = index;
        });
        
        // Trigger event
        if (this.eventListeners.onScriptRemoved) {
            this.eventListeners.onScriptRemoved(id);
        }
    }

    /**
     * Enable a script
     */
    enableScript(id: string): void {
        const script = this.scripts.get(id);
        if (!script) {
            throw new Error(`Script with ID '${id}' not found`);
        }
        
        script.enabled = true;
        
        // Trigger event
        if (this.eventListeners.onScriptEnabled) {
            this.eventListeners.onScriptEnabled(id);
        }
    }

    /**
     * Disable a script
     */
    disableScript(id: string): void {
        const script = this.scripts.get(id);
        if (!script) {
            throw new Error(`Script with ID '${id}' not found`);
        }
        
        script.enabled = false;
        
        // Trigger event
        if (this.eventListeners.onScriptDisabled) {
            this.eventListeners.onScriptDisabled(id);
        }
    }

    /**
     * Find scripts that should run on a given URL
     */
    findScriptsForUrl(url: string): UserScript[] {
        const matchingScripts: UserScript[] = [];
        
        for (const script of this.getAllScripts()) {
            // Skip disabled scripts
            if (!script.enabled) continue;
            
            // Check if URL matches any include pattern
            const shouldInclude = script.includes.length === 0 || 
                script.includes.some(pattern => this.matchUrlPattern(url, pattern));
            
            // Check if URL matches any exclude pattern
            const shouldExclude = script.excludes.some(pattern => 
                this.matchUrlPattern(url, pattern));
            
            // Check if URL matches any match pattern
            const matchesPattern = script.matches.length === 0 || 
                script.matches.some(pattern => this.matchUrlPattern(url, pattern));
            
            // Include script if it should be included and not excluded
            if (shouldInclude && !shouldExclude && matchesPattern) {
                matchingScripts.push(script);
            }
        }
        
        return matchingScripts.sort((a, b) => a.position - b.position);
    }

    /**
     * Match URL against a Greasemonkey pattern
     */
    private matchUrlPattern(url: string, pattern: string): boolean {
        if (pattern === '*') return true;
        
        try {
            // Convert Greasemonkey pattern to regex
            let regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
                .replace(/\*/g, '.*'); // Convert * to .*
            
            // Match from beginning to end
            regexPattern = '^' + regexPattern + '$';
            
            const regex = new RegExp(regexPattern);
            return regex.test(url);
        } catch (error) {
            console.error(`Invalid pattern: ${pattern}`, error);
            return false;
        }
    }

    /**
     * Load scripts from storage
     */
    loadScripts(scripts: UserScript[]): void {
        this.scripts.clear();
        scripts.forEach(script => {
            this.scripts.set(script.id, script);
        });
    }

    /**
     * Move script up in the order
     */
    moveScriptUp(id: string): void {
        const script = this.scripts.get(id);
        if (!script) {
            throw new Error(`Script with ID '${id}' not found`);
        }
        
        if (script.position === 0) return; // Already at the top
        
        // Find script at previous position
        const previousScript = this.getAllScripts()
            .find(s => s.position === script.position - 1);
        
        if (previousScript) {
            previousScript.position++;
            script.position--;
            
            // Trigger update events
            if (this.eventListeners.onScriptUpdated) {
                this.eventListeners.onScriptUpdated(script);
                this.eventListeners.onScriptUpdated(previousScript);
            }
        }
    }

    /**
     * Move script down in the order
     */
    moveScriptDown(id: string): void {
        const script = this.scripts.get(id);
        if (!script) {
            throw new Error(`Script with ID '${id}' not found`);
        }
        
        const allScripts = this.getAllScripts();
        if (script.position === allScripts.length - 1) return; // Already at the bottom
        
        // Find script at next position
        const nextScript = allScripts.find(s => s.position === script.position + 1);
        
        if (nextScript) {
            nextScript.position--;
            script.position++;
            
            // Trigger update events
            if (this.eventListeners.onScriptUpdated) {
                this.eventListeners.onScriptUpdated(script);
                this.eventListeners.onScriptUpdated(nextScript);
            }
        }
    }
} 