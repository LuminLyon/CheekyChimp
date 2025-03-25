# Tampermonkey 参考资料

当前项目 `tampermonkey` 目录下包含了 Tampermonkey 浏览器扩展的源代码，用于参考研究。这些代码可以帮助我们理解原始 Tampermonkey 的实现方式，但不应直接复制使用。

## 目录结构

- `src/` - Tampermonkey 源代码
- `server/` - 服务器相关代码
- `misc/` - 杂项文件
- `images/` - 图像资源
- `i18n/` - 国际化文件
- `build_sys/` - 构建系统
- `.github/` - GitHub 相关配置
- `.git/` - Git 仓库

## 如何使用参考代码

在开发 Obsidian Tampermonkey 插件时，可以参考这些代码了解：

1. 用户脚本解析和执行机制
2. GM API 的实现方式
3. 脚本管理和存储

## 注意事项

- 不要直接复制代码，应该理解后重新实现
- 需要考虑 Obsidian 环境下的特殊性
- 参考原始实现，但保持我们自己的架构 