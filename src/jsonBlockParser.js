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
                        editable: true // Make it editable so users can modify the JSON directly
                    };
                    
                    // Recursively parse children
                    const childBlocks = this.parseToDepthBlocks(value, fullKey, depth + 1);
                    blocks.push(...childBlocks);
                } else {
                    // Leaf node - create a block
                    currentLevelBlocks[fullKey] = {
                        value: typeof value === 'string' ? `"${value}"` : value,
                        type: typeof value,
                        depth: depth,
                        key: fullKey,
                        editable: true
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
                
                // Try to parse JSON strings back to objects
                if (typeof value === 'string') {
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
                            // Not valid JSON, keep as string
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
}

module.exports = JsonBlockParser;