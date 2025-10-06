# Change Log

All notable changes to the "vsfilemanager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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