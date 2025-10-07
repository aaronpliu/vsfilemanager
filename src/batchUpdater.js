const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const JsonBlockParser = require('./parser/jsonBlockParser');
const YamlBlockParser = require('./parser/yamlBlockParser');

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
                // Read the file
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const fileExtension = path.extname(filePath).toLowerCase();
                
                let updatedContent;
                
                if (fileExtension === '.json') {
                    // Parse as JSON
                    const jsonContent = JSON.parse(fileContent);
                    
                    // Apply ONLY the specified block changes using the new method
                    const updatedJson = JsonBlockParser.applyOnlyChangedBlocks(jsonContent, blocks);
                    
                    // Write back to file
                    updatedContent = JSON.stringify(updatedJson, null, 2);
                } else if (fileExtension === '.yaml' || fileExtension === '.yml') {
                    // Apply ONLY the specified block changes using the new method
                    updatedContent = YamlBlockParser.applyOnlyChangedBlocks(fileContent, blocks);
                } else {
                    throw new Error(`Unsupported file type: ${fileExtension}`);
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
            filters: {
                'JSON Files': ['json'],
                'YAML Files': ['yaml', 'yml']
            }
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
}

module.exports = BatchUpdater;