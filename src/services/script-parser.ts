import { UserScript } from '../models/script';

/**
 * Parses userscript metadata from script source
 */
export class ScriptParser {
    private static readonly HEADER_START = '==UserScript==';
    private static readonly HEADER_END = '==/UserScript==';

    /**
     * Generate a unique ID from script name
     */
    static getScriptId(name: string): string {
        const timestamp = Date.now().toString(36);
        let nameId = '';
        const encodedName = encodeURI(name);
        const chars = encodedName.match(/[a-zA-Z0-9]/g);
        
        if (chars && chars.length > 0) {
            nameId = chars.join('');
        } else {
            // Fallback to base64 encode and extract alphanumeric chars
            nameId = btoa(name).match(/[a-zA-Z0-9]/g)?.join('') || 'script';
        }
        
        return `${nameId}_${timestamp}`;
    }

    /**
     * Extract metadata from script source
     */
    static parseScript(source: string): UserScript {
        const script = new UserScript();
        
        // 设置脚本源码
        script.source = source;
        
        // 提取元数据块
        const headerStartIndex = source.indexOf(this.HEADER_START);
        const headerEndIndex = source.indexOf(this.HEADER_END);
        
        if (headerStartIndex === -1 || headerEndIndex === -1 || headerEndIndex <= headerStartIndex) {
            throw new Error('Invalid userscript: metadata block not found');
        }
        
        const header = source.substring(
            headerStartIndex + this.HEADER_START.length, 
            headerEndIndex
        );
        
        // 解析元数据
        const lines = header.split('\n');
        let nameFound = false;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // 检查是否是元数据行
            if (!trimmedLine.startsWith('//')) continue;
            
            // 去除注释前缀
            const metaLine = trimmedLine.replace(/^\/\/\s*/, '').trim();
            if (!metaLine.startsWith('@')) continue;
            
            // 尝试匹配元数据指令和值
            const match = metaLine.match(/@([a-zA-Z0-9_\-]+)\s+(.*)/);
            if (!match) continue;
            
            const [, directive, value] = match;
            const trimmedValue = value.trim();
            
            // 处理各种元数据类型
            switch (directive) {
                case 'name':
                    script.name = trimmedValue;
                    nameFound = true;
                    break;
                case 'namespace':
                    script.namespace = trimmedValue;
                    break;
                case 'version':
                    script.version = trimmedValue;
                    break;
                case 'description':
                    script.description = trimmedValue;
                    break;
                case 'author':
                    script.author = trimmedValue;
                    break;
                case 'homepage':
                case 'website':
                case 'source':
                    script.homepage = trimmedValue;
                    break;
                case 'icon':
                case 'iconURL':
                case 'defaulticon':
                    script.icon = trimmedValue;
                    break;
                case 'include':
                    script.includes.push(trimmedValue);
                    break;
                case 'match':
                    script.matches.push(trimmedValue);
                    break;
                case 'exclude':
                    script.excludes.push(trimmedValue);
                    break;
                case 'require':
                    script.requires.push(trimmedValue);
                    break;
                case 'resource':
                    const resourceMatch = trimmedValue.match(/(\S+)\s+(.*)/);
                    if (resourceMatch) {
                        const [, resourceName, resourceUrl] = resourceMatch;
                        script.resources.push({
                            name: resourceName.trim(),
                            url: resourceUrl.trim()
                        });
                    }
                    break;
                case 'run-at':
                    if (['document-start', 'document-end', 'document-idle'].includes(trimmedValue)) {
                        script.runAt = trimmedValue as any;
                    }
                    break;
            }
        }
        
        // 设置默认值
        if (!nameFound || !script.name) {
            script.name = '未命名脚本';
            console.warn('脚本没有名称，使用默认名称');
        }
        
        // 生成唯一ID
        script.id = ScriptParser.getScriptId(script.name);
        
        return script;
    }
} 