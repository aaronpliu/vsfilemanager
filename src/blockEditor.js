const vscode = require('vscode');

/**
 * Block Editor
 * Provides UI components for editing JSON blocks
 */
class BlockEditor {
    /**
     * Create a block editor panel
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @returns {Promise<Object>} Updated blocks
     */
    static async openBlockEditor(blocks) {
        // In a real implementation, this would create a custom webview panel
        // For now, we'll show a simple input box as a placeholder
        
        const blockKeys = Object.keys(blocks);
        if (blockKeys.length === 0) {
            vscode.window.showInformationMessage('No blocks to edit');
            return blocks;
        }

        // Ask user which block to edit
        const selectedBlock = await vscode.window.showQuickPick(blockKeys, {
            placeHolder: 'Select a block to edit'
        });

        if (!selectedBlock) {
            return blocks;
        }

        // Get current value
        const currentValue = blocks[selectedBlock];

        // Ask for new value
        const newValue = await vscode.window.showInputBox({
            prompt: `Edit value for "${selectedBlock}"`,
            value: String(currentValue)
        });

        if (newValue !== undefined) {
            // Update the block value
            // In a real implementation, we would handle type conversion properly
            blocks[selectedBlock] = newValue;
            vscode.window.showInformationMessage(`Updated "${selectedBlock}" to "${newValue}"`);
        }

        return blocks;
    }

    /**
     * Create a new block
     * @param {Object} blocks - Current blocks
     * @returns {Promise<Object>} Blocks with the new one added
     */
    static async createBlock(blocks) {
        const blockPath = await vscode.window.showInputBox({
            prompt: 'Enter the block path (e.g., config.db.host)'
        });

        if (!blockPath) {
            return blocks;
        }

        const blockValue = await vscode.window.showInputBox({
            prompt: 'Enter the block value'
        });

        if (blockValue !== undefined) {
            blocks[blockPath] = blockValue;
            vscode.window.showInformationMessage(`Created new block "${blockPath}"`);
        }

        return blocks;
    }

    /**
     * Delete a block
     * @param {Object} blocks - Current blocks
     * @returns {Promise<Object>} Blocks with the selected one removed
     */
    static async deleteBlock(blocks) {
        const blockKeys = Object.keys(blocks);
        if (blockKeys.length === 0) {
            vscode.window.showInformationMessage('No blocks to delete');
            return blocks;
        }

        const selectedBlock = await vscode.window.showQuickPick(blockKeys, {
            placeHolder: 'Select a block to delete'
        });

        if (selectedBlock) {
            delete blocks[selectedBlock];
            vscode.window.showInformationMessage(`Deleted block "${selectedBlock}"`);
        }

        return blocks;
    }
}

module.exports = BlockEditor;