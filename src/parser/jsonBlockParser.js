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

                if (Array.isArray(value)) {
                    // This is an array, add it to current level with stringified representation
                    // But format it nicely for better readability
                    currentLevelBlocks[fullKey] = {
                        value: JSON.stringify(value, null, 2),
                        type: 'array',
                        depth: depth,
                        key: fullKey,
                        editable: true, // Make it editable so users can modify the JSON directly,
                        originalType: 'array'
                    };
                } else if (typeof value === 'object' && value !== null) {
                    // This is a nested object, add it to current level with stringified representation
                    hasChildren = true;
                    // Show a stringified version of the object instead of '[object]'
                    currentLevelBlocks[fullKey] = {
                        value: JSON.stringify(value, null, 2),
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
            
            // Set the value in the result object
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

    /**
     * Enhanced version that maintains consistency across all depth levels
     * when editing nested objects
     * @param {Object} existingJsonContent - The existing JSON content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {Object} Updated JSON object with consistency across depths
     */
    static applyBlockChangesEnhanced(existingJsonContent, changedBlocks) {
        // Get the current structure as depth blocks
        const currentDepthBlocks = this.parseToDepthBlocks(existingJsonContent);
        
        // Create a map of all current blocks
        const allCurrentBlocks = new Map();
        currentDepthBlocks.forEach(depthGroup => {
            for (const key in depthGroup.blocks) {
                allCurrentBlocks.set(key, {...depthGroup.blocks[key]});
            }
        });
        
        // Apply changes to our map
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                if (changedBlock !== undefined) {
                    allCurrentBlocks.set(key, {...changedBlock});
                } else {
                    allCurrentBlocks.delete(key);
                }
            }
        }
        
        // Now we need to ensure consistency between parent and child blocks
        // Make a copy for updates
        const updatedBlocks = new Map(allCurrentBlocks);
        
        // Process all blocks to ensure consistency
        allCurrentBlocks.forEach((block, key) => {
            // If this is an object that was edited as a string
            if (block.originalType === 'object' && 
                typeof block.value === 'string' && 
                block.value.startsWith('{') && 
                block.value.endsWith('}')) {
                
                try {
                    // Parse the object
                    const parsedObj = JSON.parse(block.value);
                    
                    // Update or create child blocks based on the parsed object
                    const newChildBlocks = this.parseToBlocks(parsedObj, key);
                    for (const childKey in newChildBlocks) {
                        // Only update if not explicitly changed by user
                        if (!changedBlocks.hasOwnProperty(childKey)) {
                            // Create proper block structure
                            const childValue = newChildBlocks[childKey];
                            const childBlock = {
                                value: childValue,
                                type: typeof childValue,
                                depth: (childKey.match(/\./g) || []).length,
                                key: childKey,
                                editable: true,
                                originalType: typeof childValue
                            };
                            
                            // Format string values properly
                            if (childBlock.originalType === 'string') {
                                childBlock.value = `"${childBlock.value}"`;
                            }
                            
                            updatedBlocks.set(childKey, childBlock);
                        }
                    }
                } catch (e) {
                    // If parsing fails, keep the block as is
                    console.warn(`Failed to parse object for key ${key}:`, e.message);
                }
            }
        });
        
        // Handle the reverse case - child properties were edited, update parent representations
        // We need to process this after all direct changes are applied
        allCurrentBlocks.forEach((block, key) => {
            if (key.includes('.')) {
                // Get parent key
                const keyParts = key.split('.');
                for (let i = 1; i < keyParts.length; i++) {
                    const parentKeyParts = keyParts.slice(0, keyParts.length - i);
                    const parentKey = parentKeyParts.join('.');
                    
                    // If parent exists and is an object, update its string representation
                    if (updatedBlocks.has(parentKey) && 
                        updatedBlocks.get(parentKey).originalType === 'object') {
                        
                        const parentBlock = {...updatedBlocks.get(parentKey)};
                        try {
                            // Parse current parent object
                            let parentObj = {};
                            if (typeof parentBlock.value === 'string') {
                                // Make sure we're working with a valid JSON string
                                if (parentBlock.value.startsWith('{') && parentBlock.value.endsWith('}')) {
                                    parentObj = JSON.parse(parentBlock.value);
                                }
                            } else if (typeof parentBlock.value === 'object' && parentBlock.value !== null) {
                                // If it's already an object, use it directly
                                parentObj = parentBlock.value;
                            }
                            
                            // Find all child blocks that belong to this parent
                            const parentPrefix = parentKey + '.';
                            const childValues = {};
                            
                            // Collect all relevant child values
                            updatedBlocks.forEach((childBlock, childKey) => {
                                if (childKey.startsWith(parentPrefix)) {
                                    const relativeKey = childKey.substring(parentPrefix.length);
                                    // Convert value back to proper type
                                    let value = childBlock.value;
                                    if (childBlock.originalType === 'string' && 
                                        typeof value === 'string' &&
                                        value.startsWith('"') && 
                                        value.endsWith('"')) {
                                        value = value.substring(1, value.length - 1);
                                    } else if (childBlock.originalType === 'number') {
                                        value = Number(value);
                                    } else if (childBlock.originalType === 'boolean') {
                                        if (value === 'true') value = true;
                                        else if (value === 'false') value = false;
                                    }
                                    childValues[relativeKey] = value;
                                }
                            });
                            
                            // Reconstruct the parent object using the child values
                            function buildNestedObject(obj, path, value) {
                                const parts = path.split('.');
                                let current = obj;
                                
                                // Navigate/create the path, ensuring all intermediate objects exist
                                for (let i = 0; i < parts.length - 1; i++) {
                                    const part = parts[i];
                                    if (!(part in current) || current[part] === null || typeof current[part] !== 'object') {
                                        current[part] = {}; // Create object if it doesn't exist or is not an object
                                    }
                                    current = current[part];
                                }
                                
                                // Set the final value
                                const finalPart = parts[parts.length - 1];
                                current[finalPart] = value;
                                return obj;
                            }
                            
                            // Build the complete object from all child values
                            let reconstructedObj = {...parentObj}; // Start with existing parent object
                            for (const childPath in childValues) {
                                buildNestedObject(reconstructedObj, childPath, childValues[childPath]);
                            }
                            
                            // Update parent block's string representation
                            parentBlock.value = JSON.stringify(reconstructedObj);
                            updatedBlocks.set(parentKey, parentBlock);
                        } catch (e) {
                            console.warn(`Failed to update parent object for key ${parentKey}:`, e.message);
                        }
                    }
                }
            }
        });
        
        // Convert map back to object
        const finalBlocks = {};
        updatedBlocks.forEach((block, key) => {
            finalBlocks[key] = block;
        });
        
        // Convert to JSON
        return this.blocksToJson(finalBlocks);
    }

    /**
     * Apply only the specified changed blocks to a target JSON structure
     * This method ensures that only the provided changed blocks are applied
     * and all other parts of the target structure remain unchanged
     * @param {Object} targetJsonContent - The target JSON content to update
     * @param {Object} changedBlocks - Only the blocks that should be changed
     * @returns {Object} Updated JSON object with only the specified changes applied
     */
    static applyOnlyChangedBlocks(targetJsonContent, changedBlocks) {
        // Parse the target content into blocks to understand its current structure
        const targetBlocks = this.parseToBlocks(targetJsonContent);
        
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
        
        // Convert to JSON
        return this.blocksToJson(targetBlocks);
    }
}

module.exports = JsonBlockParser;