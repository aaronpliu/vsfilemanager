/**
 * JSON Block Parser
 * Parses JSON into hierarchical blocks that can be individually edited
 */

class JsonBlockParser {
    /**
     * Parse a JSON object into flat blocks with dot notation paths
     * @param {Object} jsonObject - The JSON object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static parseToBlocks(jsonObject, prefix = '') {
        const blocks = {};

        for (const key in jsonObject) {
            if (jsonObject.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = jsonObject[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Recursively parse nested objects
                    Object.assign(blocks, this.parseToBlocks(value, fullKey));
                } else {
                    // Leaf node - create a block
                    blocks[fullKey] = value;
                }
            }
        }

        return blocks;
    }

    /**
     * Parse a JSON object into hierarchical blocks grouped by depth
     * @param {Object} jsonObject - The JSON object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {number} depth - Current depth level (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static parseToDepthBlocks(jsonObject, prefix = '', depth = 0) {
        const blocks = [];
        const currentLevelBlocks = {};
        let hasChildren = false;

        for (const key in jsonObject) {
            if (jsonObject.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = jsonObject[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // This is a nested object, add it to current level with stringified representation
                    hasChildren = true;
                    // Show a stringified version of the object instead of '[object]'
                    currentLevelBlocks[fullKey] = {
                        value: JSON.stringify(value),
                        type: 'object',
                        depth: depth,
                        key: fullKey,
                        editable: true, // Make it editable so users can modify the JSON directly,
                        originalType: 'object'
                    };
                    
                    // Recursively parse children
                    const childBlocks = this.parseToDepthBlocks(value, fullKey, depth + 1);
                    blocks.push(...childBlocks);
                } else {
                    // Leaf node - create a block
                    // Store original type information to preserve it when converting back
                    const originalType = typeof value;
                    let displayValue = value;
                    
                    // For strings, wrap in quotes for display but keep track of original type
                    if (originalType === 'string') {
                        displayValue = `"${value}"`;
                    }
                    
                    currentLevelBlocks[fullKey] = {
                        value: displayValue,
                        type: typeof value,
                        depth: depth,
                        key: fullKey,
                        editable: true,
                        originalType: originalType
                    };
                }
            }
        }

        // Add current level blocks at the beginning
        blocks.unshift({
            depth: depth,
            blocks: currentLevelBlocks,
            prefix: prefix
        });

        return blocks;
    }

    /**
     * Convert flat blocks back to a nested JSON object
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @returns {Object} Nested JSON object
     */
    static blocksToJson(blocks) {
        const result = {};

        for (const key in blocks) {
            if (blocks.hasOwnProperty(key)) {
                let value = blocks[key];
                
                // Handle different types based on original type information
                if (typeof value === 'object' && value !== null && value.hasOwnProperty('originalType')) {
                    // This is a block object with type information
                    if (value.originalType === 'string') {
                        // Remove quotes from string values
                        if (typeof value.value === 'string' && 
                            value.value.startsWith('"') && 
                            value.value.endsWith('"')) {
                            value = value.value.substring(1, value.value.length - 1);
                        } else {
                            value = value.value;
                        }
                    } else if (value.originalType === 'array') {
                        // Try to parse JSON strings back to arrays
                        try {
                            const parsed = JSON.parse(value.value);
                            if (Array.isArray(parsed)) {
                                value = parsed;
                            } else {
                                value = value.value;
                            }
                        } catch (e) {
                            // If parsing fails, keep as string
                            value = value.value;
                        }
                    } else if (value.originalType === 'object') {
                        // Try to parse JSON strings back to objects
                        try {
                            const parsed = JSON.parse(value.value);
                            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                                value = parsed;
                            } else {
                                value = value.value;
                            }
                        } catch (e) {
                            // If parsing fails, keep as string
                            value = value.value;
                        }
                    } else if (value.originalType === 'number') {
                        // For numbers, use the value directly if it's already a number
                        // or convert from the value property if it's an object
                        if (typeof value.value === 'number') {
                            value = value.value;
                        } else {
                            // Convert to number if possible
                            const numValue = Number(value.value);
                            value = isNaN(numValue) ? value.value : numValue;
                        }
                    } else if (value.originalType === 'boolean') {
                        // For booleans, use the value directly if it's already a boolean
                        // or convert from the value property if it's an object
                        if (typeof value.value === 'boolean') {
                            value = value.value;
                        } else {
                            // Convert to boolean
                            if (value.value === 'true') {
                                value = true;
                            } else if (value.value === 'false') {
                                value = false;
                            } else {
                                value = value.value;
                            }
                        }
                    } else {
                        // For other types, use the value as is
                        value = value.value;
                    }
                } else if (typeof value === 'object' && value !== null) {
                    // Handle values that are objects but don't have originalType
                    // This might be from the old format or direct values
                    if (value.hasOwnProperty('value')) {
                        value = value.value;
                    }
                } else if (typeof value === 'string') {
                    // Handle values that might be from the old format without type info
                    // Check if it's a quoted string
                    if (value.startsWith('"') && value.endsWith('"')) {
                        // Remove the quotes
                        value = value.substring(1, value.length - 1);
                    } else {
                        // Try to parse as JSON
                        try {
                            const parsed = JSON.parse(value);
                            if (typeof parsed === 'object') {
                                value = parsed;
                            }
                        } catch (e) {
                            // Not valid JSON, try to convert to number or keep as string
                            const numValue = Number(value);
                            value = isNaN(numValue) ? value : numValue;
                        }
                    }
                }
                
                const keyParts = key.split('.');
                let current = result;

                // Traverse the key path, creating objects as needed
                for (let i = 0; i < keyParts.length - 1; i++) {
                    const part = keyParts[i];
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }

                // Set the final value
                current[keyParts[keyParts.length - 1]] = value;
            }
        }

        return result;
    }

    /**
     * Get all blocks that match a given path pattern
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @param {string} pattern - Pattern to match (e.g., 'config.db.*')
     * @returns {Object} Matching blocks
     */
    static getBlocksByPattern(blocks, pattern) {
        const result = {};
        const isWildcard = pattern.endsWith('*');
        const basePattern = isWildcard ? pattern.slice(0, -1) : pattern;

        for (const key in blocks) {
            if (blocks.hasOwnProperty(key)) {
                if (isWildcard) {
                    if (key.startsWith(basePattern)) {
                        result[key] = blocks[key];
                    }
                } else {
                    if (key === pattern) {
                        result[key] = blocks[key];
                    }
                }
            }
        }

        return result;
    }

    /**
     * Apply specific block changes to an existing JSON file
     * @param {Object} existingJsonContent - The existing JSON content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {Object} Updated JSON object with only the changed blocks applied
     */
    static applyBlockChanges(existingJsonContent, changedBlocks) {
        // Parse the existing content into blocks
        const existingBlocks = this.parseToBlocks(existingJsonContent);
        
        // Apply the changed blocks to the existing blocks
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                
                // Simply replace the existing block with the changed block
                // This ensures we use the actual value and type, not the original type
                existingBlocks[key] = changedBlock;
            }
        }
        
        // Convert back to JSON
        return this.blocksToJson(existingBlocks);
    }
}

module.exports = JsonBlockParser;