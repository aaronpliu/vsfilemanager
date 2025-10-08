const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { FileTypeUtils } = require('./utils/fileTypeUtils');

/**
 * Sync Detector
 * Detects same-named files in parent or sibling directories for synchronization
 */
class SyncDetector {
    /**
     * Find same-named files in parent or sibling directories
     * @param {string} filePath - Path of the current file
     * @returns {Array} Array of file paths that match the name
     */
    static findSameNamedFiles(filePath) {
        const fileName = path.basename(filePath);
        const dirPath = path.dirname(filePath);
        const sameNamedFiles = [];

        // Get the workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // Fallback to original behavior if no workspace is open
            return this.findSameNamedFilesLegacy(filePath);
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Search recursively from workspace root
        this.searchFilesRecursively(workspaceRoot, fileName, sameNamedFiles, filePath);

        return sameNamedFiles;
    }

    /**
     * Legacy method to find same-named files (original behavior)
     * @param {string} filePath - Path of the current file
     * @returns {Array} Array of file paths that match the name
     */
    static findSameNamedFilesLegacy(filePath) {
        const fileName = path.basename(filePath);
        const dirPath = path.dirname(filePath);
        const sameNamedFiles = [];

        // Check parent directory
        const parentDir = path.dirname(dirPath);
        if (fs.existsSync(parentDir)) {
            const parentFiles = fs.readdirSync(parentDir);
            for (const file of parentFiles) {
                const fullPath = path.join(parentDir, file);
                if (file === fileName && fs.statSync(fullPath).isFile()) {
                    sameNamedFiles.push(fullPath);
                }
            }
        }

        // Check sibling directories
        const siblingDirs = fs.readdirSync(parentDir).filter(item => {
            const fullPath = path.join(parentDir, item);
            return fs.statSync(fullPath).isDirectory() && item !== path.basename(dirPath);
        });

        for (const dir of siblingDirs) {
            const fullPath = path.join(parentDir, dir);
            const dirFiles = fs.readdirSync(fullPath);
            for (const file of dirFiles) {
                if (file === fileName) {
                    sameNamedFiles.push(path.join(fullPath, file));
                }
            }
        }

        return sameNamedFiles;
    }

