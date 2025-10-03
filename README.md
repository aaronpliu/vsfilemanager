# VS File Manager

Advanced JSON structure editor with file synchronization capabilities for Visual Studio Code.

## Features

- Edit JSON files in hierarchical blocks using dot notation (e.g., `config.db.host`)
- Synchronize changes across multiple files with same name in parent/sibling directories
- Batch update functionality to apply changes to multiple JSON files simultaneously
- Smart detection of same-named files with automatic sync prompts

## Commands

- `Edit JSON Blocks`: Open the JSON block editor with a custom webview UI
- `Sync Files`: Manually trigger file synchronization
- `Batch Update JSON Files`: Apply the same changes to multiple selected JSON files

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open the folder in VS Code
4. Press F5 to launch the extension in a new Extension Development Host window

## Usage

### Editing JSON Blocks

1. Open a JSON file
2. Use the Command Palette (Ctrl+Shift+P or Cmd+Shift+P) to run "Edit JSON Blocks"
3. Modify values in the webview editor
4. Click "Save Changes" to apply modifications
5. Optionally, apply changes to other files using the batch update feature

### File Synchronization

1. When you save a JSON file, the extension automatically checks for same-named files in parent or sibling directories
2. If found, you'll be prompted to synchronize your changes
3. Choose "Sync All" to apply the same changes to all detected files

### Batch Updates

1. Use the Command Palette to run "Batch Update JSON Files"
2. Select multiple JSON files you want to update
3. Enter the block key and new value you want to apply
4. The extension will update all selected files with the new value

## Extension Settings

This extension contributes the following settings:

* `vsfilemanager.enable`: Enable/disable this extension
* `vsfilemanager.syncPrompt`: Enable/disable automatic sync prompts

## Release Notes

### 0.0.1

Initial release of VS File Manager with:
- JSON block editing capabilities
- File synchronization features
- Batch update functionality