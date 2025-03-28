# CheekyChimp

![CheekyChimp](https://img.shields.io/badge/CheekyChimp-v0.1.0-green) ![Obsidian](https://img.shields.io/badge/Obsidian-v0.15.0+-blue) ![License](https://img.shields.io/badge/License-GPL--3.0-orange)

[中文文档](../README.md)

## Introduction

CheekyChimp is a user script manager plugin designed for Obsidian's built-in browser, similar to the Tampermonkey extension in web browsers. It allows you to inject and run custom scripts in Obsidian's built-in browser, enhancing your browsing experience.

## Demo

Here's a demonstration video of the plugin:

![Demo Video](../examples/demo.gif)

## Features

- Run user scripts in Obsidian's built-in browser
- Manage scripts with add, delete, enable/disable operations
- Implements GM_* API series functions similar to Tampermonkey
- Provides persistent storage for script data
- Supports Chinese script names and content
- User-friendly interface for script management

## Installation

### Manual Installation

1. Download the latest release package
2. Extract to your Obsidian plugins directory: `<vault>/.obsidian/plugins/`
3. Restart Obsidian
4. Enable the CheekyChimp plugin in settings

## Usage

1. After installation and enabling the plugin, you'll see the CheekyChimp icon in Obsidian's left sidebar
2. Click the icon to open the CheekyChimp management panel
3. Click the "Add Script" button to import new scripts
4. When visiting relevant web pages in Obsidian's built-in browser, eligible scripts will run automatically

## Example Scripts

The plugin comes with several example scripts that you can find in the `examples` directory:

1. **Night Mode Assistant** - Implements night mode for any website with whitelist support
2. **Bilibili Video Speed Control** - Adds speed control functionality to Bilibili videos

## Common Issues

### Cross-Origin Issues

Due to Obsidian's webview limitations, some cross-origin requests may not work properly and require special handling.

### Script Compatibility

Not all user scripts can run normally in Obsidian, as some scripts that depend on specific browser APIs may need modifications.

## Contributing

Pull requests and issues are welcome to help improve this project!

## License

This project is licensed under the [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) License.

---

**CheekyChimp** - Make your Obsidian browsing experience more colorful! 