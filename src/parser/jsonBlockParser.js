/**
 * JSON Block Parser
 * Parses JSON into hierarchical blocks that can be individually edited
 */

class JsonBlockParser {
    /**
     * Parse a JSON object into flat blocks with dot notation paths
     * @param {Object} jsonObject - The JSON object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {Object} originalNumberFormats - Map of paths to original number string formats (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static parseToBlocks(jsonObject, prefix = '', originalNumberFormats = {}) {
        const blocks = {};

        for (const key in jsonObject) {
            if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = jsonObject[key];

                if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'originalType')) {
                    // Check if this is an empty object
                    const isEmptyObject = Object.keys(value).length === 0;
                    
                    if (isEmptyObject) {
                        // For empty objects, create a block directly
                        blocks[fullKey] = {
                            value: '{}',
                            type: 'object',
                            depth: 0,
                            key: fullKey,
                            editable: true,
                            originalType: 'object'
                        };
                    } else {
                        // Recursively parse nested objects
                        Object.assign(blocks, this.parseToBlocks(value, fullKey, originalNumberFormats));
                    }
                } else if (Array.isArray(value)) {
                    // Check if array contains objects/maps that should be further divided
                    let hasComplexElements = value.some(item => 
                        typeof item === 'object' && item !== null);
                    
                    if (hasComplexElements) {
                        // For arrays with objects, create individual blocks for each element
                        // This allows editing individual array elements
                        for (let i = 0; i < value.length; i++) {
                            const elementKey = `${fullKey}[${i}]`;
                            const elementValue = value[i];
                            
                            if (typeof elementValue === 'object' && elementValue !== null) {
                                // Element is an object, show JSON representation
                                blocks[elementKey] = {
                                    value: JSON.stringify(elementValue, null, 2),
                                    type: 'object',
                                    depth: 0,
                                    key: elementKey,
                                    editable: true,
                                    originalType: 'object'
                                };
                                
                                // Recursively parse children of this object
                                Object.assign(blocks, this.parseToBlocks(elementValue, elementKey, originalNumberFormats));
                            } else {
                                // Element is a primitive value
                                const originalType = typeof elementValue;
                                let displayValue = elementValue;
                                
                                // For strings, wrap in quotes for display but keep track of original type
                                if (originalType === 'string') {
                                    displayValue = `"${elementValue}"`;
                                }
                                
                                // Store the original string representation for numbers to preserve formatting
                                let originalStringValue = null;
                                if (originalType === 'number') {
                                    // Check if we have the original format from the JSON string
                                    if (Object.prototype.hasOwnProperty.call(originalNumberFormats, elementKey)) {
                                        originalStringValue = originalNumberFormats[elementKey];
                                    } else {
                                        originalStringValue = elementValue.toString();
                                    }
                                }
                                
                                const blockObj = {
                                    value: displayValue,
                                    type: typeof elementValue,
                                    depth: 0,
                                    key: elementKey,
                                    editable: true,
                                    originalType: originalType
                                };
                                
                                // Add original string value for numbers
                                if (originalStringValue !== null) {
                                    blockObj.originalStringValue = originalStringValue;
                                }
                                
                                blocks[elementKey] = blockObj;
                            }
                        }
                    } else {
                        // Leaf node - create a block
                        blocks[fullKey] = {
                            value: JSON.stringify(value, null, 2),
                            type: 'array',
                            depth: 0,
                            key: fullKey,
                            editable: true,
                            originalType: 'array'
                        };
                    }
                } else {
                    // Leaf node - create a block
                    // Store original type information to preserve it when converting back
                    const originalType = typeof value;
                    let displayValue = value;
                    
                    // For strings, wrap in quotes for display but keep track of original type
                    if (originalType === 'string') {
                        displayValue = `"${value}"`;
                    }
                    
                    // Store the original string representation for numbers to preserve formatting
                    let originalStringValue = null;
                    if (originalType === 'number') {
                        // Check if we have the original format from the JSON string
                        if (Object.prototype.hasOwnProperty.call(originalNumberFormats, fullKey)) {
                            originalStringValue = originalNumberFormats[fullKey];
                        } else {
                            originalStringValue = value.toString();
                        }
                    }
                    
                    const blockObj = {
                        value: displayValue,
                        type: typeof value,
                        depth: 0,
                        key: fullKey,
                        editable: true,
                        originalType: originalType
                    };
                    
                    // Add original string value for numbers
                    if (originalStringValue !== null) {
                        blockObj.originalStringValue = originalStringValue;
                    }
                    
                    blocks[fullKey] = blockObj;
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
     * @param {Object} originalNumberFormats - Map of paths to original number string formats (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static parseToDepthBlocks(jsonObject, prefix = '', depth = 0, originalNumberFormats = {}) {
        const blocks = [];
        const currentLevelBlocks = {};

        for (const key in jsonObject) {
            if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = jsonObject[key];

                if (Array.isArray(value)) {
                    // This is an array, add it to current level with stringified representation
                    // Check if array contains objects/maps that should be further divided
                    let hasComplexElements = value.some(item => 
                        typeof item === 'object' && item !== null);
                    
                    if (hasComplexElements) {
                        // For arrays with objects, create individual blocks for each element
                        // This allows editing individual array elements
                        for (let i = 0; i < value.length; i++) {
                            const elementKey = `${fullKey}[${i}]`;
                            const elementValue = value[i];
                            
                            if (typeof elementValue === 'object' && elementValue !== null) {
                                // Element is an object, show JSON representation
                                currentLevelBlocks[elementKey] = {
                                    value: JSON.stringify(elementValue, null, 2),
                                    type: 'object',
                                    depth: depth,
                                    key: elementKey,
                                    editable: true,
                                    originalType: 'object'
                                };
                                
                                // Recursively parse children of this object
                                const childBlocks = this.parseToDepthBlocks(elementValue, elementKey, depth + 1, originalNumberFormats);
                                blocks.push(...childBlocks);
                            } else {
                                // Element is a primitive value
                                const originalType = typeof elementValue;
                                let displayValue = elementValue;
                                
                                // For strings, wrap in quotes for display but keep track of original type
                                if (originalType === 'string') {
                                    displayValue = `"${elementValue}"`;
                                }
                                
                                // Store the original string representation for numbers to preserve formatting
                                let originalStringValue = null;
                                if (originalType === 'number') {
                                    // Check if we have the original format from the JSON string
                                    if (Object.prototype.hasOwnProperty.call(originalNumberFormats, elementKey)) {
                                        originalStringValue = originalNumberFormats[elementKey];
                                    } else {
                                        originalStringValue = elementValue.toString();
                                    }
                                }
                                
                                const blockObj = {
                                    value: displayValue,
                                    type: typeof elementValue,
                                    depth: depth,
                                    key: elementKey,
                                    editable: true,
                                    originalType: originalType
                                };
                                
                                // Add original string value for numbers
                                if (originalStringValue !== null) {
                                    blockObj.originalStringValue = originalStringValue;
                                }
                                
                                currentLevelBlocks[elementKey] = blockObj;
                            }
                        }
                    } else {
                        // Simple array with primitive values only
                        // But format it nicely for better readability
                        currentLevelBlocks[fullKey] = {
                            value: JSON.stringify(value, null, 2),
                            type: 'array',
                            depth: depth,
                            key: fullKey,
                            editable: true, // Make it editable so users can modify the JSON directly,
                            originalType: 'array'
                        };
                    }
                } else if (typeof value === 'object' && value !== null) {
                    // This is a nested object, add it to current level with stringified representation
                    // Check if this is an empty object
                    const isEmptyObject = Object.keys(value).length === 0;
                    
                    if (isEmptyObject) {
                        // For empty objects, show as empty braces
                        currentLevelBlocks[fullKey] = {
                            value: '{}',
                            type: 'object',
                            depth: depth,
                            key: fullKey,
                            editable: true,
                            originalType: 'object'
                        };
                    } else {
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
                        const childBlocks = this.parseToDepthBlocks(value, fullKey, depth + 1, originalNumberFormats);
                        blocks.push(...childBlocks);
                    }
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
        return this.blocksToJsonWithDeletions(blocks, []);
    }
    
    static blocksToJsonWithDeletions(blocks, deletedKeys) {
        const result = {};

        // Process keys in the order they appear, not sorted by depth
        // This preserves the original field order for better Git diff compatibility
        const keys = Object.keys(blocks);

        for (const key of keys) {
            const block = blocks[key];
            let value = block;
            
            // Handle different types based on original type information
            if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'originalType')) {
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
                        // Check if we have an original string representation
                        if (Object.prototype.hasOwnProperty.call(value, 'originalStringValue')) {
                            // Check if the original string value was a whole number with .0
                            // In this case, we want to preserve that format
                            if (value.originalStringValue.endsWith('.0') && 
                                Number.isInteger(parseFloat(value.originalStringValue))) {
                                // Instead of using a special marker, create a special object
                                // that our custom stringifier can recognize
                                value = {
                                    __PRESERVE_DOT_ZERO__: true,
                                    value: parseFloat(value.originalStringValue)
                                };
                            } else {
                                // Convert to number for other cases
                                const numValue = Number(value.originalStringValue);
                                value = isNaN(numValue) ? value.value : numValue;
                            }
                        } else {
                            // Convert to number if possible
                            const numValue = Number(value.value);
                            value = isNaN(numValue) ? value.value : numValue;
                        }
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
                if (Object.prototype.hasOwnProperty.call(value, 'value')) {
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
            
            // Handle array indexing in keys (e.g., "key[0]", "key[1]", "parent.child[0].prop")
            // Extract the base key and process nested array notation
            let current = result;
            
            // Split the key by dots and process each part
            const parts = key.split('.');
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                if (i === parts.length - 1) {
                    // This is the final part, set the value
                    // Check if this part has array notation
                    if (part.includes('[')) {
                        const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
                        if (arrayMatch) {
                            const arrayName = arrayMatch[1];
                            const arrayIndex = parseInt(arrayMatch[2], 10);
                            
                            if (!current[arrayName]) {
                                current[arrayName] = [];
                            }
                            current[arrayName][arrayIndex] = value;
                        } else {
                            current[part] = value;
                        }
                    } else {
                        current[part] = value;
                    }
                } else {
                    // This is an intermediate part
                    // Check if this part has array notation
                    if (part.includes('[')) {
                        const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
                        if (arrayMatch) {
                            const arrayName = arrayMatch[1];
                            const arrayIndex = parseInt(arrayMatch[2], 10);
                            
                            if (!current[arrayName]) {
                                current[arrayName] = [];
                            }
                            
                            if (!current[arrayName][arrayIndex]) {
                                current[arrayName][arrayIndex] = {};
                            }
                            current = current[arrayName][arrayIndex];
                        } else {
                            if (!current[part]) {
                                current[part] = {};
                            }
                            current = current[part];
                        }
                    } else {
                        if (!current[part]) {
                            // Check if this is an intermediate part that needs an object
                            // If we're not at the final part of the key, we need to create an object
                            if (i < parts.length - 1) {
                                current[part] = {};
                            } else {
                                // This is the final part, but let's double-check the logic
                                // Check if adding this intermediate object would result in an empty object
                                // by seeing if there are any other keys that start with this path
                                let hasChildren = false;
                                for (const otherKey in blocks) {
                                    if (otherKey !== key && otherKey.startsWith(key + '.')) {
                                        hasChildren = true;
                                        break;
                                    }
                                }
                                
                                // Only create the intermediate object if it will have children
                                if (hasChildren) {
                                    current[part] = {};
                                } else {
                                    // Skip creating this intermediate object as it would be empty
                                    break;
                                }
                            }
                        }
                        if (current[part]) {
                            current = current[part];
                        } else {
                            // We've broken out of the loop because this would be an empty object
                            break;
                        }
                    }
                }
            }
        }
        
        // Now handle deletions - remove deleted properties from the result
        for (const deletedKey of deletedKeys) {
            // Split the key by dots and process each part
            const parts = deletedKey.split('.');
            let current = result;
            
            // Navigate to the parent object
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                
                // Check if this part has array notation
                if (part.includes('[')) {
                    const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
                    if (arrayMatch) {
                        const arrayName = arrayMatch[1];
                        const arrayIndex = parseInt(arrayMatch[2], 10);
                        
                        if (current[arrayName] && current[arrayName][arrayIndex]) {
                            current = current[arrayName][arrayIndex];
                        } else {
                            // Can't navigate further
                            break;
                        }
                    } else {
                        if (current[part]) {
                            current = current[part];
                        } else {
                            // Can't navigate further
                            break;
                        }
                    }
                } else {
                    if (current[part]) {
                        current = current[part];
                    } else {
                        // Can't navigate further
                        break;
                    }
                }
            }
            
            // Delete the final property if we could navigate to its parent
            const finalPart = parts[parts.length - 1];
            if (finalPart.includes('[')) {
                const arrayMatch = finalPart.match(/^([^[]+)\[(\d+)\]$/);
                if (arrayMatch) {
                    const arrayName = arrayMatch[1];
                    const arrayIndex = parseInt(arrayMatch[2], 10);
                    
                    if (current[arrayName]) {
                        delete current[arrayName][arrayIndex];
                        
                        // Clean up empty arrays
                        if (Array.isArray(current[arrayName]) && current[arrayName].length === 0) {
                            delete current[arrayName];
                        }
                    }
                }
            } else {
                if (Object.prototype.hasOwnProperty.call(current, finalPart)) {
                    delete current[finalPart];
                }
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
            if (Object.prototype.hasOwnProperty.call(blocks, key)) {
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
     * Apply only the specified changed blocks to a target JSON structure
     * This method ensures that only the provided changed blocks are applied
     * and all other parts of the target structure remain unchanged
     * @param {Object} targetJsonContent - The target JSON content to update
     * @param {Object} changedBlocks - Only the blocks that should be changed
     * @param {Object} originalNumberFormats - Map of paths to original number string formats
     * @returns {Object} Updated JSON object with only the specified changes applied
     */
    static applyOnlyChangedBlocks(targetJsonContent, changedBlocks, originalNumberFormats = {}) {
        // Parse the target content into blocks to understand its current structure
        const targetBlocks = this.parseToBlocks(targetJsonContent, '', originalNumberFormats);
        
        // Keep track of deleted keys
        const deletedKeys = [];
        
        // Apply only the changed blocks to the target blocks
        for (const key in changedBlocks) {
            if (Object.prototype.hasOwnProperty.call(changedBlocks, key)) {
                const changedBlock = changedBlocks[key];
                // Handle deletion (null value indicates deletion)
                if (changedBlock === null) {
                    if (Object.prototype.hasOwnProperty.call(targetBlocks, key)) {
                        delete targetBlocks[key];
                        deletedKeys.push(key);
                        
                        // Also delete any nested keys that are children of this key
                        // This is important for proper deletion of nested objects/arrays
                        for (const targetKey in targetBlocks) {
                            // Handle both regular object properties and array elements
                            if (targetKey === key + '' || 
                                targetKey.startsWith(key + '.') || 
                                targetKey.startsWith(key + '[')) {
                                delete targetBlocks[targetKey];
                            }
                            
                            // Also handle nested array elements
                            const keyWithDot = key + '.';
                            if (targetKey.startsWith(keyWithDot)) {
                                // Check if there are more segments after the key
                                const remaining = targetKey.substring(keyWithDot.length);
                                // If remaining starts with an array index or property, it's a child
                                if (remaining.includes('[') || remaining.includes('.')) {
                                    delete targetBlocks[targetKey];
                                }
                            }
                        }
                    }
                } else {
                    // Apply the change to the target
                    targetBlocks[key] = changedBlock;
                }
            }
        }
        
        // Convert to JSON
        return this.blocksToJsonWithDeletions(targetBlocks, deletedKeys);
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
            if (Object.prototype.hasOwnProperty.call(changedBlocks, key)) {
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
     * Enhanced version of applyBlockChanges that properly handles nested objects
     * when editing at different depths
     * @param {Object} existingJsonContent - The existing JSON content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @param {Object} originalNumberFormats - Map of paths to original number string formats
     * @returns {Object} Updated JSON object with only the changed blocks applied
     */
    static applyBlockChangesEnhanced(existingJsonContent, changedBlocks, originalNumberFormats = {}) {
        // For JSON, we should use applyOnlyChangedBlocks to properly handle selective updates
        // and preserve the existing structure
        return this.applyOnlyChangedBlocks(existingJsonContent, changedBlocks, originalNumberFormats);
    }

    /**
     * Extract original number formats from a JSON string before parsing
     * @param {string} jsonString - The JSON string to analyze
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Map of paths to original number string formats
     */
    static extractOriginalNumberFormats(jsonString, prefix = '') {
        const formats = {};
        
        // Remove whitespace for more reliable parsing
        const cleanJsonString = jsonString.replace(/\s+/g, '');
        
        // Regex to match key-value pairs with decimal numbers
        // This pattern matches "key":number.decimal format
        const numberPattern = /"([^"]+)":(\d+\.\d+)/g;
        let match;
        
        while ((match = numberPattern.exec(cleanJsonString)) !== null) {
            const key = match[1];
            const value = match[2];
            const fullKey = prefix ? `${prefix}.${key}` : key;
            formats[fullKey] = value;
        }
        
        // Also handle nested objects
        // Regex to match nested objects
        const objectPattern = /"([^"]+)":(\{[^{}]*\})/g;
        let objectMatch;
        
        while ((objectMatch = objectPattern.exec(cleanJsonString)) !== null) {
            const key = objectMatch[1];
            const value = objectMatch[2];
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            // Recursively extract formats from nested objects
            const nestedFormats = this.extractOriginalNumberFormats(value, fullKey);
            Object.assign(formats, nestedFormats);
        }
        
        // Handle arrays with objects
        const arrayPattern = /"([^"]+)":($$[^$$]*$$)/g;
        let arrayMatch;
        
        while ((arrayMatch = arrayPattern.exec(cleanJsonString)) !== null) {
            const key = arrayMatch[1];
            const value = arrayMatch[2];
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            // Handle array elements with indices
            // Look for objects within the array
            const arrayObjectPattern = /($$\d+$$):(\{[^{}]*\})/g;
            let arrayObjectMatch;
            
            while ((arrayObjectMatch = arrayObjectPattern.exec(value)) !== null) {
                const index = arrayObjectMatch[1].replace(/[$$]/g, '');
                const objectValue = arrayObjectMatch[2];
                const elementKey = `${fullKey}[${index}]`;
                
                // Recursively extract formats from nested objects in arrays
                const nestedFormats = this.extractOriginalNumberFormats(objectValue, elementKey);
                Object.assign(formats, nestedFormats);
            }
        }
        
        return formats;
    }
}

module.exports = JsonBlockParser;