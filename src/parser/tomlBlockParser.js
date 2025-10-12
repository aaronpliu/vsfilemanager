/**
 * TOML Block Parser
 * Parses TOML into hierarchical blocks that can be individually edited,
 * similar to the JSON and YAML block parsers
 */
const toml = require('toml');
const tomlify = require('tomlify-j0.4');

class TomlBlockParser {
    /**
     * Parse a TOML string into flat blocks with dot notation paths
     * @param {string} tomlString - The TOML string to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static parseToBlocks(tomlString, prefix = '') {
        try {
            const tomlObject = toml.parse(tomlString);
            return this._parseObjectToBlocks(tomlObject, prefix);
        } catch (e) {
            throw new Error('Invalid TOML format: ' + e.message);
        }
    }

    /**
     * Parse a TOML object into flat blocks with dot notation paths
     * @param {Object} tomlObject - The TOML object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static _parseObjectToBlocks(tomlObject, prefix = '') {
        const blocks = {};

        if (typeof tomlObject !== 'object' || tomlObject === null) {
            // Handle scalar values
            const originalType = typeof tomlObject;
            let displayValue = tomlObject;
            
            // For strings, wrap in quotes for display but keep track of original type
            if (originalType === 'string') {
                displayValue = `"${tomlObject}"`;
            }
            
            return {
                [prefix]: {
                    value: displayValue,
                    type: typeof tomlObject,
                    depth: 0,
                    key: prefix,
                    editable: true,
                    originalType: originalType
                }
            };
        }

        // Use Object.keys() instead of for...in with hasOwnProperty to avoid issues
        // with non-plain objects
        const keys = Object.keys(tomlObject);
        for (const key of keys) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = tomlObject[key];

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // This is a nested object
                // Show a TOML stringified version of the object
                let tomlString;
                try {
                    tomlString = tomlify.toToml(value, { space: 2 });
                } catch (e) {
                    // If we can't convert to TOML, show the JSON representation
                    tomlString = JSON.stringify(value, null, 2);
                }
                blocks[fullKey] = {
                    value: tomlString,
                    type: 'object',
                    depth: 0, // Will be set properly in parseToDepthBlocks
                    key: fullKey,
                    editable: true,
                    originalType: 'object'
                };
                
                // Recursively parse children
                Object.assign(blocks, this._parseObjectToBlocks(value, fullKey));
            } else if (Array.isArray(value)) {
                // This is an array
                // Handle arrays the same way as JSON arrays
                blocks[fullKey] = {
                    value: JSON.stringify(value, null, 2),
                    type: 'array',
                    depth: 0, // Will be set properly in parseToDepthBlocks
                    key: fullKey,
                    editable: true,
                    originalType: 'array'
                };
            } else {
                // Leaf node - create a block
                // Store original type information to preserve it when converting back
                const originalType = typeof value;
                let displayValue = value;
                
                // For strings, wrap in quotes for display but keep track of original type
                if (originalType === 'string') {
                    displayValue = `"${value}"`;
                }
                
                blocks[fullKey] = {
                    value: displayValue,
                    type: typeof value,
                    depth: 0, // Will be set properly in parseToDepthBlocks
                    key: fullKey,
                    editable: true,
                    originalType: originalType
                };
            }
        }

        return blocks;
    }

    /**
     * Parse a TOML string into hierarchical blocks grouped by depth
     * @param {string|object} tomlData - The TOML string or parsed object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {number} depth - Current depth level (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static parseToDepthBlocks(tomlData, prefix = '', depth = 0) {
        const blocks = [];
        const currentLevelBlocks = {};
        let hasChildren = false;

        // Parse tomlData if it's a string
        let tomlObject = tomlData;
        if (typeof tomlData === 'string') {
            try {
                tomlObject = toml.parse(tomlData);
            } catch (e) {
                throw new Error('Invalid TOML format: ' + e.message);
            }
        }

        if (typeof tomlObject !== 'object' || tomlObject === null) {
            // Handle scalar values
            const originalType = typeof tomlObject;
            let displayValue = tomlObject;
            
            // For strings, wrap in quotes for display but keep track of original type
            if (originalType === 'string') {
                displayValue = `"${tomlObject}"`;
            }
            
            currentLevelBlocks[prefix] = {
                value: displayValue,
                type: typeof tomlObject,
                depth: depth,
                key: prefix,
                editable: true,
                originalType: originalType
            };
            
            blocks.unshift({
                depth: depth,
                blocks: currentLevelBlocks,
                prefix: prefix
            });
            
            return blocks;
        }

        // Use Object.keys() instead of for...in with hasOwnProperty to avoid issues
        // with non-plain objects
        const keys = Object.keys(tomlObject);
        for (const key of keys) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = tomlObject[key];

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // This is a nested object
                hasChildren = true;
                // Show a TOML stringified version of the object
                let tomlString;
                try {
                    tomlString = tomlify.toToml(value, { space: 2 });
                } catch (e) {
                    // If we can't convert to TOML, show the JSON representation
                    tomlString = JSON.stringify(value, null, 2);
                }
                currentLevelBlocks[fullKey] = {
                    value: tomlString,
                    type: 'object',
                    depth: depth,
                    key: fullKey,
                    editable: true,
                    originalType: 'object'
                };
                
                // Recursively parse children
                const childBlocks = this.parseToDepthBlocks(value, fullKey, depth + 1);
                blocks.push(...childBlocks);
            } else if (Array.isArray(value)) {
                // This is an array, add it to current level with stringified representation
                // Handle arrays the same way as JSON arrays
                currentLevelBlocks[fullKey] = {
                    value: JSON.stringify(value, null, 2),
                    type: 'array',
                    depth: depth,
                    key: fullKey,
                    editable: true,
                    originalType: 'array'
                };
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

        // Add current level blocks at the beginning
        blocks.unshift({
            depth: depth,
            blocks: currentLevelBlocks,
            prefix: prefix
        });

        return blocks;
    }

    /**
     * Convert flat blocks back to a TOML string
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @returns {string} TOML string
     */
    static blocksToToml(blocks) {
        const result = {};

        // First, let's sort the keys by depth (number of dots) so we process 
        // parent objects before their children
        const sortedKeys = Object.keys(blocks).sort((a, b) => {
            const depthA = (a.match(/\./g) || []).length;
            const depthB = (b.match(/\./g) || []).length;
            return depthA - depthB;
        });

        for (const key of sortedKeys) {
            const block = blocks[key];
            let value = block;
            
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
                    // Try to parse TOML strings back to objects
                    try {
                        const parsed = toml.parse(value.value);
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
                    // Try to parse as TOML
                    try {
                        const parsed = toml.parse(value);
                        if (typeof parsed === 'object') {
                            value = parsed;
                        }
                    } catch (e) {
                        // Not valid TOML, try to convert to number or keep as string
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

        // Use a more permissive tomlify configuration to handle mixed array types
        return tomlify.toToml(result, { 
            space: 2
        });
    }

    /**
     * Convert flat blocks back to a nested JSON object
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @returns {Object} Nested JSON object
     */
    static blocksToJson(blocks) {
        const result = {};

        // Process keys in the order they appear, not sorted by depth
        // This preserves the original field order for better Git diff compatibility
        const keys = Object.keys(blocks);

        for (const key of keys) {
            const block = blocks[key];
            let value = block;
            
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
     * Apply specific block changes to an existing TOML content
     * @param {string} existingTomlContent - The existing TOML content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {string} Updated TOML string with only the changed blocks applied
     */
    static applyBlockChanges(existingTomlContent, changedBlocks) {
        // Parse the existing content into blocks
        const existingBlocks = this.parseToBlocks(existingTomlContent);
        
        // Apply the changed blocks to the existing blocks
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                
                // Simply replace the existing block with the changed block
                // This ensures we use the actual value and type, not the original type
                existingBlocks[key] = changedBlock;
            }
        }
        
        // Convert back to TOML
        return this.blocksToToml(existingBlocks);
    }

    /**
     * Apply only the specified changed blocks to a target TOML structure
     * This method ensures that only the provided changed blocks are applied
     * and all other parts of the target structure remain unchanged
     * @param {string} targetTomlContent - The target TOML content to update
     * @param {Object} changedBlocks - Only the blocks that should be changed
     * @returns {string} Updated TOML string with only the specified changes applied
     */
    static applyOnlyChangedBlocks(targetTomlContent, changedBlocks) {
        // Handle empty content case
        let tomlContent = targetTomlContent;
        if (!tomlContent || tomlContent.trim() === '') {
            tomlContent = '{}';
        }
        
        // Parse the target content into blocks to understand its current structure
        const targetBlocks = this.parseToBlocks(tomlContent);
        
        // Apply only the changed blocks to the target blocks
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                // Handle deletion (null value indicates deletion)
                if (changedBlock === null) {
                    if (targetBlocks.hasOwnProperty(key)) {
                        delete targetBlocks[key];
                    }
                } else {
                    // Apply the change to the target
                    targetBlocks[key] = changedBlock;
                }
            }
        }
        
        // Convert to TOML
        return this.blocksToToml(targetBlocks);
    }

    /**
     * Enhanced version of applyBlockChanges that properly handles nested objects
     * when editing at different depths
     * @param {string} existingTomlContent - The existing TOML content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {string} Updated TOML string with only the changed blocks applied
     */
    static applyBlockChangesEnhanced(existingTomlContent, changedBlocks) {
        // Parse the existing content into blocks
        const existingBlocks = this.parseToBlocks(existingTomlContent);
        
        // Apply the changed blocks to the existing blocks
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                
                // Check if this is an object that was edited as a string at a higher level
                if (changedBlock && 
                    changedBlock.originalType === 'object' && 
                    typeof changedBlock.value === 'string') {
                    // Try to parse the string back to an object
                    try {
                        const parsed = toml.parse(changedBlock.value);
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                            // Successfully parsed, update the value
                            changedBlock.value = parsed;
                            changedBlock.originalType = 'object';
                        }
                    } catch (e) {
                        // Not a valid TOML, keep as string
                    }
                } else if (changedBlock && 
                          changedBlock.originalType === 'array' && 
                          typeof changedBlock.value === 'string') {
                    // Try to parse the string back to an array
                    try {
                        const parsed = JSON.parse(changedBlock.value);
                        if (Array.isArray(parsed)) {
                            // Successfully parsed, update the value
                            changedBlock.value = parsed;
                            changedBlock.originalType = 'array';
                        }
                    } catch (e) {
                        // Not a valid JSON array, keep as string
                    }
                }
                
                // Simply replace the existing block with the changed block
                // This ensures we use the actual value and type, not the original type
                existingBlocks[key] = changedBlock;
            }
        }
        
        // Convert back to TOML
        return this.blocksToToml(existingBlocks);
    }
}

module.exports = TomlBlockParser;