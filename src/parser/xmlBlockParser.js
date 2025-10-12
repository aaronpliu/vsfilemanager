/**
 * XML Block Parser
 * Parses XML into hierarchical blocks that can be individually edited,
 * similar to the JSON and YAML block parsers
 */
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

class XmlBlockParser {
    /**
     * Parse an XML string into flat blocks with dot notation paths
     * @param {string} xmlString - The XML string to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static parseToBlocks(xmlString, prefix = '') {
        try {
            const options = {
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                textNodeName: '#text',
                allowBooleanAttributes: true
            };
            const parser = new XMLParser(options);
            const xmlObject = parser.parse(xmlString);
            return this._parseObjectToBlocks(xmlObject, prefix);
        } catch (e) {
            throw new Error('Invalid XML format: ' + e.message);
        }
    }

    /**
     * Parse an XML object into flat blocks with dot notation paths
     * @param {Object} xmlObject - The XML object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @returns {Object} Flattened object with dot notation keys
     */
    static _parseObjectToBlocks(xmlObject, prefix = '') {
        const blocks = {};

        if (typeof xmlObject !== 'object' || xmlObject === null) {
            // Handle scalar values
            const originalType = typeof xmlObject;
            let displayValue = xmlObject;
            
            // For strings, wrap in quotes for display but keep track of original type
            if (originalType === 'string') {
                displayValue = `"${xmlObject}"`;
            }
            
            return {
                [prefix]: {
                    value: displayValue,
                    type: typeof xmlObject,
                    depth: 0,
                    key: prefix,
                    editable: true,
                    originalType: originalType
                }
            };
        }

        for (const key in xmlObject) {
            if (xmlObject.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = xmlObject[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // This is a nested object
                    // Show a XML stringified version of the object
                    const options = {
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                        textNodeName: '#text',
                        allowBooleanAttributes: true,
                        format: true
                    };
                    const builder = new XMLBuilder(options);
                    const xmlString = builder.build(value);
                    blocks[fullKey] = {
                        value: xmlString,
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
                                // Element is an object, show XML representation
                                const options = {
                                    ignoreAttributes: false,
                                    attributeNamePrefix: '@_',
                                    textNodeName: '#text',
                                    allowBooleanAttributes: true,
                                    format: true
                                };
                                const builder = new XMLBuilder(options);
                                const xmlString = builder.build(elementValue);
                                blocks[elementKey] = {
                                    value: xmlString,
                                    type: 'object',
                                    depth: 0, // Will be set properly in parseToDepthBlocks
                                    key: elementKey,
                                    editable: true,
                                    originalType: 'object'
                                };
                                
                                // Recursively parse children of this object
                                Object.assign(blocks, this._parseObjectToBlocks(elementValue, elementKey));
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
                                    originalStringValue = elementValue.toString();
                                }
                                
                                const blockObj = {
                                    value: displayValue,
                                    type: typeof elementValue,
                                    depth: 0, // Will be set properly in parseToDepthBlocks
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
                        // Handle arrays the same way as JSON arrays
                        blocks[fullKey] = {
                            value: JSON.stringify(value, null, 2),
                            type: 'array',
                            depth: 0, // Will be set properly in parseToDepthBlocks
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
                        originalStringValue = value.toString();
                    }
                    
                    const blockObj = {
                        value: displayValue,
                        type: typeof value,
                        depth: 0, // Will be set properly in parseToDepthBlocks
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
     * Parse an XML string into hierarchical blocks grouped by depth
     * @param {string} xmlString - The XML string to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {number} depth - Current depth level (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static parseToDepthBlocks(xmlString, prefix = '', depth = 0) {
        try {
            const options = {
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                textNodeName: '#text',
                allowBooleanAttributes: true
            };
            const parser = new XMLParser(options);
            const xmlObject = parser.parse(xmlString);
            return this._parseObjectToDepthBlocks(xmlObject, prefix, depth);
        } catch (e) {
            throw new Error('Invalid XML format: ' + e.message);
        }
    }

    /**
     * Parse an XML object into hierarchical blocks grouped by depth
     * @param {Object} xmlObject - The XML object to parse
     * @param {string} prefix - Prefix for nested objects (used internally)
     * @param {number} depth - Current depth level (used internally)
     * @returns {Array} Array of block groups with metadata
     */
    static _parseObjectToDepthBlocks(xmlObject, prefix = '', depth = 0) {
        const blocks = [];
        const currentLevelBlocks = {};
        let hasChildren = false;

        if (typeof xmlObject !== 'object' || xmlObject === null) {
            // Handle scalar values
            const originalType = typeof xmlObject;
            let displayValue = xmlObject;
            
            // For strings, wrap in quotes for display but keep track of original type
            if (originalType === 'string') {
                displayValue = `"${xmlObject}"`;
            }
            
            currentLevelBlocks[prefix] = {
                value: displayValue,
                type: typeof xmlObject,
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

        for (const key in xmlObject) {
            if (xmlObject.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = xmlObject[key];

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // This is a nested object
                    hasChildren = true;
                    // Show a XML stringified version of the object
                    const options = {
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                        textNodeName: '#text',
                        allowBooleanAttributes: true,
                        format: true,
                        indentBy: '  ' // Use 2 spaces for indentation
                    };
                    const builder = new XMLBuilder(options);
                    const xmlString = builder.build(value);
                    currentLevelBlocks[fullKey] = {
                        value: xmlString,
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
                                // Element is an object, show XML representation
                                const options = {
                                    ignoreAttributes: false,
                                    attributeNamePrefix: '@_',
                                    textNodeName: '#text',
                                    allowBooleanAttributes: true,
                                    format: true,
                                    indentBy: '  ' // Use 2 spaces for indentation
                                };
                                const builder = new XMLBuilder(options);
                                const xmlString = builder.build(elementValue);
                                currentLevelBlocks[elementKey] = {
                                    value: xmlString,
                                    type: 'object',
                                    depth: depth,
                                    key: elementKey,
                                    editable: true,
                                    originalType: 'object'
                                };
                                
                                // Recursively parse children of this object
                                const childBlocks = this._parseObjectToDepthBlocks(elementValue, elementKey, depth + 1);
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
                                    originalStringValue = elementValue.toString();
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
                        // Handle arrays the same way as JSON arrays
                        currentLevelBlocks[fullKey] = {
                            value: JSON.stringify(value, null, 2),
                            type: 'array',
                            depth: depth,
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
                        originalStringValue = value.toString();
                    }
                    
                    const blockObj = {
                        value: displayValue,
                        type: typeof value,
                        depth: depth,
                        key: fullKey,
                        editable: true,
                        originalType: originalType
                    };
                    
                    // Add original string value for numbers
                    if (originalStringValue !== null) {
                        blockObj.originalStringValue = originalStringValue;
                    }
                    
                    currentLevelBlocks[fullKey] = blockObj;
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
     * Convert flat blocks back to an XML string
     * @param {Object} blocks - Flattened blocks with dot notation keys
     * @returns {string} XML string
     */
    static blocksToXml(blocks) {
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
                    // Try to parse XML strings back to objects
                    try {
                        const options = {
                            ignoreAttributes: false,
                            attributeNamePrefix: '@_',
                            textNodeName: '#text',
                            allowBooleanAttributes: true
                        };
                        const parser = new XMLParser(options);
                        const parsed = parser.parse(value.value);
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
                    // Try to parse as XML
                    try {
                        const options = {
                            ignoreAttributes: false,
                            attributeNamePrefix: '@_',
                            textNodeName: '#text',
                            allowBooleanAttributes: true
                        };
                        const parser = new XMLParser(options);
                        const parsed = parser.parse(value);
                        if (typeof parsed === 'object') {
                            value = parsed;
                        }
                    } catch (e) {
                        // Not valid XML, try to convert to number or keep as string
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
                        const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
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
                        const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
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
                            current[part] = {};
                        }
                        current = current[part];
                    }
                }
            }
        }

        const options = {
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            allowBooleanAttributes: true,
            format: true
        };
        const builder = new XMLBuilder(options);
        return builder.build(result);
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
     * Apply specific block changes to an existing XML content
     * @param {string} existingXmlContent - The existing XML content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {string} Updated XML string with only the changed blocks applied
     */
    static applyBlockChanges(existingXmlContent, changedBlocks) {
        // Parse the existing content into blocks
        const existingBlocks = this.parseToBlocks(existingXmlContent);
        
        // Apply the changed blocks to the existing blocks
        for (const key in changedBlocks) {
            if (changedBlocks.hasOwnProperty(key)) {
                const changedBlock = changedBlocks[key];
                
                // Simply replace the existing block with the changed block
                // This ensures we use the actual value and type, not the original type
                existingBlocks[key] = changedBlock;
            }
        }
        
        // Convert back to XML
        return this.blocksToXml(existingBlocks);
    }

    /**
     * Apply only the specified changed blocks to a target XML structure
     * This method ensures that only the provided changed blocks are applied
     * and all other parts of the target structure remain unchanged
     * @param {string} targetXmlContent - The target XML content to update
     * @param {Object} changedBlocks - Only the blocks that should be changed
     * @returns {string} Updated XML string with only the specified changes applied
     */
    static applyOnlyChangedBlocks(targetXmlContent, changedBlocks) {
        // Handle empty content case
        let xmlContent = targetXmlContent;
        if (!xmlContent || xmlContent.trim() === '') {
            xmlContent = '<root></root>';
        }
        
        // Parse the target content into blocks to understand its current structure
        const targetBlocks = this.parseToBlocks(xmlContent);
        
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
        
        // Convert to XML
        return this.blocksToXml(targetBlocks);
    }

    /**
     * Enhanced version of applyBlockChanges that properly handles nested objects
     * when editing at different depths
     * @param {string} existingXmlContent - The existing XML content to update
     * @param {Object} changedBlocks - The blocks that have been changed
     * @returns {string} Updated XML string with only the changed blocks applied
     */
    static applyBlockChangesEnhanced(existingXmlContent, changedBlocks) {
        // Parse the existing content into blocks
        const existingBlocks = this.parseToBlocks(existingXmlContent);
        
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
                        const options = {
                            ignoreAttributes: false,
                            attributeNamePrefix: '@_',
                            textNodeName: '#text',
                            allowBooleanAttributes: true
                        };
                        const parser = new XMLParser(options);
                        const parsed = parser.parse(changedBlock.value);
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                            // Successfully parsed, update the value
                            changedBlock.value = parsed;
                            changedBlock.originalType = 'object';
                        }
                    } catch (e) {
                        // Not a valid XML, keep as string
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
        
        // Convert back to XML
        return this.blocksToXml(existingBlocks);
    }
}

module.exports = XmlBlockParser;