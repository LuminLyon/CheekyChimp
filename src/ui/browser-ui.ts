import { UserScript } from '../models/script';
import TampermonkeyPlugin from '../main';
import { Notice } from 'obsidian';

/**
 * 浏览器内的油猴UI组件
 * 负责在Obsidian内置浏览器中显示油猴图标和脚本管理界面
 */
export class BrowserUI {
    private plugin: TampermonkeyPlugin;
    private activeWebviews: Map<HTMLElement, {
        iconEl: HTMLElement,
        menuEl: HTMLElement | null,
        url: string,
        scripts: UserScript[]
    }> = new Map();

    constructor(plugin: TampermonkeyPlugin) {
        this.plugin = plugin;
    }

    /**
     * 为指定的webview添加UI组件
     */
    public addUIToWebview(webview: HTMLElement, url: string, scripts: UserScript[]): void {
        // 避免重复添加
        if (this.activeWebviews.has(webview)) {
            this.updateUI(webview, url, scripts);
            return;
        }

        try {
            // 创建放置UI元素的容器
            const container = document.createElement('div');
            container.className = 'tampermonkey-browser-ui';
            container.style.cssText = `
                position: absolute;
                top: 5px;
                left: 10px;
                z-index: 9;
                display: flex;
                align-items: center;
                padding: 5px;
            `;

            // 创建图标
            const iconEl = document.createElement('div');
            iconEl.className = 'tampermonkey-icon';
            iconEl.innerHTML = this.getTampermonkeyIconSVG(scripts.length);
            iconEl.title = `Tampermonkey (${scripts.length} 个脚本运行中)`;
            iconEl.style.cssText = `
                cursor: pointer;
                width: 25px;
                height: 25px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                background-color: var(--background-secondary);
                margin-left: 5px;
            `;

            // 将图标添加到容器
            container.appendChild(iconEl);

            // 查找webview的父容器，确保UI可以正确定位
            let parentContainer = webview.parentElement;
            while (parentContainer && !parentContainer.classList.contains('workspace-leaf-content')) {
                parentContainer = parentContainer.parentElement;
            }

            if (parentContainer) {
                // 确保父容器有相对定位，这样UI元素可以正确定位
                if (getComputedStyle(parentContainer).position === 'static') {
                    parentContainer.style.position = 'relative';
                }
                parentContainer.appendChild(container);

                // 跟踪添加的UI元素
                this.activeWebviews.set(webview, {
                    iconEl,
                    menuEl: null,
                    url,
                    scripts
                });

                // 添加点击事件打开菜单
                iconEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleMenu(webview);
                });

                // 点击文档其他地方时关闭菜单
                document.addEventListener('click', () => {
                    this.closeAllMenus();
                });

                console.log(`Tampermonkey: 为 ${url} 添加了浏览器UI，共 ${scripts.length} 个脚本`);
            }
        } catch (error) {
            console.error('Tampermonkey: 添加浏览器UI失败:', error);
        }
    }

    /**
     * 更新UI组件状态
     */
    public updateUI(webview: HTMLElement, url: string, scripts: UserScript[]): void {
        const info = this.activeWebviews.get(webview);
        if (!info) return;

        info.url = url;
        info.scripts = scripts;

        // 更新图标
        info.iconEl.innerHTML = this.getTampermonkeyIconSVG(scripts.length);
        info.iconEl.title = `Tampermonkey (${scripts.length} 个脚本运行中)`;

        // 如果菜单打开，更新菜单内容
        if (info.menuEl) {
            this.renderMenu(webview);
        }
    }

    /**
     * 移除webview的UI组件
     */
    public removeUIFromWebview(webview: HTMLElement): void {
        const info = this.activeWebviews.get(webview);
        if (!info) return;

        try {
            // 移除菜单
            if (info.menuEl && info.menuEl.parentElement) {
                info.menuEl.parentElement.removeChild(info.menuEl);
            }

            // 移除图标
            if (info.iconEl.parentElement) {
                info.iconEl.parentElement.remove();
            }

            // 从跟踪集合中移除
            this.activeWebviews.delete(webview);
            console.log('Tampermonkey: 已移除浏览器UI');
        } catch (error) {
            console.error('Tampermonkey: 移除浏览器UI失败:', error);
        }
    }

    /**
     * 切换菜单显示状态
     */
    private toggleMenu(webview: HTMLElement): void {
        const info = this.activeWebviews.get(webview);
        if (!info) return;

        // 如果菜单已存在，关闭它
        if (info.menuEl) {
            this.closeMenu(webview);
            return;
        }

        // 创建菜单
        this.renderMenu(webview);
    }

    /**
     * 渲染脚本菜单
     */
    private renderMenu(webview: HTMLElement): void {
        const info = this.activeWebviews.get(webview);
        if (!info) return;

        // 如果已有菜单，先移除
        if (info.menuEl && info.menuEl.parentElement) {
            info.menuEl.parentElement.removeChild(info.menuEl);
            info.menuEl = null;
        }

        // 创建新菜单
        const menuEl = document.createElement('div');
        menuEl.className = 'tampermonkey-menu';
        menuEl.style.cssText = `
            position: absolute;
            top: 35px;
            left: 10px;
            background-color: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 10;
            min-width: 220px;
            max-width: 300px;
            overflow: hidden;
        `;

        // 菜单标题
        const titleEl = document.createElement('div');
        titleEl.className = 'tampermonkey-menu-title';
        titleEl.textContent = `Tampermonkey (${info.scripts.length})`;
        titleEl.style.cssText = `
            padding: 8px 12px;
            font-weight: bold;
            border-bottom: 1px solid var(--background-modifier-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        // 添加设置按钮
        const settingsButton = document.createElement('button');
        settingsButton.className = 'tampermonkey-settings-button';
        settingsButton.innerHTML = `<svg viewBox="0 0 100 100" width="15" height="15"><path fill="currentColor" d="M87.26,45.9H75.49a29.46,29.46,0,0,0-4.74-11.87l8.35-8.35a3.47,3.47,0,0,0,0-4.92l-7.1-7.1a3.47,3.47,0,0,0-4.92,0l-8.35,8.35A29.46,29.46,0,0,0,45.9,16.51V4.74a3.5,3.5,0,0,0-3.48-3.48H31.9a3.5,3.5,0,0,0-3.48,3.48V16.51a29.46,29.46,0,0,0-11.87,4.74L8.2,12.9a3.47,3.47,0,0,0-4.92,0l-7.1,7.1a3.47,3.47,0,0,0,0,4.92l8.35,8.35a29.46,29.46,0,0,0-4.74,11.87H4.74A3.5,3.5,0,0,0,1.26,49.1v10.8a3.5,3.5,0,0,0,3.48,3.48H16.51a29.46,29.46,0,0,0,4.74,11.87L12.9,83.6a3.47,3.47,0,0,0,0,4.92l7.1,7.1a3.47,3.47,0,0,0,4.92,0l8.35-8.35a29.46,29.46,0,0,0,11.87,4.74V96.78a3.5,3.5,0,0,0,3.48,3.48h10.8a3.5,3.5,0,0,0,3.48-3.48V85.01a29.46,29.46,0,0,0,11.87-4.74l8.35,8.35a3.47,3.47,0,0,0,4.92,0l7.1-7.1a3.47,3.47,0,0,0,0-4.92l-8.35-8.35a29.46,29.46,0,0,0,4.74-11.87H87.26a3.5,3.5,0,0,0,3.48-3.48V49.1A3.5,3.5,0,0,0,87.26,45.9ZM50,67.93A17.94,17.94,0,1,1,67.93,50,18,18,0,0,1,50,67.93Z"/></svg>`;
        settingsButton.title = '打开Tampermonkey设置';
        settingsButton.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            color: var(--text-muted);
            padding: 0;
            margin: 0;
        `;
        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openSettings();
            this.closeAllMenus();
        });
        titleEl.appendChild(settingsButton);

        menuEl.appendChild(titleEl);

        // 菜单内容
        const contentEl = document.createElement('div');
        contentEl.className = 'tampermonkey-menu-content';

        // URL信息
        const urlEl = document.createElement('div');
        urlEl.className = 'tampermonkey-menu-url';
        urlEl.textContent = `当前URL: ${info.url}`;
        urlEl.style.cssText = `
            padding: 8px 12px;
            font-size: 0.8em;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-bottom: 1px solid var(--background-modifier-border);
        `;
        contentEl.appendChild(urlEl);

        // 脚本列表
        const scriptsEl = document.createElement('div');
        scriptsEl.className = 'tampermonkey-menu-scripts';
        scriptsEl.style.cssText = `
            max-height: 250px;
            overflow-y: auto;
        `;

        if (info.scripts.length === 0) {
            const noScriptsEl = document.createElement('div');
            noScriptsEl.className = 'tampermonkey-menu-no-scripts';
            noScriptsEl.textContent = '当前页面没有活动脚本';
            noScriptsEl.style.cssText = `
                padding: 10px 12px;
                color: var(--text-muted);
                text-align: center;
            `;
            scriptsEl.appendChild(noScriptsEl);
        } else {
            // 添加所有脚本
            info.scripts.forEach(script => {
                const scriptEl = document.createElement('div');
                scriptEl.className = 'tampermonkey-menu-script';
                scriptEl.style.cssText = `
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    border-bottom: 1px solid var(--background-modifier-border-subtle);
                    cursor: pointer;
                `;

                // 添加鼠标悬停效果
                scriptEl.addEventListener('mouseenter', () => {
                    scriptEl.style.backgroundColor = 'var(--background-secondary)';
                });
                scriptEl.addEventListener('mouseleave', () => {
                    scriptEl.style.backgroundColor = '';
                });

                // 切换脚本启用状态
                const toggleEl = document.createElement('div');
                toggleEl.className = 'tampermonkey-menu-script-toggle';
                toggleEl.style.cssText = `
                    width: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = script.enabled;
                checkbox.style.cssText = `
                    margin: 0;
                `;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleScript(script.id, checkbox.checked);
                });
                toggleEl.appendChild(checkbox);

                // 脚本信息
                const infoEl = document.createElement('div');
                infoEl.className = 'tampermonkey-menu-script-info';
                infoEl.style.cssText = `
                    flex: 1;
                    margin-left: 8px;
                    overflow: hidden;
                `;

                const nameEl = document.createElement('div');
                nameEl.className = 'tampermonkey-menu-script-name';
                nameEl.textContent = script.name;
                nameEl.style.cssText = `
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
                infoEl.appendChild(nameEl);

                if (script.version) {
                    const versionEl = document.createElement('div');
                    versionEl.className = 'tampermonkey-menu-script-version';
                    versionEl.textContent = `v${script.version}`;
                    versionEl.style.cssText = `
                        font-size: 0.75em;
                        color: var(--text-muted);
                    `;
                    infoEl.appendChild(versionEl);
                }

                // 添加到脚本元素
                scriptEl.appendChild(toggleEl);
                scriptEl.appendChild(infoEl);

                // 添加编辑按钮
                const editEl = document.createElement('div');
                editEl.className = 'tampermonkey-menu-script-edit';
                editEl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
                editEl.title = '编辑脚本';
                editEl.style.cssText = `
                    width: 25px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                `;
                editEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editScript(script.id);
                    this.closeAllMenus();
                });
                scriptEl.appendChild(editEl);

                scriptsEl.appendChild(scriptEl);
            });
        }

        contentEl.appendChild(scriptsEl);

        // 添加脚本操作按钮
        const actionsEl = document.createElement('div');
        actionsEl.className = 'tampermonkey-menu-actions';
        actionsEl.style.cssText = `
            padding: 8px 12px;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid var(--background-modifier-border);
        `;

        // 创建新脚本按钮
        const newScriptBtn = document.createElement('button');
        newScriptBtn.className = 'tampermonkey-menu-new-script';
        newScriptBtn.textContent = '创建新脚本';
        newScriptBtn.style.cssText = `
            background-color: var(--interactive-accent);
            color: var(--text-on-accent);
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 0.85em;
        `;
        newScriptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createScript(info.url);
            this.closeAllMenus();
        });
        actionsEl.appendChild(newScriptBtn);

        // 刷新脚本按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'tampermonkey-menu-refresh';
        refreshBtn.textContent = '刷新页面';
        refreshBtn.style.cssText = `
            background: none;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 0.85em;
        `;
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.refreshPage(webview);
            this.closeAllMenus();
        });
        actionsEl.appendChild(refreshBtn);

        contentEl.appendChild(actionsEl);
        menuEl.appendChild(contentEl);

        // 将菜单添加到DOM
        info.iconEl.parentElement?.appendChild(menuEl);
        info.menuEl = menuEl;

        // 阻止点击菜单时关闭菜单
        menuEl.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * 关闭指定webview的菜单
     */
    private closeMenu(webview: HTMLElement): void {
        const info = this.activeWebviews.get(webview);
        if (!info || !info.menuEl) return;

        info.menuEl.remove();
        info.menuEl = null;
    }

    /**
     * 关闭所有菜单
     */
    private closeAllMenus(): void {
        for (const webview of this.activeWebviews.keys()) {
            this.closeMenu(webview);
        }
    }

    /**
     * 获取油猴图标SVG
     */
    private getTampermonkeyIconSVG(scriptCount: number): string {
        // 基本图标
        let svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="18" height="18">
                <path fill="currentColor" d="M50,2.5C23.8,2.5,2.5,23.8,2.5,50c0,26.2,21.3,47.5,47.5,47.5c26.2,0,47.5-21.3,47.5-47.5C97.5,23.8,76.2,2.5,50,2.5z M82.5,53.5c0,1.9-1.6,3.5-3.5,3.5h-25v25c0,1.9-1.6,3.5-3.5,3.5h-0.9c-1.9,0-3.5-1.6-3.5-3.5v-25h-25c-1.9,0-3.5-1.6-3.5-3.5v-0.9c0-1.9,1.6-3.5,3.5-3.5h25v-25c0-1.9,1.6-3.5,3.5-3.5h0.9c1.9,0,3.5,1.6,3.5,3.5v25h25c1.9,0,3.5,1.6,3.5,3.5V53.5z"/>
            </svg>
        `;

        // 如果有脚本，添加数量指示
        if (scriptCount > 0) {
            svg += `
                <div style="
                    position: absolute;
                    top: -3px;
                    right: -3px;
                    background-color: var(--interactive-accent);
                    color: white;
                    border-radius: 50%;
                    font-size: 8px;
                    min-width: 10px;
                    height: 10px;
                    line-height: 10px;
                    text-align: center;
                    padding: 0 2px;
                    font-weight: bold;
                ">${scriptCount}</div>
            `;
        }

        return svg;
    }

    /**
     * 切换脚本的启用状态
     */
    private toggleScript(scriptId: string, enabled: boolean): void {
        try {
            if (enabled) {
                this.plugin.scriptManager.enableScript(scriptId);
            } else {
                this.plugin.scriptManager.disableScript(scriptId);
            }
            
            // 保存设置
            this.plugin.saveSettings();
            
            // 显示通知
            const script = this.plugin.scriptManager.getScript(scriptId);
            if (script) {
                new Notice(`脚本 "${script.name}" 已${enabled ? '启用' : '禁用'}`);
            }
        } catch (error) {
            console.error('Tampermonkey: 切换脚本状态失败:', error);
            new Notice('切换脚本状态失败，请查看控制台');
        }
    }

    /**
     * 打开设置面板
     */
    private openSettings(): void {
        // 使用插件公开的打开设置方法
        this.plugin.openSettings();
    }

    /**
     * 编辑指定脚本
     */
    private editScript(scriptId: string): void {
        try {
            // 切换到设置标签
            this.openSettings();
            
            // TODO: 打开编辑窗口，需要与设置标签实现通信
            const script = this.plugin.scriptManager.getScript(scriptId);
            if (script) {
                // 通过事件通知设置标签
                const event = new CustomEvent('tampermonkey-edit-script', {
                    detail: { scriptId }
                });
                document.dispatchEvent(event);
            }
        } catch (error) {
            console.error('Tampermonkey: 打开脚本编辑失败:', error);
            new Notice('无法打开脚本编辑，请查看控制台');
        }
    }

    /**
     * 创建新脚本
     */
    private createScript(url: string): void {
        try {
            this.openSettings();
            
            // 传递当前URL，用于创建针对特定网站的脚本
            const event = new CustomEvent('tampermonkey-create-script', {
                detail: { url }
            });
            document.dispatchEvent(event);
        } catch (error) {
            console.error('Tampermonkey: 创建脚本失败:', error);
            new Notice('无法创建脚本，请查看控制台');
        }
    }

    /**
     * 刷新页面
     */
    private refreshPage(webview: HTMLElement): void {
        try {
            if (webview instanceof HTMLIFrameElement) {
                // 对于iframe，简单地重新加载
                const src = webview.src;
                webview.src = '';
                setTimeout(() => {
                    webview.src = src;
                }, 100);
            } else {
                // 尝试调用reload方法
                try {
                    if ((webview as any).reload) {
                        (webview as any).reload();
                    } else if ((webview as any).contentWindow?.location.reload) {
                        (webview as any).contentWindow.location.reload();
                    } else {
                        throw new Error('没有可用的刷新方法');
                    }
                } catch (e) {
                    // 尝试通过触发事件来刷新
                    const event = new CustomEvent('tampermonkey-reload-page');
                    webview.dispatchEvent(event);
                }
            }
            new Notice('页面刷新中...');
        } catch (error) {
            console.error('Tampermonkey: 刷新页面失败:', error);
            new Notice('刷新页面失败，请查看控制台或手动刷新');
        }
    }
} 