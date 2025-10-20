# Change Log

All notable changes to the "vsfilemanager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.3] - 2025-10-20

### Fixed
- Fixed object deletion functionality in webview for JSON files
- Fixed issue where media assets were not included in VSIX package
- Fixed ESLint error with function declaration in block editor handler

### Improved
- Enhanced deletion logic to properly handle nested object structures
- Improved VSIX packaging to include all necessary media assets
- Refined code structure to comply with ESLint rules
- Enhanced quickPick to support cancel

## [1.3.2] - 2025-10-19

### Added
- Added unit tests to improve code coverage
- Added save change notification for deletion operations
- Added timeout configuration for message display
- Added Husky pre-commit hooks with lint-staged for code quality enforcement

### Fixed
- Fixed webview block refresh issues
- Enhanced code commit check with Husky and lint

## [1.3.1] - 2025-10-16

### Added
- Added save changes notification with "Save Changes" button in bottom right corner
- Added keyboard navigation for search results using arrow keys
- Added floating search box with collapse/expand functionality

### Improved
- Enhanced save changes notification styling to prevent text wrapping
- Enhanced dialog and prompt messages for save changes functionality
- Enhanced reload message behavior
- Improved button naming to avoid user confusion
- Refined save button state management to reset properly

### Fixed
- Fixed save issue for current file
- Fixed issue where success message was not displayed in appropriate location
- Fixed issue where reload message was displayed multiple times
- Fixed search result clearing when switching depth levels
- Show new value in webview before save operation

## [1.3.0] - 2025-10-15

### Added
- Enhanced floating search box with collapse/expand functionality
- Added keyboard arrow key navigation for search results
- Implemented immediate keyboard navigation activation on search

### Fixed
- Fixed search navigation skipping results (only navigating to odd numbers)
- Improved keyboard navigation to work immediately after search without requiring button click

### Improved
- Enhanced search UI with better visual feedback and navigation controls
- Refined floating search box behavior and appearance

## [1.2.0] - 2025-10-13

### Added
- Added up arrow button to quick back to top
- Navigate to the first search result automatically
- Enhanced the nested array handling in all four parsers

### Fixed
- Fixed TOML parser error for array
- Fixed file parser error
- Fixed position when batch update for XML file
- Fixed position after batch update
- Fixed the nested value update propagation in batch operations
- Fixed batch update for same-named files when values are reverted to original
- Fixed webview display for arrays and map objects with proper formatting
- Fixed search function to be scoped to current depth level instead of entire file
- Fixed empty object handling
- Fixed clear search result when switch depth
- Enhanced number to update
- Enhanced batch update for changed value

### Improved
- Fine-tuned button style

## [1.1.1] - 2025-10-10

### Added
- Enhanced block editor to use textareas instead of textboxes for array and map objects
- Improved search functionality to only search within the currently selected depth level
- Added visual highlighting for search results with no matches using error color

### Fixed
- Fixed nested value update propagation in batch operations
- Fixed batch update for same-named files when values are reverted to original
- Fixed webview display for arrays and map objects with proper formatting
- Fixed search function to be scoped to current depth level instead of entire file

### Improved
- Optimized object display in webview with better formatting for complex data structures
- Updated search prompt text to accurately reflect navigation method
- Enhanced UI grouping titles for better visual organization
- Set default depth to 1 for improved user experience

## [1.1.0] - 2025-10-08

### Added
- Added visual highlighting for newly added blocks in the editor
- Enhanced user experience with animated highlighting for newly created blocks

### Fixed
- Fixed issue where block keys were incorrectly converted to numbers after saving or reloading
- Resolved data format inconsistency between parser output and webview expectations
- Improved reliability of Apply, Reload, and Reload Document functions

## [1.0.0] - 2025-10-08

### Added
- Added dynamic depth selector that adjusts based on file structure
- Added improved theming for notifications in both light and dark VS Code themes

### Changed
- Refactored depth selector to use dynamic values instead of fixed ranges
- Improved depth selector initialization to properly show depth level 2 by default
- Enhanced notification styling to work better with VS Code's built-in theme variables

### Fixed
- Fixed issue where initial depth level was showing maximum depth instead of default depth level 2
- Fixed notification background colors to properly adapt to both light and dark themes

## [0.0.17] - 2025-10-08