    /**
     * Search for files recursively in all subdirectories
     * @param {string} dir - Directory to search in
     * @param {string} fileName - Name of the file to find
     * @param {Array} results - Array to store results
     * @param {string} excludePath - Path to exclude from results
     */
    static searchFilesRecursively(dir, fileName, results, excludePath) {
        try {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                
                // Skip node_modules and other common directories that we don't want to search
                if (item === 'node_modules' || item === '.git' || item.startsWith('.')) {
                    continue;
                }
                
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Recursively search in subdirectories
                    this.searchFilesRecursively(fullPath, fileName, results, excludePath);
                } else if (stat.isFile() && item === fileName && fullPath !== excludePath) {
                    // Found a matching file (but not the original file)
                    results.push(fullPath);
                }
            }
        } catch (error) {
            // Silently ignore errors to prevent one bad directory from stopping the entire search
            console.warn(`Could not search directory ${dir}: ${error.message}`);
        }
    }

    /**
     * Prompt user to synchronize changes
     * @param {string} filePath - Path of the current file
     * @param {Array} sameNamedFiles - Array of same-named file paths
     * @returns {Promise<boolean>} Whether user wants to synchronize
     */
    static async promptForSync(filePath, sameNamedFiles) {
        if (sameNamedFiles.length === 0) {
            return false;
        }

        const fileName = path.basename(filePath);
        const message = `Found ${sameNamedFiles.length} other file(s) named "${fileName}". Would you like to synchronize your changes?`;
        
        const choice = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            'Select Files',
            'Sync All',
            'Cancel'
        );

        switch (choice) {
            case 'Sync All':
                // Return all files for synchronization
                return { action: 'syncAll', files: sameNamedFiles };
            case 'Select Files':
                // Let the caller handle file selection
                return { action: 'selectFiles', files: sameNamedFiles };
            default:
                // Cancel - just update current file
                return { action: 'cancel' };
        }
    }

    /**
     * Apply synchronization to same-named files with selective block updates
     * @param {string} sourceFilePath - Path of the source file
     * @param {Object} changedBlocks - The blocks that have been changed
     * @param {Array} targetFiles - Array of file paths to synchronize
     */
    static synchronizeBlockChanges(sourceFilePath, changedBlocks, targetFiles) {
        const syncedFiles = [];
        const failedFiles = [];

        for (const targetFile of targetFiles) {
            try {
                const fileExtension = path.extname(targetFile).toLowerCase();
                
                // Validate file type
                if (!FileTypeUtils.isSupportedFileType(fileExtension)) {
                    failedFiles.push({ 
                        file: targetFile, 
                        error: `Unsupported file type: ${fileExtension}` 
                    });
                    continue;
                }
                
                // Get the appropriate parser
                const Parser = FileTypeUtils.getParser(fileExtension);
                if (!Parser) {
                    failedFiles.push({ 
                        file: targetFile, 
                        error: `Parser not found for file type: ${fileExtension}` 
                    });
                    continue;
                }
                
                // Read the existing content of the target file
                let existingContent = fs.readFileSync(targetFile, 'utf8');
                
                // Handle empty files
                if (!existingContent || existingContent.trim() === '') {
                    existingContent = FileTypeUtils.getEmptyContent(fileExtension);
                }
                
                let updatedContent;
                if (fileExtension === '.json') {
                    // For JSON files, we need to parse, apply changes, and stringify
                    const jsonContent = JSON.parse(existingContent);
                    const updatedJson = Parser.applyOnlyChangedBlocks(jsonContent, changedBlocks);
                    updatedContent = JSON.stringify(updatedJson, null, 2);
                } else {
                    // For other formats, use the parser's applyOnlyChangedBlocks method directly
                    updatedContent = Parser.applyOnlyChangedBlocks(existingContent, changedBlocks);
                }
                
                // Write the updated content back to the file
                fs.writeFileSync(targetFile, updatedContent, 'utf8');
                syncedFiles.push(targetFile);
            } catch (error) {
                failedFiles.push({ file: targetFile, error: error.message });
            }
        }

        // Report results
        if (syncedFiles.length > 0) {
            vscode.window.showInformationMessage(
                `Successfully synchronized changes to ${syncedFiles.length} file(s)`
            );
        }

        if (failedFiles.length > 0) {
            vscode.window.showErrorMessage(
                `Failed to synchronize ${failedFiles.length} file(s):\n${failedFiles.map(f => f.file + ': ' + f.error).join('\n')}`
            );
        }
        
        return { syncedFiles, failedFiles };
    }

    /**
     * Validate that target file has compatible structure for block changes
     * @param {Object} content - The content of the target file
     * @param {Object} changedBlocks - The blocks that have been changed
     * @param {string} fileExtension - File extension
     * @returns {boolean} Whether the target file is compatible
     */
    static validateBlockCompatibility(content, changedBlocks, fileExtension) {
        try {
            // Get the appropriate parser
            const Parser = FileTypeUtils.getParser(fileExtension);
            if (!Parser) {
                return false;
            }
            
            let existingBlocks;
            if (fileExtension === '.json') {
                // For JSON files, parse the content first
                const jsonContent = JSON.parse(content);
                existingBlocks = Parser.parseToBlocks(jsonContent);
            } else {
                // For other formats, parse directly
                existingBlocks = Parser.parseToBlocks(content);
            }
            
            // Check if all changed blocks can be applied to the existing structure
            for (const key in changedBlocks) {
                if (changedBlocks.hasOwnProperty(key)) {
                    // We can apply any block changes since we're using dot notation paths
                    // If a path doesn't exist, it will be created
                    // If it does exist, it will be updated
                    // So this is always compatible
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate JSON structure
     * @param {Object} jsonContent - The JSON content to validate
     * @returns {boolean} Whether the JSON structure is valid
     */
    static validateJsonStructure(jsonContent) {
        try {
            // Try to stringify and parse to check for circular references and other issues
            JSON.stringify(jsonContent);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Apply synchronization to same-named files (full content replacement)
     * @param {string} sourceFilePath - Path of the source file
     * @param {string} content - Content to write to other files
     * @param {Array} targetFiles - Array of file paths to synchronize
     */
    static synchronizeFiles(sourceFilePath, content, targetFiles) {
        const syncedFiles = [];
        const failedFiles = [];

        for (const targetFile of targetFiles) {
            try {
                fs.writeFileSync(targetFile, content, 'utf8');
                syncedFiles.push(targetFile);
            } catch (error) {
                failedFiles.push({ file: targetFile, error: error.message });
            }
        }

        // Report results
        if (syncedFiles.length > 0) {
            vscode.window.showInformationMessage(
                `Successfully synchronized ${syncedFiles.length} file(s):\n${syncedFiles.join('\n')}`
            );
        }

        if (failedFiles.length > 0) {
            vscode.window.showErrorMessage(
                `Failed to synchronize ${failedFiles.length} file(s):\n${failedFiles.map(f => f.file + ': ' + f.error).join('\n')}`
            );
        }
    }
}

module.exports = SyncDetector;