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

### Editing Structured Blocks

1. Open a JSON, YAML, XML, or TOML file
2. Use the Command Palette (Ctrl+Shift+P or Cmd+Shift+P) to run "Edit Structured Blocks"
3. Modify values in the webview editor
4. Click "Save Changes" to apply modifications
5. Optionally, apply changes to other files using the batch update feature

## Extension Settings

This extension contributes the following settings:

* `vsfilemanager.enable`: Enable/disable this extension
* `vsfilemanager.syncPrompt`: Enable/disable automatic sync prompts

## Release Notes

### 1.3.1
Latest improvements and fixes:
- Added save changes notification with "Save Changes" button in bottom right corner
- Enhanced save changes notification styling to prevent text wrapping
- Enhanced dialog and prompt messages for save changes functionality
- Enhanced reload message behavior
- Improved button naming to avoid user confusion
- Refined save button state management to reset properly
- Fixed save issue for current file
- Fixed issue where success message was not displayed in appropriate location
- Fixed issue where reload message was displayed multiple times
- Fixed search result clearing when switching depth levels
- Show new value in webview before save operation
- Added keyboard navigation for search results using arrow keys
- Added floating search box with collapse/expand functionality

### 1.3.0
Latest improvements and fixes:
- Added floating search box with collapse/expand functionality
- Added keyboard arrow key navigation for search results
- Added immediate keyboard navigation activation on search
- Fixed search navigation skipping results (only navigating to odd numbers)
- Improved keyboard navigation to work immediately after search without requiring button click
- Enhanced search UI with better visual feedback and navigation controls
- Refined floating search box behavior and appearance

### 1.2.0

Latest improvements and fixes:
- Added up arrow button for quick navigation back to top
- Navigate to the first search result automatically
- Enhanced nested array handling in all four parsers (JSON, YAML, XML, TOML)
- Fixed various parser errors, especially with TOML arrays
- Fixed file parser errors
- Fixed position issues when batch updating XML files
- Fixed search result clearing when switching depth levels
- Handled empty object cases properly
- Enhanced number value updates
- Improved batch update behavior for changed values
- Fine-tuned button styles in the UI

### 1.1.1

Enhanced editing experience and search functionality:
- Enhanced block editor to use textareas instead of textboxes for array and map objects
- Improved search functionality to only search within the currently selected depth level
- Added visual highlighting for search results with no matches using error color
- Fixed nested value update propagation in batch operations
- Fixed batch update for same-named files when values are reverted to original
- Fixed webview display for arrays and map objects with proper formatting

### 1.1.0

- Added support for editing structured files (JSON, YAML, TOML, XML) with a custom webview UI
- Added support for batch updating same-named files across the workspace
- Added file synchronization detection and prompt
- Added depth-based navigation for complex nested structures
- Added search functionality within the block editor
- Added ability to add and delete blocks
- Fixed issue where initial depth level was showing maximum depth instead of default depth level 1

### 1.0.0

Major improvements and enhancements:
- Added dynamic depth selector that adjusts based on file structure
- Improved theming for notifications in both light and dark VS Code themes
- Fixed issue where initial depth level was showing maximum depth instead of default depth level 2
- Enhanced notification styling to work better with VS Code's built-in theme variables

### 0.0.17

Improved TOML processing stability:
- Fixed "Invalid TOML format: Cannot add value of type InlineTable to array of type Array" error
- Enhanced error handling in TOML parser with graceful fallbacks for complex object serialization
- Corrected sample TOML file to comply with TOML specification (no mixed-type arrays)
- Added better error handling for tomlify-j0.4 library integration

### 0.0.16

Added XML and TOML file support:
- Added support for editing XML files with the block editor
- Added support for editing TOML files with the block editor
- Extended synchronization and batch update features to XML and TOML files
- Updated UI to be format-agnostic
- Updated command names to be more generic (Edit Structured Blocks)
- Refactored codebase for better extensibility and maintainability

### 0.0.15

Fixed array handling issues:
- Resolved issue where arrays in YAML files were being converted to strings when edited and saved
- Improved array handling consistency between JSON and YAML formats
- Fixed "currentLevelBlocks is not defined" error in YAML parser
- Arrays now display in standard JSON format for better readability and editing

### 0.0.14

Fixed extension activation performance:
- Replaced wildcard activation with specific activation events for better performance
- Kept explicit command activation events to ensure commands are available
- Maintained the fix for including dependencies in the package

### 0.0.13

Fixed issues with nested objects and arrays:
- Resolved issue where nested objects and arrays were not being displayed correctly in the block editor
- Improved handling of nested structures for better editing experience
- Fixed "Cannot read property 'length' of undefined" error in nested object handling

### 0.0.12

Improved performance and stability:
- Optimized file search and synchronization logic for faster performance
- Fixed "TypeError: Cannot read property 'length' of undefined" error in file synchronization
- Enhanced error handling for robustness

### 0.0.11

Fixed issues with string values:
- Resolved issue where string values were being incorrectly wrapped in double quotes
- Improved string handling to preserve original formatting
- Fixed "TypeError: Cannot read property 'length' of undefined" error in string handling

### 0.0.10

Enhanced batch update functionality:
- Improved batch update logic for better performance and accuracy
- Fixed "TypeError: Cannot read property 'length' of undefined" error in batch update
- Enhanced user interface for batch update feature

### 0.0.9

Fixed issues with file synchronization:
- Resolved issue where file synchronization was not working as expected
- Improved synchronization logic for better accuracy
- Fixed "TypeError: Cannot read property 'length' of undefined" error in synchronization

### 0.0.8

Improved block editor performance:
- Optimized block editor rendering for faster performance
- Fixed "TypeError: Cannot read property 'length' of undefined" error in block editor
- Enhanced user interface for better usability

### 0.0.7

Fixed issues with file detection:
- Resolved issue where files were not being detected correctly
- Improved file detection logic for better accuracy
- Fixed "TypeError: Cannot read property 'length' of undefined" error in file detection

### 0.0.6

Enhanced file synchronization:
- Improved file synchronization logic for better accuracy
- Fixed "TypeError: Cannot read property 'length' of undefined" error in synchronization
- Enhanced user interface for synchronization feature

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
