const vscode = require('vscode');
const BatchUpdater = require('../batchUpdater');

class BatchUpdateHandler {
    static async batchUpdate() {
        // Select files for batch update
        const filePaths = await BatchUpdater.selectFilesForBatchUpdate();
        if (!filePaths || filePaths.length === 0) {
            return;
        }
        
        // Ask for block changes
        const blockKey = await vscode.window.showInputBox({
            prompt: 'Enter block key to update (e.g., config.db.host)'
        });
        
        if (!blockKey) {
            return;
        }
        
        const blockValue = await vscode.window.showInputBox({
            prompt: 'Enter new value for the block'
        });
        
        if (blockValue === undefined) {
            return;
        }
        
        // Determine the type of the value
        let actualValue = blockValue;
        let originalType = 'string';
        
        // Try to parse as JSON to determine type
        try {
            const parsed = JSON.parse(blockValue);
            actualValue = parsed;
            originalType = typeof parsed;
        } catch (e) {
            // If it's not valid JSON, check if it's a number
            if (!isNaN(Number(blockValue)) && blockValue.trim() !== '') {
                actualValue = Number(blockValue);
                originalType = 'number';
            } else if (blockValue === 'true' || blockValue === 'false') {
                actualValue = blockValue === 'true';
                originalType = 'boolean';
            }
        }
        
        // Format value for display (this is important for proper type handling)
        let displayValue = actualValue;
        if (originalType === 'string') {
            displayValue = '"' + actualValue + '"';
        }
        
        // Create blocks object with proper format that matches what the webview sends
        const blocks = {};
        blocks[blockKey] = {
            value: displayValue,
            type: typeof actualValue,
            depth: 0,
            key: blockKey,
            editable: true,
            originalType: originalType
        };
        
        // Apply batch update
        await BatchUpdater.applyBatchUpdate(blocks, filePaths);
    }
}

module.exports = BatchUpdateHandler;