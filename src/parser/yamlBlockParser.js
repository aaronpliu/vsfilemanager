const yaml = require('js-yaml');

/**
 * YAML Block Parser
 * Parses YAML into hierarchical blocks that can be individually edited,
 * similar to the JSON block parser
 */
class YamlBlockParser {
    /**
     * Parse a YAML string into flat blocks with dot notation paths
     * @param {string} yamlString - The YAML string to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static parseToBlocks(yamlString, prefix = '') {
        try {
            const yamlObject = yaml.load(yamlString);
            return this._parseObjectToBlocks(yamlObject, prefix);
        } catch (e) {
            throw new Error('Invalid YAML format: ' + e.message);
        }
    }

    /**
     * Parse a YAML object into flat blocks with dot notation paths
     * @param {Object} yamlObject - The YAML object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static _parseObjectToBlocks(yamlObject, prefix = '') {
        const blocks = {};

        if (typeof yamlObject !== 'object' || yamlObject === null) {
            // Handle scalar values
            const originalType = typeof yamlObject;
            let displayValue = yamlObject;
            
            // For strings, wrap in quotes for display but keep track of original type
            if (originalType === 'string') {
                displayValue = `"${yamlObject}"`;
            }
            
            return {
                [prefix]: {
                    value: displayValue,
                    type: typeof yamlObject,
                    depth: 0,
                    key: prefix,
                    editable: true,
                    originalType: originalType
                }
            };
        }

        for (const key in yamlObject) {
            if (yamlObject.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = yamlObject[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // This is a nested object
                    // Show a YAML stringified version of the object
                    const yamlString = yaml.dump(value);
                    blocks[fullKey] = {
                        value: yamlString,
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
                    const yamlString = yaml.dump(value);
                    blocks[fullKey] = {
                        value: yamlString,
                        type: 'array',
                        depth: 0, // Will be set properly in parseToDepthBlocks
                        key: fullKey,
                        editable: true,
                        originalType: 'array'
                    };
                    
                    // For arrays, we don't recursively parse elements as separate blocks
                    // since YAML array elements don't have keys like JSON objects
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
        }

        return blocks;
    }

    /**
     * Parse a YAML string into hierarchical blocks grouped by depth
     * @param {string} yamlString - The YAML string to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {number} depth - Current depth level (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static parseToDepthBlocks(yamlString, prefix = '', depth = 0) {
        try {
            const yamlObject = yaml.load(yamlString);
            return this._parseObjectToDepthBlocks(yamlObject, prefix, depth);
        } catch (e) {
            throw new Error('Invalid YAML format: ' + e.message);
        }
    }

    /**
     * Parse a YAML object into hierarchical blocks grouped by depth
     * @param {Object} yamlObject - The YAML object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {number} depth - Current depth level (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static _parseObjectToDepthBlocks(yamlObject, prefix = '', depth = 0) {
        const blocks = [];
        const currentLevelBlocks = {};
        let hasChildren = false;

        if (typeof yamlObject !== 'object' || yamlObject === null) {
            // Handle scalar values
            const originalType = typeof yamlObject;
            let displayValue = yamlObject;
            
            // For strings, wrap in quotes for display but keep track of original type
            if (originalType === 'string') {
                displayValue = `"${yamlObject}"`;
            }
            
            currentLevelBlocks[prefix] = {
                value: displayValue,
                type: typeof yamlObject,
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

        for (const key in yamlObject) {
            if (yamlObject.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = yamlObject[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // This is a nested object
                    hasChildren = true;
                    // Show a YAML stringified version of the object
                    const yamlString = yaml.dump(value);
                    currentLevelBlocks[fullKey] = {
                        value: yamlString,
                        type: 'object',
                        depth: depth,
                        key: fullKey,
                        editable: true,
                        originalType: 'object'
                    };
                    
                    // Recursively parse children
                    const childBlocks = this._parseObjectToDepthBlocks(value, fullKey, depth + 1);
                    blocks.push(...childBlocks);
                } else if (Array.isArray(value)) {
                    // This is an array
                    const yamlString = yaml.dump(value);
                    currentLevelBlocks[fullKey] = {
                        value: yamlString,
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
     * Convert flat blocks back to a YAML string
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @returns {string} YAML string
     */
    static blocksToYaml(blocks) {
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
                        // Try to parse YAML strings back to arrays
                        try {
                            const parsed = yaml.load(value.value);
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
                        // Try to parse YAML strings back to objects
                        try {
                            const parsed = yaml.load(value.value);
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
                        // Try to parse as YAML
                        try {
                            const parsed = yaml.load(value);
                            if (typeof parsed === 'object') {
                                value = parsed;
                            }
                        } catch (e) {
                            // Not valid YAML, try to convert to number or keep as string
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
                    // Try to parse YAML strings back to arrays
                    try {
                        const parsed = yaml.load(value.value);
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
                    // Try to parse YAML strings back to objects
                    try {
                        const parsed = yaml.load(value.value);
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
                    // Try to parse as YAML
                    try {
                        const parsed = yaml.load(value);
                        if (typeof parsed === 'object') {
                            value = parsed;
                        }
                    } catch (e) {
                        // Not valid YAML, try to convert to number or keep as string
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

        return yaml.dump(result);
    }

    /**
     * Apply specific block changes to an existing YAML content
     * @param {string} existingYamlContent - The existing YAML content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {string} Updated YAML string with only the changed blocks applied
     */
    static applyBlockChanges(existingYamlContent, changedBlocks) {
        // Parse the existing content into blocks
        const existingBlocks = this.parseToBlocks(existingYamlContent);
        
        // Apply the changed blocks to the existing blocks
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                
                // Simply replace the existing block with the changed block
                // This ensures we use the actual value and type, not the original type
                existingBlocks[key] = changedBlock;
            }
        }
        
        // Convert back to YAML
        return this.blocksToYaml(existingBlocks);
    }
}

module.exports = YamlBlockParser;