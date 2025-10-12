const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { FileTypeUtils } = require('./utils/fileTypeUtils');

/**
 * Batch Updater
 * Applies the same block modifications across multiple files simultaneously
 */
class BatchUpdater {
    /**
     * Apply block changes to multiple files
     * @param {Object} blocks - Block changes to apply
     * @param {Array<string>} filePaths - Array of file paths to update
     */
    static async applyBatchUpdate(blocks, filePaths) {
        if (!filePaths || filePaths.length === 0) {
            vscode.window.showWarningMessage('No files selected for batch update');
            return;
        }

        if (!blocks || Object.keys(blocks).length === 0) {
            vscode.window.showWarningMessage('No block changes to apply');
            return;
        }

        const results = {
            successful: [],
            failed: []
        };

        // Process each file
        for (const filePath of filePaths) {
            try {
                const fileExtension = path.extname(filePath).toLowerCase();
                
                // Validate file type
                if (!FileTypeUtils.isSupportedFileType(fileExtension)) {
                    throw new Error(`Unsupported file type: ${fileExtension}`);
                }
                
                // Get the appropriate parser
                const Parser = FileTypeUtils.getParser(fileExtension);
                if (!Parser) {
                    throw new Error(`Parser not found for file type: ${fileExtension}`);
                }
                
                // Read the file
                let fileContent = fs.readFileSync(filePath, 'utf8');
                
                // Handle empty files
                if (!fileContent || fileContent.trim() === '') {
                    fileContent = FileTypeUtils.getEmptyContent(fileExtension);
                }
                
                let updatedContent;
                if (fileExtension === '.json') {
                    // For JSON files, we need to parse, apply changes, and stringify
                    // Extract original number formats before parsing
                    const originalNumberFormats = Parser.extractOriginalNumberFormats(fileContent);
                    const jsonContent = JSON.parse(fileContent);
                    // Use applyBlockChangesEnhanced for consistency with other parsers
                    const updatedJson = Parser.applyBlockChangesEnhanced(jsonContent, blocks, originalNumberFormats);
                    updatedContent = this.stringifyJsonPreservingNumberFormat(updatedJson);
                } else if (fileExtension === '.yaml' || fileExtension === '.yml') {
                    // For YAML files, use the enhanced method to properly handle nested object updates
                    updatedContent = Parser.applyBlockChangesEnhanced(fileContent, blocks);
                } else if (fileExtension === '.toml') {
                    // For TOML files, use the enhanced method to properly handle nested object updates
                    updatedContent = Parser.applyBlockChangesEnhanced(fileContent, blocks);
                } else {
                    // For other formats, use the parser's applyOnlyChangedBlocks method directly
                    updatedContent = Parser.applyOnlyChangedBlocks(fileContent, blocks);
                }

                fs.writeFileSync(filePath, updatedContent, 'utf8');
                
                results.successful.push(filePath);
            } catch (error) {
                results.failed.push({
                    file: filePath,
                    error: error.message
                });
            }
        }

        // Show results
        let message = `Batch update completed!\n`;
        message += `Successful: ${results.successful.length}\n`;
        
        if (results.failed.length > 0) {
            message += `Failed: ${results.failed.length}\n`;
            message += results.failed.map(f => `${f.file}: ${f.error}`).join('\n');
            vscode.window.showErrorMessage(message);
        } else {
            vscode.window.showInformationMessage(message + 'All files updated successfully!');
        }

        return results;
    }

    /**
     * Select files for batch update
     * @returns {Promise<Array<string>>} Selected file paths
     */
    static async selectFilesForBatchUpdate() {
        // In a real implementation, this would show a file picker
        // For now, we'll use a simplified approach
        
        const options = {
            canSelectMany: true,
            openLabel: 'Select Files for Batch Update',
            filters: FileTypeUtils.getFileFilter()
        };

        const uris = await vscode.window.showOpenDialog(options);
        if (!uris || uris.length === 0) {
            return [];
        }

        return uris.map(uri => uri.fsPath);
    }

    /**
     * Show batch update dialog
     * @param {Object} blocks - Current blocks
     * @returns {Promise<Object>} Result with updated blocks and selected files
     */
    static async showBatchUpdateDialog(blocks) {
        // Ask user what they want to do
        const action = await vscode.window.showInformationMessage(
            'What would you like to do?',
            'Select Files for Batch Update',
            'Cancel'
        );

        if (action !== 'Select Files for Batch Update') {
            return null;
        }

        // Select files
        const filePaths = await this.selectFilesForBatchUpdate();
        if (!filePaths || filePaths.length === 0) {
            return null;
        }

        return {
            blocks: blocks,
            filePaths: filePaths
        };
    }

    /**
     * Custom JSON stringifier that preserves original number formatting
     * @param {Object} obj - The object to stringify
     * @returns {string} Formatted JSON string with preserved number formatting
     */
    static stringifyJsonPreservingNumberFormat(obj) {
        // First convert to JSON string with our special handling
        const jsonString = JSON.stringify(obj, function(key, value) {
            // Check if this is our special object for preserving .0 format
            if (value && typeof value === 'object' && value.__PRESERVE_DOT_ZERO__ === true) {
                // Create a special marker that we'll replace later
                return "__DOT_ZERO_NUMBER_MARKER__:" + value.value;
            }
            // For all other values, use default behavior
            return value;
        }, 2);
        
        // Then replace our special markers with properly formatted numbers
        return jsonString.replace(/"__DOT_ZERO_NUMBER_MARKER__:(\d+)"/g, '$1.0');
    }
}

module.exports = BatchUpdater;