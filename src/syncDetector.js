const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
            'Sync All',
            'View Files',
            'Cancel'
        );

        switch (choice) {
            case 'Sync All':
                return true;
            case 'View Files':
                // Show files in an information message
                vscode.window.showInformationMessage(
                    `Found files:\n${sameNamedFiles.join('\n')}`,
                    'OK'
                );
                return false;
            default:
                return false;
        }
    }

    /**
     * Apply synchronization to same-named files
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