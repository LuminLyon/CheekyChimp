# Obsidian Tampermonkey 插件文档

Obsidian Tampermonkey 是一个用于在 Obsidian 内置浏览器中运行用户脚本的插件，类似于浏览器中的 Tampermonkey 扩展。

## 项目结构

```
obsidian-tampermonkey/
├── src/                 # 源代码目录
│   ├── models/          # 数据模型定义
│   ├── services/        # 业务逻辑服务
│   ├── views/           # 视图组件
│   ├── modals/          # 模态窗口
│   ├── ui/              # UI组件
│   └── main.ts          # 主入口文件
├── examples/            # 示例用户脚本
├── tests/               # 测试代码
├── docs/                # 文档
│   └── reference/       # 参考资料
├── main.js              # 构建输出文件 (插件入口)
├── styles.css           # 插件样式
├── manifest.json        # 插件清单
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript配置
└── esbuild.config.mjs   # 构建配置
```

## 核心模块

### 1. 脚本解析器

`src/services/script-parser.ts` - 负责解析用户脚本的元数据和代码内容

### 2. 脚本注入器

`src/services/script-injector.ts` - 负责将用户脚本注入到Obsidian的webview中

### 3. 脚本管理器

`src/services/script-manager.ts` - 负责管理用户脚本，包括添加、删除、启用/禁用等操作

### 4. GM API实现

`src/services/gm-api.ts` - 实现Tampermonkey的GM_*系列API

### 5. 存储服务

`src/services/storage.ts` - 负责用户脚本和脚本数据的持久化存储

### 6. UI界面

`src/views/` - 包含插件的主界面和设置界面

## 开发指南

### 环境设置

1. 克隆项目
2. 安装依赖: `npm install`
3. 开发: `npm run dev`
4. 构建: `npm run build`
5. 清理: `npm run clean` (删除不需要的dist目录)

### 构建说明

本项目使用 esbuild 进行构建，主要构建配置在 `esbuild.config.mjs` 文件中。构建过程会将所有源代码打包到根目录中的 `main.js` 文件中，这是最终的插件入口文件。

通过设置了TypeScript的`noEmit: true`和esbuild的适当配置，我们确保构建过程只生成根目录中的`main.js`文件，不会产生中间文件。

### 样式说明

插件样式定义在两个地方：
1. `styles.css` - 包含全局样式定义
2. 在 `src/main.ts` 的 `loadStyles()` 方法中，动态注入一些UI交互相关的样式

### 调试方法

在Obsidian中开发插件时，可以通过以下方式进行调试:

1. 在Obsidian中启用开发者控制台 (`Ctrl+Shift+I`)
2. 使用`console.log`输出调试信息
3. 通过检查DOM元素分析webview结构

## 常见问题

### 跨域问题

由于Obsidian的webview限制，某些跨域请求可能无法正常工作，需要特殊处理。

### 脚本兼容性

并非所有Tampermonkey脚本都能在Obsidian中正常运行，一些依赖特定浏览器API的脚本可能需要修改。 