# Change Log

All notable changes to the "vsfilemanager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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