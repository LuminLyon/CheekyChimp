# CheekyChimp

![CheekyChimp](https://img.shields.io/badge/CheekyChimp-v0.1.0-green) ![Obsidian](https://img.shields.io/badge/Obsidian-v0.15.0+-blue) ![License](https://img.shields.io/badge/License-GPL--3.0-orange)

[English Documentation](docs/README_EN.md)

## 简介

CheekyChimp 是一个为 Obsidian 内置浏览器设计的用户脚本管理器插件，类似于浏览器中的 Tampermonkey 扩展。它允许您在 Obsidian 的内置浏览器中注入和运行自定义脚本，从而增强您的浏览体验。

## 演示

以下是插件的功能演示视频：

![演示视频](examples/demo.gif)

## 功能特点

- 在 Obsidian 内置浏览器中运行用户脚本
- 支持脚本的添加、删除、启用/禁用等管理操作
- 实现了类似 Tampermonkey 的 GM_* API 系列函数
- 提供脚本数据的持久化存储
- 支持中文脚本名称和内容
- 友好的用户界面，便于脚本管理

## 安装方法

### 手动安装

1. 下载最新版本的发布包
2. 解压到您的 Obsidian 插件目录：`<vault>/.obsidian/plugins/`
3. 重新启动 Obsidian
4. 在设置中启用 CheekyChimp 插件

## 使用方法

1. 安装并启用插件后，在 Obsidian 的左侧边栏中会出现 CheekyChimp 图标
2. 点击图标打开 CheekyChimp 管理面板
3. 点击「添加脚本」按钮导入新脚本
4. 在 Obsidian 内置浏览器中访问相关网页时，符合条件的脚本会自动运行

## 示例脚本

插件自带了几个示例脚本，您可以在 `examples` 目录中找到：

1. **夜间模式助手** - 实现任意网站的夜间模式，支持网站白名单
2. **Bilibili 视频速度控制** - 为 Bilibili 视频添加速度控制功能

## 常见问题

### 跨域问题

由于 Obsidian 的 webview 限制，某些跨域请求可能无法正常工作，需要特殊处理。

### 脚本兼容性

并非所有用户脚本都能在 Obsidian 中正常运行，一些依赖特定浏览器 API 的脚本可能需要修改。

## 贡献指南

欢迎提交 Pull Request 或创建 Issue 来帮助改进这个项目！

## 许可证

本项目采用 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 许可证。

---

**CheekyChimp** - 让您的 Obsidian 浏览体验更加丰富多彩！