# 测试目录

这个目录用于存放Obsidian Tampermonkey插件的测试代码和测试用例。

## 测试范围

- 用户脚本解析器测试
- GM API 功能测试
- 脚本注入和执行测试
- UI组件测试
- 存储功能测试

## 建议的测试方案

### 单元测试

可以使用Jest或其他测试框架对关键功能进行单元测试，例如：

```typescript
// script-parser.test.ts
import { ScriptParser } from '../src/services/script-parser';

describe('ScriptParser', () => {
  test('parse script metadata correctly', () => {
    const parser = new ScriptParser();
    const source = `
      // ==UserScript==
      // @name        测试脚本
      // @namespace   https://example.com
      // @version     1.0
      // @description 这是一个测试脚本
      // @match       *://*.example.com/*
      // @grant       GM_setValue
      // ==/UserScript==
      
      console.log('Hello, world!');
    `;
    
    const script = parser.parse(source);
    
    expect(script.name).toBe('测试脚本');
    expect(script.namespace).toBe('https://example.com');
    expect(script.version).toBe('1.0');
    expect(script.description).toBe('这是一个测试脚本');
    expect(script.matches).toContain('*://*.example.com/*');
    // 更多断言...
  });
});
```

### 集成测试

使用Puppeteer或类似工具对整个插件进行集成测试：

```typescript
// integration.test.ts
describe('Tampermonkey Plugin Integration', () => {
  test('script is injected and executed in webview', async () => {
    // 模拟Obsidian环境
    // 创建webview
    // 注入测试脚本
    // 验证脚本是否正确执行
  });
});
```

## 测试运行方式

待定 - 需要根据项目实际情况选择合适的测试框架和运行方式。 