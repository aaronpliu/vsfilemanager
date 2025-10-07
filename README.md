# VS File Manager

![VS File Manager Logo](media/icon-128.png)

Advanced JSON and YAML structure editor with file synchronization capabilities for Visual Studio Code.

Easily edit complex JSON and YAML files using a hierarchical block editor, synchronize changes across multiple files, and perform batch updates efficiently.

## Features

- **Block Editor**: Edit JSON and YAML files in a hierarchical block view using dot notation (e.g., `config.db.host`)
- **File Synchronization**: Automatically detect and synchronize changes across multiple files with same name in your project
- **Batch Updates**: Apply the same changes to multiple JSON/YAML files simultaneously
- **Multi-format Support**: Works seamlessly with both JSON and YAML file formats
- **Smart Detection**: Automatic detection of same-named files with configurable sync prompts

## JSON/YAML Block Editor

The Block Editor provides a user-friendly interface for editing JSON and YAML files with a hierarchical view:

Key features of the Block Editor:
- View file contents organized by depth levels
- Edit values in place with type preservation
- Add new blocks at any depth level
- Delete unwanted blocks
- Search functionality to find specific keys
- Save or reload the document as needed

## Installation

### From VS Code Marketplace
1. Search for "VS File Manager" in the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
2. Click Install

### From VSIX (Manual Installation)
1. Download the `.vsix` file from the [latest release](https://github.com/aaronpliu/vsfilemanager/releases)
2. In VS Code, open the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Click the "..." menu in the top right
4. Select "Install from VSIX..."
5. Choose the downloaded `.vsix` file

## Commands

- `Edit JSON/YAML Blocks`: Open the block editor with a custom webview UI for JSON or YAML files
- `Sync Files`: Manually trigger file synchronization for JSON or YAML files
- `Batch Update JSON/YAML Files`: Apply the same changes to multiple selected JSON or YAML files

## Usage

### Editing JSON/YAML Blocks

1. Open a JSON or YAML file
2. Use the Command Palette (Ctrl+Shift+P or Cmd+Shift+P) to run "Edit JSON/YAML Blocks"
3. Modify values in the webview editor
4. Click "Save Changes" to apply modifications
5. Optionally, apply changes to other files using the batch update feature

## Extension Settings

This extension contributes the following settings:

* `vsfilemanager.enable`: Enable/disable this extension
* `vsfilemanager.syncPrompt`: Enable/disable automatic sync prompts

## Release Notes

### 0.0.5

Fixed critical extension activation issue:
- Fixed extension activation events to properly register commands
- Resolved "command 'vsfilemanager.editJsonBlocks' not found" error

### 0.0.4

Refactored extension architecture:
- Improved code organization with modular structure
- Moved business logic to dedicated handler modules
- Enhanced maintainability and extensibility
- Fixed HTML rendering issues

### 0.0.3

Enhanced functionality and fixed critical issues:
- Recursive workspace file search for synchronization
- Improved nested value editing and saving
- Fixed string quote accumulation issue
- Fixed string editing and nested value saving issues
- Improved type preservation when changing value types

### 0.0.2

Added YAML file support:
- Edit YAML files with the same hierarchical block editor
- Full type preservation for YAML values (strings, numbers, booleans, objects, arrays)
- Seamless integration with existing JSON functionality

### 0.0.1

Initial release of VS File Manager with:
- JSON block editing capabilities
- File synchronization features
- Batch update functionality