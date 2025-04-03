// ==UserScript==
// @name         CheekyChimp示例脚本
// @namespace    https://github.com/your-username/cheekychimp
// @version      1.0.0
// @description  CheekyChimp库的示例脚本
// @author       Your Name
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_notification
// @resource     exampleCSS https://example.com/style.css
// ==/UserScript==

(function() {
    'use strict';
    
    // 从用户脚本元数据中提取GM_info信息
    const scriptInfo = {
        script: {
            name: 'CheekyChimp示例脚本',
            namespace: 'https://github.com/your-username/cheekychimp',
            description: 'CheekyChimp库的示例脚本',
            version: '1.0.0',
            includes: ['*://*/*'],
            excludes: [],
            matches: ['*://*/*'],
            resources: [
                { name: 'exampleCSS', url: 'https://example.com/style.css' }
            ],
            requires: []
        },
        version: '1.0.0',
        scriptHandler: 'CheekyChimp',
        scriptMetaStr: ''
    };
    
    // 加载CheekyChimp库
    // 注意：在实际使用中，您应该从CDN或本地导入
    import { ScriptInjector } from '../dist/index.js';
    
    // 用户脚本的实际代码
    const userScriptCode = `
        // 添加样式
        GM_addStyle('body { background-color: #f0f0f0; }');
        
        // 创建界面元素
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.padding = '10px';
        container.style.backgroundColor = '#fff';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '5px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        
        // 添加标题
        const title = document.createElement('h3');
        title.textContent = 'CheekyChimp示例';
        container.appendChild(title);
        
        // 添加计数器功能
        let counter = GM_getValue('counter', 0);
        
        const counterDisplay = document.createElement('div');
        counterDisplay.textContent = '点击次数: ' + counter;
        container.appendChild(counterDisplay);
        
        const button = document.createElement('button');
        button.textContent = '增加计数';
        button.style.marginTop = '10px';
        button.addEventListener('click', () => {
            counter++;
            GM_setValue('counter', counter);
            counterDisplay.textContent = '点击次数: ' + counter;
            
            // 使用通知
            GM_notification({
                text: '计数已增加到 ' + counter,
                title: 'CheekyChimp示例',
                timeout: 2000
            });
        });
        container.appendChild(button);
        
        // 添加菜单命令
        GM_registerMenuCommand('重置计数', () => {
            counter = 0;
            GM_setValue('counter', 0);
            counterDisplay.textContent = '点击次数: 0';
            alert('计数已重置!');
        });
        
        // 添加XHR示例按钮
        const xhrButton = document.createElement('button');
        xhrButton.textContent = '获取JSON数据';
        xhrButton.style.marginTop = '5px';
        xhrButton.addEventListener('click', () => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://jsonplaceholder.typicode.com/todos/1',
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        alert('获取的数据: ' + JSON.stringify(data));
                    } catch (e) {
                        console.error('解析JSON失败', e);
                    }
                },
                onerror: function(error) {
                    console.error('请求失败', error);
                }
            });
        });
        container.appendChild(xhrButton);
        
        console.log('CheekyChimp示例脚本已加载!');
    `;
    
    // 初始化注入器
    const injector = new ScriptInjector({
        scriptInfo,
        sourceCode: userScriptCode,
        injectFrames: true,
        injectWebviews: true,
        logPrefix: '[CheekyChimp示例]'
    });
    
    // 开始注入
    injector.inject();
    
    // 页面卸载时清理资源
    window.addEventListener('unload', () => {
        injector.dispose();
    });
})();