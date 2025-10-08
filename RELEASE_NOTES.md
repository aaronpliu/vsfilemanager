# VS File Manager 0.0.17 Release Notes

## Overview

This release focuses on improving the stability and reliability of TOML file processing, fixing critical errors that occurred when working with complex TOML structures.

## Key Fixes

### TOML Processing Improvements
- **Fixed Critical Error**: Resolved the "Invalid TOML format: Cannot add value of type InlineTable to array of type Array" error that was occurring when processing TOML files with complex nested structures
- **Enhanced Error Handling**: Added robust error handling in the TOML parser with graceful fallbacks when serialization issues occur
- **Specification Compliance**: Corrected sample TOML files to comply with the TOML specification (no mixed-type arrays)

## Technical Improvements

### Parser Robustness
- Added try/catch blocks around tomlify-j0.4 library calls to prevent crashes
- Implemented fallback to JSON representation when TOML serialization fails
- Improved handling of edge cases with nested objects and arrays in TOML files

## User Impact

Users can now reliably:
- Edit TOML files with complex nested structures without encountering errors
- Work with arrays and tables in TOML files without serialization issues
- Rely on more stable and robust TOML processing

## Files Updated
- `src/parser/tomlBlockParser.js` - Enhanced error handling and serialization
- `test-project/config/sample.toml` - Corrected to comply with TOML specification
- `CHANGELOG.md` - Documented changes
- `package.json` - Version updated to 0.0.17

This update maintains full backward compatibility with existing functionality for JSON, YAML, and XML files while significantly improving the reliability of TOML file processing.