### Fixed
- Fixed "Invalid TOML format: Cannot add value of type InlineTable to array of type Array" error
- Improved error handling in TOML parser with graceful fallbacks for complex object serialization
- Corrected sample TOML file to comply with TOML specification (no mixed-type arrays)
- Enhanced TOML parser to handle edge cases with nested objects and arrays

### Improved
- Added better error handling for tomlify-j0.4 library integration
- Improved robustness of TOML processing pipeline

## [0.0.16] - 2025-10-08

### Added
- Added support for editing XML files with the block editor
- Added support for editing TOML files with the block editor
- Extended synchronization and batch update features to XML and TOML files
- Updated UI to be format-agnostic
- Updated command names to be more generic (Edit Structured Blocks)

### Fixed
- Fixed batch update functionality for XML and TOML files
- Fixed synchronization issues with XML and TOML files
- Fixed sync files command to support XML and TOML files

### Improved
- Refactored codebase to use centralized file type utility for better extensibility
- Improved code maintainability by reducing repetitive conditional logic
- Made it easier to add support for new file types in the future

## [0.0.15] - 2025-10-07

### Fixed
- Resolved issue where arrays in YAML files were being converted to strings when edited and saved
- Improved array handling consistency between JSON and YAML formats
- Fixed "currentLevelBlocks is not defined" error in YAML parser
- Arrays now display in standard JSON format for better readability and editing

## [0.0.14] - 2025-10-07

### Fixed
- Replaced wildcard activation with specific activation events for better performance
- Kept explicit command activation events to ensure commands are available
- Maintained the fix for including dependencies in the package

## [0.0.13] - 2025-10-07

### Fixed
- Removed node_modules from .vscodeignore to ensure dependencies are included in the packaged extension
- Reinstalled all dependencies to ensure they're properly included

## [0.0.12] - 2025-10-07

### Fixed
- Simplified activation events to use wildcard [*] to ensure extension is always activated
- This should resolve the "command not found" error by ensuring commands are always registered

## [0.0.11] - 2025-10-07

### Fixed
- Restored explicit command activation events which were missing
- Ensured all commands have proper activation events for production installation

## [0.0.10] - 2025-10-07

### Fixed
- Added error handling and logging to command registration
- Improved debugging for command registration issues

## [0.0.9] - 2025-10-07

### Fixed
- Added console logging to help diagnose command execution issues
- Improved debugging capabilities for command registration

## [0.0.8] - 2025-10-07

### Fixed
- Replaced wildcard activation with explicit command activation events
- Added explicit `onCommand` activation events for all commands to ensure proper registration

## [0.0.7] - 2025-10-07

### Fixed
- Changed activation event from `onStartupFinished` to `*` to ensure commands are always available
- Resolved persistent "command not found" error when running "Edit JSON/YAML Blocks" command

## [0.0.6] - 2025-10-07

### Fixed
- Simplified activation events to use automatic command registration
- Removed redundant explicit command activation events

## [0.0.5] - 2025-10-07

### Fixed
- Fixed extension activation events to properly register commands
- Resolved "command 'vsfilemanager.editJsonBlocks' not found" error

## [0.0.4] - 2025-10-07

### Changed
- Refactored extension architecture to improve maintainability and extensibility
- Organized codebase into modular structure with dedicated handler and parser folders
- Moved business logic from extension.js to separate handler modules
- Improved HTML rendering in webview to properly display file paths
- Enhanced code organization without changing functionality

### Fixed
- Fixed HTML rendering issues with literal \n characters appearing in editor
- Resolved syntax errors in block editor handler

## [Unreleased]

## [0.0.3] - 2025-10-04

### Added
- Initial release of VS File Manager
- JSON block editing capabilities
- File synchronization features
- Batch update functionality
- YAML file support
- Custom icon and marketplace assets

### Changed
- Enhanced file search to recursively search the entire workspace
- Improved nested value editing and saving
- Fixed string quote accumulation issue

### Fixed
- Issue where initial depth level was showing maximum depth instead of default depth level 1
- String editing issues where quotes were being added repeatedly on save
- Nested value saving issues where values were reverting to original values
- Type preservation when changing value types (string to number, etc.)

## [0.0.2] - 2025-10-04

Added YAML file support:
- Edit YAML files with the same hierarchical block editor
- Full type preservation for YAML values (strings, numbers, booleans, objects, arrays)
- Seamless integration with existing JSON functionality

## [0.0.1] - 2025-10-03

Initial release of VS File Manager with:
- JSON block editing capabilities
- File synchronization features
- Batch update functionality