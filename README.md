# VS File Manager

![VS File Manager Logo](media/icons/icon-128.png)

Advanced structured file editor with file synchronization capabilities for Visual Studio Code.

Easily edit complex JSON, YAML, XML, and TOML files using a hierarchical block editor, synchronize changes across multiple files, and perform batch updates efficiently.

## Features

- **Block Editor**: Edit structured files in a hierarchical block view using dot notation (e.g., `config.db.host`)
- **File Synchronization**: Automatically detect and synchronize changes across multiple files with same name in your project
- **Batch Updates**: Apply the same changes to multiple structured files simultaneously
- **Multi-format Support**: Works seamlessly with JSON, YAML, XML, and TOML file formats
- **Smart Detection**: Automatic detection of same-named files with configurable sync prompts
- **Extensible Architecture**: Easily extendable to support additional structured file formats

## Structured Block Editor

The Block Editor provides a user-friendly interface for editing structured files with a hierarchical view:

![JSON Block Editor](media/json-block-editor.png)

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

- `Edit Structured Blocks`: Open the block editor with a custom webview UI for structured files
- `Sync Files`: Manually trigger file synchronization for structured files
- `Batch Update Structured Files`: Apply the same changes to multiple selected structured files

## Usage

### Editing Structured Blocks (Block Editor)

The Block Editor opens a visual webview that renders your file as a hierarchy of editable key-value blocks, organized by depth level.

1. Open a supported file (`.json`, `.yaml`, `.yml`, `.xml`, or `.toml`) in the editor
2. Launch the Block Editor via one of:
   - **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) → type **Edit Structured Blocks**
   - **Right-click context menu** → **Edit Structured Blocks** (available only for supported file types)
3. In the webview you can:
   - **Edit values** in place — type directly in the value field and the original type (string, number, boolean, object, array) is preserved
   - **Add new blocks** at any depth level using the *Add Block* controls
   - **Delete blocks** by clicking the trash icon next to a key (nested objects are fully removed)
   - **Search** for a specific key using the search bar at the top
   - **Change depth level** to collapse or expand the hierarchy view
4. Click **Save Changes** to write modifications back to the file
5. After saving, you will be prompted whether to synchronize the changes to other same-named files in your workspace (see [File Synchronization](#file-synchronization))

> **Tip:** Only one Block Editor can be open per file at a time. Re-running the command on the same file will focus the existing editor.

### File Synchronization

When you have multiple files with the same name across different directories (e.g., `config/app.json` in several modules), the extension can propagate block-level changes to all of them.

#### Automatic sync prompt (after saving in Block Editor)
1. Edit and save changes through the Block Editor
2. If same-named files are detected, a prompt appears asking whether to sync the changes
3. Select the target files from the list and confirm — only the changed blocks are written to the selected files

#### Manual sync command
1. Open the file whose content you want to propagate
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **Sync Structured Files**
3. A multi-select list of same-named files appears — toggle selections with `Space`, then press `Enter`
4. The current file's block values are synchronized to all selected files

> **Note:** Sync operates at the block level, not by replacing entire file contents. Only the blocks you edited are applied to the target files, preserving their existing structure.

To disable automatic sync prompts, set `vsfilemanager.syncPrompt` to `false` in your settings.

### Batch Updates

Batch Update lets you apply the same key-value change to multiple structured files at once — useful for updating a shared configuration value (e.g., a database host or API endpoint) across many files.

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **Batch Update Structured Files**
2. **Select files**: a multi-select list of all supported structured files in your workspace appears — pick the files you want to update and press `Enter`
3. **Enter the block key**: type the dot-notation path of the key to update (e.g., `config.db.host`)
4. **Enter the new value**: type the replacement value — the extension auto-detects the type:
   - Numbers (e.g., `5432`) → stored as number
   - `true` / `false` → stored as boolean
   - Valid JSON (e.g., `{"port": 3000}`) → stored as object/array
   - Anything else → stored as string
5. The change is applied to all selected files simultaneously

> **Example:** To change the database port in every `config/app.json` in your workspace:
> 1. Run **Batch Update Structured Files**
> 2. Select all `app.json` files
> 3. Enter key: `config.db.port`
> 4. Enter value: `5432`

### Supported File Formats

| Format | Extensions | Notes |
|--------|-----------|-------|
| JSON   | `.json`   | Full support for nested objects and arrays |
| YAML   | `.yaml`, `.yml` | Preserves comments and structure |
| XML    | `.xml`    | Uses `fast-xml-parser` for round-trip parsing |
| TOML   | `.toml`   | Supports tables and primitive values |

## Extension Settings

This extension contributes the following settings:

* `vsfilemanager.enable`: Enable/disable this extension
* `vsfilemanager.syncPrompt`: Enable/disable automatic sync prompts

## Release Notes

### 1.3.6

Latest improvements and fixes:
- Fixed nested object deletion functionality in block editor
- Enhanced key handling for array elements in the block editor

### 1.3.5

Latest improvements and fixes:
- Fixed syntax errors with template literals in block editor handler
- Resolved invalid character issues in JavaScript template strings

### 1.3.4

Latest improvements and fixes:
- Fixed issue where multiple block editors could be opened for the same file
- Resolved ESLint configuration to properly support ES6 Map features
- Enhanced single editor per file functionality to prevent data conflicts
- Fixed nested values from being deleted
- Improved error handling and messaging for invalid JSON
- Fixed message auto dismiss for save changes operations
- Fixed webview refresh when depth level is 0
- Added the command in right-click menu

### 1.3.3

Latest improvements and fixes:
- Fixed object deletion functionality in webview for JSON files
- Fixed issue where media assets were not included in VSIX package
- Fixed ESLint error with function declaration in block editor handler
- Enhanced deletion logic to properly handle nested object structures
- Enhanced cancel logic in QuickPick dialog
- Improved VSIX packaging to include all necessary media assets

### 1.3.2

Latest improvements and fixes:
- Added unit tests to improve code coverage
- Fixed webview block refresh issues
- Added save change notification for deletion operations
- Defined timeout configuration for message display
- Enhanced code commit check with Husky and lint

For detailed changelog of all versions, please refer to [CHANGELOG.md](CHANGELOG.md).