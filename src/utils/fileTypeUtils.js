const path = require('path');

/**
 * File Type Utilities
 * Centralized handling of file type operations for better extensibility
 */

// Supported file types and their parsers
const SUPPORTED_FILE_TYPES = {
    '.json': {
        name: 'JSON',
        parser: '../parser/jsonBlockParser',
        emptyContent: '{}'
    },
    '.yaml': {
        name: 'YAML',
        parser: '../parser/yamlBlockParser',
        emptyContent: '{}'
    },
    '.yml': {
        name: 'YAML',
        parser: '../parser/yamlBlockParser',
        emptyContent: '{}'
    },
    '.xml': {
        name: 'XML',
        parser: '../parser/xmlBlockParser',
        emptyContent: '<root></root>'
    },
    '.toml': {
        name: 'TOML',
        parser: '../parser/tomlBlockParser',
        emptyContent: '{}'
    }
};

class FileTypeUtils {
    /**
     * Check if a file extension is supported
     * @param {string} fileExtension - File extension to check
     * @returns {boolean} Whether the file type is supported
     */
    static isSupportedFileType(fileExtension) {
        return SUPPORTED_FILE_TYPES.hasOwnProperty(fileExtension.toLowerCase());
    }

    /**
     * Get the parser for a specific file type
     * @param {string} fileExtension - File extension
     * @returns {Object|null} Parser module or null if not supported
     */
    static getParser(fileExtension) {
        const fileType = SUPPORTED_FILE_TYPES[fileExtension.toLowerCase()];
        if (!fileType) {
            return null;
        }
        
        try {
            return require(fileType.parser);
        } catch (error) {
            console.error(`Failed to load parser for ${fileExtension}:`, error);
            return null;
        }
    }

    /**
     * Get the display name for a file type
     * @param {string} fileExtension - File extension
     * @returns {string} Display name
     */
    static getFileTypeName(fileExtension) {
        const fileType = SUPPORTED_FILE_TYPES[fileExtension.toLowerCase()];
        return fileType ? fileType.name : 'Unknown';
    }

    /**
     * Get the appropriate empty content for a file type
     * @param {string} fileExtension - File extension
     * @returns {string} Empty content
     */
    static getEmptyContent(fileExtension) {
        const fileType = SUPPORTED_FILE_TYPES[fileExtension.toLowerCase()];
        return fileType ? fileType.emptyContent : '';
    }

    /**
     * Get all supported file extensions
     * @returns {Array<string>} Array of supported file extensions
     */
    static getSupportedExtensions() {
        return Object.keys(SUPPORTED_FILE_TYPES);
    }

    /**
     * Get file filter for dialog boxes
     * @returns {Object} File filter object
     */
    static getFileFilter() {
        return {
            'Structured Files': this.getSupportedExtensions().map(ext => ext.substring(1)) // Remove the dot
        };
    }

    /**
     * Validate file extension and show appropriate error message
     * @param {string} filePath - Path to the file
     * @returns {Object} Result with isValid flag and fileExtension
     */
    static validateFile(filePath) {
        const fileExtension = path.extname(filePath).toLowerCase();
        const isValid = this.isSupportedFileType(fileExtension);
        
        return {
            isValid,
            fileExtension,
            typeName: this.getFileTypeName(fileExtension)
        };
    }
}

module.exports = {
    FileTypeUtils,
    SUPPORTED_FILE_TYPES
};