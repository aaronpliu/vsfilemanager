const vscode = require('vscode');
const path = require('path');
const SyncDetector = require('../syncDetector');
const { FileTypeUtils } = require('../utils/fileTypeUtils');

class SyncFilesHandler {
    static async syncFiles() {
        // Get the active text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }

        const document = editor.document;
        const filePath = document.fileName;
        const validation = FileTypeUtils.validateFile(filePath);
        
        if (!validation.isValid) {
            vscode.window.showErrorMessage(`Active file is not a supported structured file! Supported types: ${FileTypeUtils.getSupportedExtensions().join(', ')}`);
            return;
        }

        // Find same-named files
        const sameNamedFiles = SyncDetector.findSameNamedFiles(filePath);

        if (sameNamedFiles.length === 0) {
            vscode.window.showInformationMessage('No same-named files found for synchronization.');
            return;
        }

        // Create quick pick items for file selection
        const quickPickItems = sameNamedFiles.map(file => ({
            label: path.basename(file),
            description: file,
            picked: true // Selected by default
        }));
        
        // Show quick pick dialog for file selection
        const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: 'Select files to synchronize (press SPACE to toggle selection)',
            title: 'Select Files to Synchronize',
            ignoreFocusOut: true
        });
        
        if (selectedItems && selectedItems.length > 0) {
            // Extract file paths from selected items
            const filePaths = selectedItems.map(item => item.description);
            
            // Get current document content and parse to blocks
            const content = document.getText();
            let blocks;
            
            // Get the appropriate parser
            const Parser = FileTypeUtils.getParser(validation.fileExtension);
            if (!Parser) {
                vscode.window.showErrorMessage(`Parser not found for file type: ${validation.fileExtension}`);
                return;
            }
            
            if (validation.fileExtension === '.json') {
                const jsonContent = JSON.parse(content);
                // For the sync command, we send all current blocks since we don't have
                // a reference to original blocks like in the save flow
                const depthBlocks = Parser.parseToDepthBlocks(jsonContent);
                // Convert to flat blocks for synchronization
                blocks = {};
                depthBlocks.forEach(depthGroup => {
                    for (const key in depthGroup.blocks) {
                        if (depthGroup.blocks.hasOwnProperty(key)) {
                            blocks[key] = depthGroup.blocks[key];
                        }
                    }
                });
            } else {
                blocks = Parser.parseToBlocks(content);
            }
            
            // Synchronize only the current blocks, not the entire file content
            // NOTE: This is different from the save flow where we only send changed blocks
            // because we don't have access to original state in this command
            SyncDetector.synchronizeBlockChanges(filePath, blocks, filePaths);
        }
    }
}

module.exports = SyncFilesHandler;