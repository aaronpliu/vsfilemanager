const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const JsonBlockParser = require('./jsonBlockParser');

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
                // Synchronize all files
                const content = fs.readFileSync(filePath, 'utf8');
                this.synchronizeFiles(filePath, content, sameNamedFiles);
                return null; // We handle synchronization here, so return null
            case 'Select Files':
                // Let the caller handle file selection
                return sameNamedFiles; // Return the list of files for selection
            default:
                // Cancel - just update current file
                return false;
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
                // Read the existing content of the target file
                const existingContent = fs.readFileSync(targetFile, 'utf8');
                const existingJson = JSON.parse(existingContent);
                
                // Apply only the changed blocks to the existing content
                const updatedJson = JsonBlockParser.applyBlockChanges(existingJson, changedBlocks);
                
                // Write the updated content back to the file
                fs.writeFileSync(targetFile, JSON.stringify(updatedJson, null, 2), 'utf8');
                syncedFiles.push(targetFile);
            } catch (error) {
                failedFiles.push({ file: targetFile, error: error.message });
            }
        }

        // Report results
        if (syncedFiles.length > 0) {
            vscode.window.showInformationMessage(
                `Successfully synchronized changes to ${syncedFiles.length} file(s):\n${syncedFiles.join('\n')}`
            );
        }

        if (failedFiles.length > 0) {
            vscode.window.showErrorMessage(
                `Failed to synchronize ${failedFiles.length} file(s):\\n${failedFiles.map(f => f.file + ': ' + f.error).join('\\n')}`
            );
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