# Change Log

All notable changes to the "vsfilemanager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [0.0.3] - 2023-04-15

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
- String editing issues where quotes were being added repeatedly on save
- Nested value saving issues where values were reverting to original values
- Type preservation when changing value types (string to number, etc.)