const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { FileTypeUtils } = require('../utils/fileTypeUtils');
const SyncDetector = require('../syncDetector');
const toml = require('toml');

// Keep track of open editors by file URI
const openEditors = new Map();

class BlockEditorHandler {
    static async openEditor(context, editor) {
        // Get the active text editor
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }

        // Check if it's a supported file type
        const document = editor.document;
        const validation = FileTypeUtils.validateFile(document.fileName);
        
        if (!validation.isValid) {
            vscode.window.showErrorMessage(`Active file is not a supported structured file! Supported types: ${FileTypeUtils.getSupportedExtensions().join(', ')}`);
            return;
        }
        
        // Check if an editor is already open for this file
        const fileUri = document.uri.toString();
        if (openEditors.has(fileUri)) {
            // Focus the existing editor
            const existingPanel = openEditors.get(fileUri);
            existingPanel.reveal(vscode.ViewColumn.One);
            vscode.window.showInformationMessage('Block editor for this file is already open');
            return;
        }

        try {
            let depthBlocks;
            
            // Get the appropriate parser
            const Parser = FileTypeUtils.getParser(validation.fileExtension);
            if (!Parser) {
                vscode.window.showErrorMessage(`Parser not found for file type: ${validation.fileExtension}`);
                return;
            }
            
            if (validation.fileExtension === '.json') {
                // Parse the JSON content
                const jsonContent = JSON.parse(document.getText());
                // Convert to blocks grouped by depth
                depthBlocks = Parser.parseToDepthBlocks(jsonContent);
            } else if (validation.fileExtension === '.toml') {
                // Parse the TOML content
                const tomlContent = document.getText();
                // Parse TOML string to object first, then convert to blocks grouped by depth
                const tomlObject = toml.parse(tomlContent);
                depthBlocks = Parser.parseToDepthBlocks(tomlObject);
            } else {
                // Parse the content
                const content = document.getText();
                // Convert to blocks grouped by depth
                depthBlocks = Parser.parseToDepthBlocks(content);
            }
            
            // Create and show a webview panel
            const panel = vscode.window.createWebviewPanel(
                'structuredBlockEditor', // Identifies the type of the webview. Used internally
                `${validation.typeName} Block Editor`, // Title of the panel displayed to the user
                vscode.ViewColumn.One, // Editor column to show the new webview panel in.
                {
                    // Enable scripts in the webview
                    enableScripts: true,
                    // Restrict the webview to only load resources from workspace and webview directory
                    localResourceRoots: [
                        vscode.Uri.joinPath(context.extensionUri, 'webview')
                    ],
                    // Enable retention of state when webview is hidden
                    retainContextWhenHidden: true
                }
            );
            
            // Store reference to the panel
            openEditors.set(fileUri, panel);
            
            // Remove the reference when the panel is disposed
            panel.onDidDispose(() => {
                openEditors.delete(fileUri);
            }, null, context.subscriptions);

            // Store the document's initial version
            let documentVersion = document.version;
            // Flag to track if changes are made internally by our extension
            let isInternalChange = false;
            // Timer for debouncing external change notifications
            let externalChangeTimer = null;
            // Flag to track if external change notification is already shown
            let isExternalChangeNotified = false;

            // Set up a listener for document changes
            const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document.uri.toString() === document.uri.toString()) {
                    // Document has changed, update the version
                    documentVersion = event.document.version;
                    
                    // Only notify the webview if changes are external (not made by our extension)
                    if (!isInternalChange) {
                        // Clear any existing timer
                        if (externalChangeTimer) {
                            clearTimeout(externalChangeTimer);
                        }
                        
                        // Set a new timer to debounce the notification
                        externalChangeTimer = setTimeout(() => {
                            // Only notify if we haven't already notified about this change
                            if (!isExternalChangeNotified) {
                                // Notify the webview that the document has changed
                                panel.webview.postMessage({
                                    command: 'documentChanged',
                                    version: documentVersion
                                });
                                // Mark that we've notified
                                isExternalChangeNotified = true;
                            }
                            externalChangeTimer = null;
                        }, 1000); // Wait 1 second after changes stop before notifying
                    } else {
                        // Reset the flag for next change
                        isInternalChange = false;
                        // Do NOT reset the notification flag here - it should only be reset when user interacts with notification
                    }
                }
            });

            // Set up a listener for when the document is saved
            const saveListener = vscode.workspace.onDidSaveTextDocument((savedDocument) => {
                if (savedDocument.uri.toString() === document.uri.toString()) {
                    // Reset the notification flag when the document is saved
                    // This allows notifications to appear again if the file is externally modified after saving
                    isExternalChangeNotified = false;
                }
            });

            // Set up a listener for when the panel is disposed
            panel.onDidDispose(() => {
                changeListener.dispose();
                saveListener.dispose();
                // Clear any pending external change timer
                if (externalChangeTimer) {
                    clearTimeout(externalChangeTimer);
                }
                // Remove from open editors map
                openEditors.delete(fileUri);
            }, null, context.subscriptions);

            // Get path to HTML file on disk
            const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'blockEditor.html');
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
            
            // Set the webview's html content
            const scriptContent = `
            <script>
            const vscode = acquireVsCodeApi();
            
            // Store the original blocks
            let originalBlocks = ${JSON.stringify(depthBlocks)};
            let currentBlocks = JSON.parse(JSON.stringify(originalBlocks));
            
            // Set initial depth to 1 (default selected depth)
            let maxDepth = 1;
            
            // Calculate the maximum depth from the actual data (for populating selectors)
            let actualMaxDepth = Math.max(...originalBlocks.map(block => block.depth), 1); // Default to 1 if no blocks
            let documentVersion = ${document.version}; // Track document version
            
            // Search state
            let searchResults = [];
            let currentSearchIndex = -1;
            
            // Newly added blocks tracking
            let newlyAddedBlocks = [];
            
            // Function to check if a key is a direct child of another key
            function isDirectChildKey(parentKey, childKey) {
                // Check if childKey starts with parentKey + '['
                if (!childKey.startsWith(parentKey + '[')) {
                    return false;
                }
                
                // Extract the part after parentKey
                const remainder = childKey.substring(parentKey.length);
                
                // Check if the remainder matches the pattern [number] or [number].property or [number][number]
                // but not [number]something (which would be a different key)
                const arrayIndexPattern = /^[\\d+]/;
                if (!arrayIndexPattern.test(remainder)) {
                    return false;
                }
                
                // Check that after the array index, we either have the end of string,
                // a dot followed by more characters, or another bracket followed by more characters
                const afterIndex = remainder.substring(remainder.indexOf(']') + 1);
                return afterIndex === '' || afterIndex.startsWith('.') || afterIndex.startsWith('[');
            }
            
            // Function to check if there are any changes and update save button state
            function updateSaveButtonState() {
                const saveBtn = document.getElementById('saveBtn');
                if (saveBtn) {
                    saveBtn.disabled = false; // Enable save button when there are changes
                }
            }
            
            // Function to reset save button to disabled state
            function resetSaveButtonState() {
                const saveBtn = document.getElementById('saveBtn');
                if (saveBtn) {
                    saveBtn.disabled = true; // Disable save button by default
                }
            }
            
            // Function to populate depth selector options
            function populateDepthSelector() {
                const depthSelector = document.getElementById('depthSelector');
                depthSelector.innerHTML = '';
                
                // Calculate the maximum depth from the actual data
                const maxDepthInFile = Math.max(...currentBlocks.map(block => block.depth), 1); // Default to 1 if no blocks
                
                // Create options from 0 to maxDepthInFile (no fixed minimum)
                for (let i = 0; i <= maxDepthInFile; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    if (i === 1) { // Default selected depth
                        option.selected = true;
                    }
                    depthSelector.appendChild(option);
                }
            }
            
            // Function to populate new block depth selector options
            function populateNewBlockDepthSelector() {
                const newBlockDepthSelector = document.getElementById('newBlockDepth');
                newBlockDepthSelector.innerHTML = '';
                
                // Calculate the maximum depth from the actual data
                const maxDepthInFile = Math.max(...currentBlocks.map(block => block.depth), 1); // Default to 1 if no blocks
                
                // Create options from 0 to maxDepthInFile (no fixed minimum)
                for (let i = 0; i <= maxDepthInFile; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    if (i === 0) {
                        option.textContent = i + ' (Top Level)';
                    } else {
                        option.textContent = 'Depth ' + i;
                    }
                    newBlockDepthSelector.appendChild(option);
                }
            }
            
            // Function to render blocks grouped by depth
            function renderBlocks() {
                const blockList = document.getElementById('blockList');
                blockList.innerHTML = '';
                
                // Get current depth from selector to avoid issues with maxDepth variable
                const currentDepth = parseInt(document.getElementById('depthSelector').value);
                // If NaN, default to 1 (but allow 0)
                const validCurrentDepth = isNaN(currentDepth) ? 1 : currentDepth;
                
                // Find all depth groups that match the selected depth
                const selectedDepthGroups = currentBlocks.filter(depthGroup => depthGroup.depth === validCurrentDepth);
                
                if (selectedDepthGroups.length > 0) {
                    // Create a container for all blocks at this depth
                    const allBlocksContainer = document.createElement('div');
                    allBlocksContainer.className = 'depth-group';
                    
                    const depthHeader = document.createElement('div');
                    depthHeader.className = 'depth-header';
                    const depthTitle = document.createElement('h3');
                    depthTitle.textContent = 'Depth Level ' + validCurrentDepth;
                    depthHeader.appendChild(depthTitle);
                    allBlocksContainer.appendChild(depthHeader);
                    
                    const blocksContainer = document.createElement('div');
                    blocksContainer.className = 'depth-blocks';
                    
                    // Iterate through all depth groups at the selected depth
                    selectedDepthGroups.forEach(selectedDepthGroup => {
                        // Add a header for this group if there's a prefix
                        if (selectedDepthGroup.prefix) {
                            const groupHeader = document.createElement('div');
                            groupHeader.className = 'group-prefix-header';
                            groupHeader.textContent = 'Group: ' + selectedDepthGroup.prefix;
                            blocksContainer.appendChild(groupHeader);
                        }
                        
                        // Add all blocks in this group
                        for (const [key, block] of Object.entries(selectedDepthGroup.blocks)) {
                            const blockItem = document.createElement('div');
                            blockItem.className = 'block-item';
                            blockItem.setAttribute('data-key', key); // Add data attribute for easier selection
                            
                            // Highlight block if it's part of search results
                            if (searchResults.length > 0) {
                                if (searchResults.includes(key)) {
                                    blockItem.classList.add('search-highlight');
                                    // If this is the current search result, add special class
                                    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex] === key) {
                                        blockItem.classList.add('current-search-result');
                                        // Note: We don't scroll here anymore, it's handled by scrollToCurrentResult function
                                    }
                                }
                            }
                            
                            // Highlight block if it's newly added
                            if (newlyAddedBlocks.includes(key)) {
                                blockItem.classList.add('newly-added');
                            }
                            
                            const blockHeader = document.createElement('div');
                            blockHeader.className = 'block-header';
                            
                            const blockKey = document.createElement('div');
                            blockKey.className = 'block-key';
                            blockKey.textContent = key;
                            blockHeader.appendChild(blockKey);
                            
                            const deleteBtn = document.createElement('button');
                            deleteBtn.className = 'delete-btn';
                            deleteBtn.innerHTML = '&#128465;'; deleteBtn.title = 'Delete'; // Unicode trash can symbol
                            deleteBtn.setAttribute('data-key', key);
                            deleteBtn.setAttribute('data-depth', selectedDepthGroup.depth);
                            blockHeader.appendChild(deleteBtn);
                            
                            blockItem.appendChild(blockHeader);
                            
                            const blockValueContainer = document.createElement('div');
                            blockValueContainer.className = 'block-value-container';
                            
                            if (block.editable) {
                                // Check if the value is an array or object to use textarea instead of input
                                const isComplexType = block.originalType === 'array' || block.originalType === 'object';
                                
                                if (isComplexType) {
                                    const textarea = document.createElement('textarea');
                                    textarea.className = 'block-value';
                                    // Format the value for better display
                                    if (typeof block.value === 'string' && 
                                        ((block.value.startsWith('[') && block.value.endsWith(']')) || 
                                         (block.value.startsWith('{') && block.value.endsWith('}')))) {
                                        try {
                                            // Pretty format JSON if it's a valid JSON string
                                            const parsed = JSON.parse(block.value);
                                            textarea.value = JSON.stringify(parsed, null, 2);
                                        } catch (e) {
                                            textarea.value = block.value;
                                        }
                                    } else {
                                        textarea.value = block.value;
                                    }
                                    textarea.setAttribute('readonly', 'readonly');
                                    textarea.setAttribute('data-key', key);
                                    textarea.setAttribute('data-depth', selectedDepthGroup.depth);
                                    // Set rows based on content
                                    const lineCount = textarea.value.split('\\n').length;
                                    textarea.rows = Math.min(Math.max(lineCount, 3), 15);
                                    blockValueContainer.appendChild(textarea);
                                } else {
                                    const input = document.createElement('input');
                                    input.type = 'text';
                                    input.className = 'block-value';
                                    // Use originalStringValue for display if available (to preserve .0 format)
                                    if (block.originalType === 'number' && Object.prototype.hasOwnProperty.call(block, 'originalStringValue')) {
                                        input.value = block.originalStringValue;
                                    } else {
                                        input.value = block.value;
                                    }
                                    input.setAttribute('readonly', 'readonly');
                                    input.setAttribute('data-key', key);
                                    input.setAttribute('data-depth', selectedDepthGroup.depth);
                                    blockValueContainer.appendChild(input);
                                }
                                
                                const editBtn = document.createElement('button');
                                editBtn.className = 'edit-toggle-btn';
                                editBtn.textContent = 'Edit';
                                editBtn.setAttribute('data-key', key);
                                editBtn.setAttribute('data-depth', selectedDepthGroup.depth);
                                blockValueContainer.appendChild(editBtn);
                            } else {
                                const valueDiv = document.createElement('div');
                                valueDiv.className = 'block-value-readonly';
                                valueDiv.textContent = block.value;
                                blockValueContainer.appendChild(valueDiv);
                            }
                            
                            blockItem.appendChild(blockValueContainer);
                            
                            const blockInfo = document.createElement('div');
                            blockInfo.className = 'block-info';
                            const small = document.createElement('small');
                            small.textContent = 'Depth: ' + block.depth;
                            blockInfo.appendChild(small);
                            blockItem.appendChild(blockInfo);
                            
                            blocksContainer.appendChild(blockItem);
                        }
                    });
                    
                    allBlocksContainer.appendChild(blocksContainer);
                    blockList.appendChild(allBlocksContainer);
                } else {
                    // Show message when no blocks are found at selected depth
                    const noBlocksMessage = document.createElement('div');
                    noBlocksMessage.textContent = 'No blocks found at depth level ' + validCurrentDepth;
                    noBlocksMessage.style.textAlign = 'center';
                    noBlocksMessage.style.padding = '20px';
                    noBlocksMessage.style.fontStyle = 'italic';
                    noBlocksMessage.style.color = 'var(--vscode-descriptionForeground)';
                    blockList.appendChild(noBlocksMessage);
                }
                
                // Add event listeners to delete buttons
                document.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const key = e.target.getAttribute('data-key');
                        const depthIndex = parseInt(e.target.getAttribute('data-depth'));
                        
                        console.log('=== DELETE OPERATION START ===');
                        console.log('Delete button clicked for key:', key, 'at depth:', depthIndex);
                        
                        // Find all blocks that are children of the deleted key (for object deletion)
                        const keysToDelete = [key]; // Always delete the main key
                        
                        console.log('Current blocks before finding children:', JSON.parse(JSON.stringify(currentBlocks)));
                        
                        // Check for child keys (keys that start with this key) across ALL depths, not just current
                        currentBlocks.forEach(depthGroup => {
                            for (const blockKey in depthGroup.blocks) {
                                // Handle both regular object properties and array elements
                                // For arrays, we need to match patterns like orders[0].items[0].specs.color
                                // But be precise to avoid matching the parent array itself
                                if (blockKey !== key && 
                                    (blockKey.startsWith(key + '.') || 
                                     (blockKey.startsWith(key + '[') && isDirectChildKey(key, blockKey)))) {
                                    if (!keysToDelete.includes(blockKey)) {
                                        keysToDelete.push(blockKey);
                                        console.log('Found child key to delete:', blockKey);
                                    }
                                }
                            }
                        });
                        
                        console.log('Keys to delete (before sorting):', keysToDelete);
                        
                        // Sort keys to delete in a proper order (children first, then parents)
                        keysToDelete.sort((a, b) => {
                            // Longer keys (more nested) should be deleted first
                            return b.length - a.length;
                        });
                        
                        console.log('Keys to delete (sorted):', keysToDelete);
                        
                        // Delete all related keys across ALL depths
                        let deleted = false;
                        keysToDelete.forEach(keyToDelete => {
                            // Delete from ALL depth groups where this key might exist
                            let found = false;
                            currentBlocks.forEach(depthGroup => {
                                if (Object.prototype.hasOwnProperty.call(depthGroup.blocks, keyToDelete)) {
                                    console.log('Deleting key from currentBlocks at depth', depthGroup.depth, ':', keyToDelete);
                                    delete depthGroup.blocks[keyToDelete];
                                    deleted = true;
                                    found = true;
                                }
                            });
                            
                            if (!found) {
                                console.log('Key not found in any depth group (may be already deleted):', keyToDelete);
                            }
                        });
                        
                        if (deleted) {
                            console.log('Current blocks after deletion:', JSON.parse(JSON.stringify(currentBlocks)));
                            renderBlocks();
                            // Enable save button when block is deleted
                            updateSaveButtonState();
                            
                            // Show save changes notification
                            showSaveChangesNotification();
                            console.log('=== DELETE OPERATION END ===');
                        }
                    });
                });
                
                // Add event listeners to edit toggle buttons
                document.querySelectorAll('.edit-toggle-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const key = e.target.getAttribute('data-key');
                        const depthIndex = parseInt(e.target.getAttribute('data-depth'));
                        const input = e.target.parentElement.querySelector('.block-value');
                        
                        if (input.hasAttribute('readonly')) {
                            // Store the original value before editing
                            input.setAttribute('data-original-value', input.value);
                            input.removeAttribute('readonly');
                            input.focus();
                            e.target.textContent = 'Apply';
                            
                            // Create and add a cancel button
                            const cancelBtn = document.createElement('button');
                            cancelBtn.className = 'cancel-edit-btn';
                            cancelBtn.textContent = 'Cancel';
                            cancelBtn.setAttribute('data-key', key);
                            cancelBtn.setAttribute('data-depth', depthIndex);
                            cancelBtn.style.marginLeft = '5px';
                            e.target.parentNode.appendChild(cancelBtn);
                            
                            // Add event listener to cancel button
                            cancelBtn.addEventListener('click', (cancelEvent) => {
                                const key = cancelEvent.target.getAttribute('data-key');
                                const depthIndex = parseInt(cancelEvent.target.getAttribute('data-depth'));
                                const container = cancelEvent.target.parentElement;
                                const input = container.querySelector('.block-value');
                                const editBtn = container.querySelector('.edit-toggle-btn');
                                
                                // Restore original value
                                input.value = input.getAttribute('data-original-value');
                                
                                // Switch back to readonly mode
                                input.setAttribute('readonly', 'readonly');
                                
                                // Update the display value in our data structure
                                const depthGroup = currentBlocks.find(dg => 
                                    dg.depth === depthIndex && Object.prototype.hasOwnProperty.call(dg.blocks, key));
                                if (depthGroup) {
                                    depthGroup.blocks[key].value = input.value;
                                }
                                
                                // Remove cancel button and update edit button text
                                cancelEvent.target.remove();
                                if (editBtn) {
                                    editBtn.textContent = 'Edit';
                                }
                                
                                // Reset save button state
                                resetSaveButtonState();
                                
                                // Remove save notification if no other fields are being edited
                                if (document.querySelectorAll('.cancel-edit-btn').length === 0) {
                                    const saveNotification = document.getElementById('saveChangesNotification');
                                    if (saveNotification) {
                                        saveNotification.remove();
                                    }
                                }
                            });
                        } else {
                            input.setAttribute('readonly', 'readonly');
                            // Update the value in our data structure
                            const depthGroup = currentBlocks.find(dg => 
                                dg.depth === depthIndex && Object.prototype.hasOwnProperty.call(dg.blocks, key));
                            if (depthGroup && depthGroup.blocks[key]) {
                                // Handle different data types properly - keep the object structure
                                // but update the value property with the correct type
                                if (depthGroup.blocks[key].originalType === 'number') {
                                    const numValue = Number(input.value);
                                    depthGroup.blocks[key].value = !isNaN(numValue) ? numValue : input.value;
                                    // Update the originalStringValue to preserve format
                                    if (!isNaN(numValue)) {
                                        depthGroup.blocks[key].originalStringValue = input.value;
                                    }
                                    // Update the originalType if it's not a number anymore
                                    if (isNaN(numValue)) {
                                        if (input.value === 'true' || input.value === 'false') {
                                            depthGroup.blocks[key].originalType = 'boolean';
                                        } else {
                                            depthGroup.blocks[key].originalType = 'string';
                                        }
                                    }
                                } else if (depthGroup.blocks[key].originalType === 'boolean') {
                                    if (input.value === 'true') {
                                        depthGroup.blocks[key].value = true;
                                        // Update the originalType to reflect the new type
                                        depthGroup.blocks[key].originalType = 'boolean';
                                    } else if (input.value === 'false') {
                                        depthGroup.blocks[key].value = false;
                                        // Update the originalType to reflect the new type
                                        depthGroup.blocks[key].originalType = 'boolean';
                                    } else {
                                        depthGroup.blocks[key].value = input.value;
                                        // Check if it's actually a number
                                        if (!isNaN(Number(input.value)) && input.value.trim() !== '') {
                                            depthGroup.blocks[key].originalType = 'number';
                                            // Store the original string value for format preservation
                                            depthGroup.blocks[key].originalStringValue = input.value;
                                        } else {
                                            // Keep as string
                                            depthGroup.blocks[key].originalType = 'string';
                                        }
                                    }
                                } else if (depthGroup.blocks[key].originalType === 'string') {
                                    // For strings, keep the actual value but update type if needed
                                    depthGroup.blocks[key].value = input.value;
                                    // Check if it should be a different type
                                    if (input.value === 'true') {
                                        depthGroup.blocks[key].originalType = 'boolean';
                                    } else if (input.value === 'false') {
                                        depthGroup.blocks[key].originalType = 'boolean';
                                    } else if (!isNaN(Number(input.value)) && input.value.trim() !== '') {
                                        depthGroup.blocks[key].originalType = 'number';
                                        // Store the original string value for format preservation
                                        depthGroup.blocks[key].originalStringValue = input.value;
                                    } else {
                                        // Check if it's a JSON object or array
                                        try {
                                            const parsed = JSON.parse(input.value);
                                            if (typeof parsed === 'object' && parsed !== null) {
                                                depthGroup.blocks[key].originalType = Array.isArray(parsed) ? 'array' : 'object';
                                            } else {
                                                // Keep as string
                                                depthGroup.blocks[key].originalType = 'string';
                                            }
                                        } catch (e) {
                                            // Keep as string
                                            depthGroup.blocks[key].originalType = 'string';
                                        }
                                    }
                                } else {
                                    // For other types, use as is
                                    depthGroup.blocks[key].value = input.value;
                                }
                            }
                            
                            // Remove any existing cancel button
                            const cancelBtn = e.target.parentElement.querySelector('.cancel-edit-btn');
                            if (cancelBtn) {
                                cancelBtn.remove();
                            }
                            
                            e.target.textContent = 'Edit';
                            
                            // Enable save button when user saves changes
                            updateSaveButtonState();
                            
                            // Show a notification to save changes
                            showSaveChangesNotification();
                        }
                    });
                });
                
                // Add event listeners to value inputs and textareas
                document.querySelectorAll('.block-value').forEach(input => {
                    input.addEventListener('input', (e) => {
                        const key = e.target.getAttribute('data-key');
                        const depthIndex = parseInt(e.target.getAttribute('data-depth'));
                        const depthGroup = currentBlocks.find(dg => 
                            dg.depth === depthIndex && Object.prototype.hasOwnProperty.call(dg.blocks, key));
                        if (depthGroup && depthGroup.blocks[key]) {
                            // Handle different data types properly - keep the object structure
                            // but update the value property with the correct type
                            if (depthGroup.blocks[key].originalType === 'number') {
                                const numValue = Number(e.target.value);
                                depthGroup.blocks[key].value = !isNaN(numValue) ? numValue : e.target.value;
                                // Update the originalStringValue to preserve format
                                if (!isNaN(numValue)) {
                                    depthGroup.blocks[key].originalStringValue = e.target.value;
                                }
                                // Update the originalType if it's not a number anymore
                                if (isNaN(numValue)) {
                                    if (e.target.value === 'true' || e.target.value === 'false') {
                                        depthGroup.blocks[key].originalType = 'boolean';
                                    } else {
                                        depthGroup.blocks[key].originalType = 'string';
                                    }
                                }
                            } else if (depthGroup.blocks[key].originalType === 'boolean') {
                                if (e.target.value === 'true') {
                                    depthGroup.blocks[key].value = true;
                                    // Update the originalType to reflect the new type
                                    depthGroup.blocks[key].originalType = 'boolean';
                                } else if (e.target.value === 'false') {
                                    depthGroup.blocks[key].value = false;
                                    // Update the originalType to reflect the new type
                                    depthGroup.blocks[key].originalType = 'boolean';
                                } else {
                                    depthGroup.blocks[key].value = e.target.value;
                                    // Check if it's actually a number
                                    if (!isNaN(Number(e.target.value)) && e.target.value.trim() !== '') {
                                        depthGroup.blocks[key].originalType = 'number';
                                        // Store the original string value for format preservation
                                        depthGroup.blocks[key].originalStringValue = e.target.value;
                                    } else {
                                        // Keep as string
                                        depthGroup.blocks[key].originalType = 'string';
                                    }
                                }
                            } else if (depthGroup.blocks[key].originalType === 'string') {
                                // For strings, keep the actual value but update type if needed
                                depthGroup.blocks[key].value = e.target.value;
                                // Check if it should be a different type
                                if (e.target.value === 'true') {
                                    depthGroup.blocks[key].originalType = 'boolean';
                                } else if (e.target.value === 'false') {
                                    depthGroup.blocks[key].originalType = 'boolean';
                                } else if (!isNaN(Number(e.target.value)) && e.target.value.trim() !== '') {
                                    depthGroup.blocks[key].originalType = 'number';
                                    // Store the original string value for format preservation
                                    depthGroup.blocks[key].originalStringValue = e.target.value;
                                } else {
                                    // Check if it's a JSON object or array
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        if (typeof parsed === 'object' && parsed !== null) {
                                            depthGroup.blocks[key].originalType = Array.isArray(parsed) ? 'array' : 'object';
                                        } else {
                                            // Keep as string
                                            depthGroup.blocks[key].originalType = 'string';
                                        }
                                    } catch (e) {
                                        // Keep as string
                                        depthGroup.blocks[key].originalType = 'string';
                                    }
                                }
                            } else {
                                // For other types, use as is
                                depthGroup.blocks[key].value = e.target.value;
                            }
                        }
                                    
                        // Enable save button when user makes changes
                        updateSaveButtonState();
                    });
                });
            }
            
            // Initial render
            populateDepthSelector();
            populateNewBlockDepthSelector();
            renderBlocks();
            // Disable save button by default
            resetSaveButtonState();
            
            // Handle Add Block button
            document.getElementById('addBlockBtn').addEventListener('click', () => {
                document.getElementById('newBlockForm').classList.remove('hidden');
                // Populate the new block depth selector
                populateNewBlockDepthSelector();
                // Set the depth selector to match the current view depth
                const currentDepth = parseInt(document.getElementById('depthSelector').value);
                // If NaN, default to 1 (but allow 0)
                const validCurrentDepth = isNaN(currentDepth) ? 1 : currentDepth;
                document.getElementById('newBlockDepth').value = validCurrentDepth;
            });
            
            // Handle Cancel Add button
            document.getElementById('cancelAddBtn').addEventListener('click', () => {
                document.getElementById('newBlockForm').classList.add('hidden');
                document.getElementById('newBlockKey').value = '';
                document.getElementById('newBlockValue').value = '';
                document.getElementById('newBlockDepth').value = '0';
            });
            
            // Handle Confirm Add button
            document.getElementById('confirmAddBtn').addEventListener('click', () => {
                const key = document.getElementById('newBlockKey').value.trim();
                const value = document.getElementById('newBlockValue').value;
                const depth = parseInt(document.getElementById('newBlockDepth').value);
                
                if (key) {
                    // Determine the prefix for grouping
                    let prefix = '';
                    const parts = key.split('.');
                    if (parts.length > 1) {
                        // Use all parts except the last one as the prefix
                        prefix = parts.slice(0, parts.length - 1).join('.');
                    }
                    
                    // Add to selected depth level with proper grouping
                    let depthGroup = currentBlocks.find(dg => dg.depth === depth && dg.prefix === prefix);
                    if (!depthGroup) {
                        depthGroup = { depth: depth, prefix: prefix, blocks: {} };
                        currentBlocks.push(depthGroup);
                    }
                    
                    // Determine the type of the value
                    let actualValue = value;
                    let originalType = 'string';
                    
                    // Try to parse as JSON to determine type
                    try {
                        const parsed = JSON.parse(value);
                        actualValue = parsed;
                        originalType = typeof parsed;
                    } catch (e) {
                        // If it's not valid JSON, check if it's a number
                        if (!isNaN(Number(value)) && value.trim() !== '') {
                            actualValue = Number(value);
                            originalType = 'number';
                        } else if (value === 'true' || value === 'false') {
                            actualValue = value === 'true';
                            originalType = 'boolean';
                        }
                    }
                    
                    // Format value for display
                    let displayValue = actualValue;
                    if (originalType === 'string') {
                        displayValue = '"' + actualValue + '"';
                    }
                    
                    depthGroup.blocks[key] = {
                        value: displayValue,
                        type: typeof actualValue,
                        depth: depth,
                        key: key,
                        editable: true,
                        originalType: originalType
                    };
                    
                    // Track newly added block
                    newlyAddedBlocks.push(key);
                    
                    renderBlocks();
                    // Enable save button when new block is added
                    updateSaveButtonState();
                    document.getElementById('newBlockForm').classList.add('hidden');
                    document.getElementById('newBlockKey').value = '';
                    document.getElementById('newBlockValue').value = '';
                    document.getElementById('newBlockDepth').value = '0';
                    
                    // Show save changes notification
                    showSaveChangesNotification();
                } else {
                    alert('Please enter a valid key!');
                }
            });
            
            // Handle depth selection change
            document.getElementById('depthSelector').addEventListener('change', (e) => {
                // We no longer use maxDepth variable to avoid scoping issues
                // The depth is now always retrieved directly from the selector when needed
                // Clear search results when switching depth
                clearSearch();
                renderBlocks();
            });
            
            // Handle search button
            document.getElementById('searchBtn').addEventListener('click', performSearch);
            
            // Handle clear search button
            document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
            
            // Handle Enter key in search input
            document.getElementById('searchInput').addEventListener('keyup', (e) => {
                // Sync with floating search input
                document.getElementById('floatingSearchInput').value = e.target.value;
                
                if (e.key === 'Enter') {
                    // If we already have search results, navigate to next result
                    if (searchResults.length > 0) {
                        nextSearchResult();
                    } else {
                        // Otherwise, perform a new search
                        performSearch();
                    }
                }
            });
            
            // Arrow key navigation is handled by the global keydown listener
            // No need for input-specific listener to avoid double navigation calls
            
            // Clear search when the search input is emptied
            document.getElementById('searchInput').addEventListener('input', (e) => {
                // Sync with floating search input
                document.getElementById('floatingSearchInput').value = e.target.value;
                
                if (e.target.value.trim() === '') {
                    clearSearch();
                }
            });
            
            // Handle Save button
            document.getElementById('saveBtn').addEventListener('click', () => {
                // Remove any save notifications
                const saveNotification = document.getElementById('saveChangesNotification');
                if (saveNotification) {
                    saveNotification.remove();
                }
                
                console.log('=== SAVE OPERATION START ===');
                console.log('Save button clicked');
                console.log('Current blocks structure:', JSON.parse(JSON.stringify(currentBlocks)));
                // Get current depth from selector to avoid issues with maxDepth variable
                const currentDepth = parseInt(document.getElementById('depthSelector').value);
                // If NaN, default to 1 (but allow 0)
                const validCurrentDepth = isNaN(currentDepth) ? 1 : currentDepth;
                
                console.log('Current depth:', validCurrentDepth);
                
                // Flatten blocks for saving - only include blocks from the currently selected depth
                const flattenedBlocks = {};
                // Filter to only include blocks from the currently selected depth
                const selectedDepthGroups = currentBlocks.filter(depthGroup => depthGroup.depth === validCurrentDepth);
                selectedDepthGroups.forEach(depthGroup => {
                    console.log('Processing depth group:', JSON.parse(JSON.stringify(depthGroup)));
                    for (const [key, block] of Object.entries(depthGroup.blocks)) {
                        console.log('Processing block key:', key, 'value:', JSON.parse(JSON.stringify(block)));
                        // Pass the entire block object to preserve type information
                        flattenedBlocks[key] = {
                            value: block.value,
                            type: block.type,
                            depth: block.depth,
                            key: block.key,
                            editable: block.editable,
                            originalType: block.originalType
                        };
                    }
                });
                
                console.log('Flattened blocks for current depth:', JSON.parse(JSON.stringify(flattenedBlocks)));
                
                // Create a list of deleted keys by comparing with originalBlocks across all depths
                const deletedKeys = [];
                if (originalBlocks) {
                    console.log('Original blocks:', JSON.parse(JSON.stringify(originalBlocks)));
                    
                    // Collect ALL original keys across ALL depths
                    const originalKeys = [];
                    originalBlocks.forEach(depthGroup => {
                        for (const [key, block] of Object.entries(depthGroup.blocks)) {
                            originalKeys.push(key);
                        }
                    });
                    
                    console.log('All original keys:', originalKeys);
                    
                    // Collect ALL current keys across ALL depths
                    const currentKeys = [];
                    currentBlocks.forEach(depthGroup => {
                        for (const [key, block] of Object.entries(depthGroup.blocks)) {
                            currentKeys.push(key);
                        }
                    });
                    
                    console.log('All current keys:', currentKeys);
                    
                    // Find deleted keys (in original but not in current)
                    originalKeys.forEach(key => {
                        if (!currentKeys.includes(key)) {
                            deletedKeys.push(key);
                            console.log('Added deleted key:', key);
                        }
                    });
                }
                
                console.log('Final deletedKeys list:', deletedKeys);
                
                // Clear newly added blocks tracking on save
                newlyAddedBlocks = [];
                
                console.log('Sending save message with blocks:', JSON.parse(JSON.stringify(flattenedBlocks)));
                console.log('Sending save message with deletedKeys:', deletedKeys);
                console.log('=== SAVE OPERATION END ===');
                
                vscode.postMessage({
                    command: 'save',
                    blocks: flattenedBlocks,
                    deletedKeys: deletedKeys,
                    originalBlocks: originalBlocks,
                    currentDepth: validCurrentDepth
                });
                
                // Disable save button after sending save message
                resetSaveButtonState();
            });
            
            // Handle Reload button
            document.getElementById('reloadBtn').addEventListener('click', () => {
                // Get current depth from selector to preserve it during reload
                const currentDepth = parseInt(document.getElementById('depthSelector').value);
                // If NaN, default to 1 (but allow 0)
                const validCurrentDepth = isNaN(currentDepth) ? 1 : currentDepth;
                
                vscode.postMessage({
                    command: 'reload',
                    currentDepth: validCurrentDepth
                });
                
                // Disable save button when reloading
                resetSaveButtonState();
            });
            
            // Handle Depth Selector
            document.getElementById('depthSelector').addEventListener('change', (event) => {
                const newDepth = parseInt(event.target.value);
                // If NaN, default to 1 (but allow 0)
                const validNewDepth = isNaN(newDepth) ? 1 : newDepth;
                vscode.postMessage({
                    command: 'changeDepth',
                    newDepth: validNewDepth
                });
            });
            
            // Handle Open Source File button
            document.getElementById('openSourceBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'openSource'
                });
            });
            
            // Handle messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'update':
                        console.log('Received update message with blocks:', message.blocks);
                        try {
                            // When we receive updated blocks, we need to reorganize them into the proper grouped structure
                            const updatedBlocks = JSON.parse(JSON.stringify(message.blocks));
                            currentBlocks = [];
                            
                            // Group blocks by depth and prefix
                            const groupedBlocks = {};
                            
                            // First, group by depth and prefix
                            for (const [key, block] of Object.entries(updatedBlocks)) {
                                const depth = block.depth;
                                // Determine prefix from key
                                let prefix = '';
                                const parts = key.split('.');
                                if (parts.length > 1) {
                                    prefix = parts.slice(0, parts.length - 1).join('.');
                                }
                                
                                const groupKey = depth + '-' + prefix;
                                if (!groupedBlocks[groupKey]) {
                                    groupedBlocks[groupKey] = {
                                        depth: depth,
                                        prefix: prefix,
                                        blocks: {}
                                    };
                                }
                                groupedBlocks[groupKey].blocks[key] = block;
                            }
                            
                            // Convert to array format
                            for (const groupKey in groupedBlocks) {
                                currentBlocks.push(groupedBlocks[groupKey]);
                            }
                            
                            // Also update originalBlocks to match currentBlocks after a successful save
                            originalBlocks = JSON.parse(JSON.stringify(currentBlocks));
                            
                            populateDepthSelector();
                            populateNewBlockDepthSelector();
                            
                            // Restore the depth if provided, otherwise reset to depth 1
                            const depthSelectorElem = document.getElementById('depthSelector');
                            if (depthSelectorElem && message.currentDepth !== undefined && message.currentDepth !== null) {
                                // Set to the preserved depth
                                depthSelectorElem.value = message.currentDepth;
                                // Dispatch change event to ensure UI updates properly
                                const changeEvent = new Event('change', { bubbles: true });
                                depthSelectorElem.dispatchEvent(changeEvent);
                            } else if (depthSelectorElem) {
                                // Default to depth 1
                                depthSelectorElem.value = 1;
                                // Dispatch change event to ensure UI updates properly
                                const changeEvent = new Event('change', { bubbles: true });
                                depthSelectorElem.dispatchEvent(changeEvent);
                            }
                            
                            // Use setTimeout to defer the renderBlocks call to avoid scoping issues
                            setTimeout(() => {
                                renderBlocks();
                                // Disable save button after successful update
                                resetSaveButtonState();
                            }, 0);
                        } catch (error) {
                            console.error('Error processing update message:', error);
                        }
                        break;
                    case 'documentChanged':
                        // Show a notification that the document has been modified. Would you like to reload the latest content?
                        // But only show if there's no existing notification
                        const existingNotification = document.getElementById('documentChangedNotification');
                        if (existingNotification) {
                            // Notification already exists, don't show another one
                            break;
                        }
                        
                        const notification = document.createElement('div');
                        notification.id = 'documentChangedNotification';
                        notification.className = 'document-changed-notification';
                        notification.innerHTML = '' +
                            '<div class="notification-content">' +
                            '<span>Source file has been modified. Would you like to reload the latest content?</span>' +
                            '<button id="reloadBtnNotification" class="reload-btn-notification">Reload</button>' +
                            '<button id="dismissBtn" class="dismiss-btn">Dismiss</button>' +
                            '</div>';
                        
                        // Add to the top of the document
                        const header = document.querySelector('.header');
                        if (header) {
                            header.parentNode.insertBefore(notification, header.nextSibling);
                            
                            // Add event listeners
                            document.getElementById('reloadBtnNotification').addEventListener('click', () => {
                                // Get current depth from selector to preserve it during reload
                                const currentDepth = parseInt(document.getElementById('depthSelector').value);
                                // If NaN, default to 1 (but allow 0)
                                const validCurrentDepth = isNaN(currentDepth) ? 1 : currentDepth;
                                
                                vscode.postMessage({
                                    command: 'reload',
                                    currentDepth: validCurrentDepth
                                });
                                if (notification && notification.parentNode) {
                                    notification.parentNode.removeChild(notification);
                                }
                                // Reset the notification flag when user explicitly interacts with notification
                                isExternalChangeNotified = false;
                            });
                            
                            document.getElementById('dismissBtn').addEventListener('click', () => {
                                vscode.postMessage({
                                    command: 'dismissNotification'
                                });
                                if (notification && notification.parentNode) {
                                    notification.parentNode.removeChild(notification);
                                }
                                // Reset the notification flag when user explicitly interacts with notification
                                isExternalChangeNotified = false;
                            });
                        }
                        break;
                }
            });
            
            // Function to perform search
            function performSearch() {
                const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
                const searchResultsElement = document.getElementById('searchResults');
                
                if (!searchTerm) {
                    searchResults = [];
                    currentSearchIndex = -1;
                    searchResultsElement.textContent = '';
                    hideSearchNavigationBar();
                    renderBlocks();
                    // Update floating search results
                    const floatingSearchResults = document.getElementById('floatingSearchResults');
                    floatingSearchResults.textContent = '';
                    return;
                }
                
                // Get current depth from selector to avoid issues with maxDepth variable
                const currentDepth = parseInt(document.getElementById('depthSelector').value);
                // If NaN, default to 1 (but allow 0)
                const validCurrentDepth = isNaN(currentDepth) ? 1 : currentDepth;
                
                // Find all matching blocks only within the current depth level
                searchResults = [];
                const currentDepthGroups = currentBlocks.filter(depthGroup => depthGroup.depth === validCurrentDepth);
                
                if (currentDepthGroups.length > 0) {
                    currentDepthGroups.forEach(depthGroup => {
                        for (const key in depthGroup.blocks) {
                            if (key.toLowerCase().includes(searchTerm)) {
                                searchResults.push(key);
                            }
                        }
                    });
                }
                
                if (searchResults.length > 0) {
                    currentSearchIndex = 0; // Automatically navigate to the first result
                    searchResultsElement.textContent = 'Result ' + (currentSearchIndex + 1) + ' of ' + searchResults.length + ' (Use bottom bar to navigate)';
                    searchResultsElement.className = '';
                    showSearchNavigationBar();
                    updateSearchNavigationCounter();
                    renderBlocks();
                    scrollToCurrentResult(); // Scroll to the first result
                    
                    // Update floating search results
                    const floatingSearchResults = document.getElementById('floatingSearchResults');
                    floatingSearchResults.textContent = searchResultsElement.textContent;
                    floatingSearchResults.className = '';
                } else {
                    currentSearchIndex = -1;
                    searchResultsElement.textContent = 'No matching blocks found at depth ' + validCurrentDepth + '.';
                    searchResultsElement.className = 'no-search-results'; // Add the highlight class
                    hideSearchNavigationBar();
                    renderBlocks();
                    
                    // Update floating search results
                    const floatingSearchResults = document.getElementById('floatingSearchResults');
                    floatingSearchResults.textContent = searchResultsElement.textContent;
                    floatingSearchResults.className = 'no-search-results'; // Add the highlight class
                }
            }
            
            // Function to navigate to next search result
            function nextSearchResult() {
                if (searchResults.length === 0) return;
                
                currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
                updateSearchNavigationCounter();
                updateSearchResultsText();
                renderBlocks();
                scrollToCurrentResult();
            }
            
            // Function to navigate to previous search result
            function previousSearchResult() {
                if (searchResults.length === 0) return;
                
                currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
                updateSearchNavigationCounter();
                updateSearchResultsText();
                renderBlocks();
                scrollToCurrentResult();
            }
            
            // Function to scroll to the current search result
            function scrollToCurrentResult() {
                if (searchResults.length > 0 && currentSearchIndex >= 0) {
                    const currentKey = searchResults[currentSearchIndex];
                    const blockItem = document.querySelector(\`.block-item[data-key="\${currentKey}"]\`);
                    if (blockItem) {
                        blockItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
            
            // Function to update search navigation counter
            function updateSearchNavigationCounter() {
                if (searchResults.length > 0) {
                    document.getElementById('currentResultIndex').textContent = currentSearchIndex + 1;
                    document.getElementById('totalResults').textContent = searchResults.length;
                }
            }
            
            // Function to update search results text
            function updateSearchResultsText() {
                if (searchResults.length > 0) {
                    const text = 'Result ' + (currentSearchIndex + 1) + ' of ' + searchResults.length + ' (Use bottom bar to navigate)';
                    document.getElementById('searchResults').textContent = text;
                    // Also update floating search results
                    const floatingSearchResults = document.getElementById('floatingSearchResults');
                    floatingSearchResults.textContent = text;
                }
            }
            
            // Function to show search navigation bar
            function showSearchNavigationBar() {
                const searchBar = document.getElementById('searchNavigationBar');
                searchBar.style.display = 'flex';
            }
            
            // Function to hide search navigation bar
            function hideSearchNavigationBar() {
                const searchBar = document.getElementById('searchNavigationBar');
                searchBar.style.display = 'none';
            }
            
            // Function to show scroll to top button
            function showScrollToTopButton() {
                const scrollToTopBtn = document.getElementById('scrollToTopBtn');
                scrollToTopBtn.style.display = 'flex';
            }
            
            // Function to hide scroll to top button
            function hideScrollToTopButton() {
                const scrollToTopBtn = document.getElementById('scrollToTopBtn');
                scrollToTopBtn.classList.remove('visible');
                scrollToTopBtn.style.display = 'none';
            }
            
            // Function to show save changes notification
            function showSaveChangesNotification() {
                // Check if notification already exists
                if (document.getElementById('saveChangesNotification')) {
                    return;
                }
                
                const notification = document.createElement('div');
                notification.id = 'saveChangesNotification';
                notification.className = 'document-changed-notification-bottom-right';
                notification.innerHTML = '' +
                    '<div class="notification-content">' +
                    '<span>Change made. Save to file.</span>' +
                    '<button id="saveChangesBtnNotification" class="reload-btn-notification">Save Changes</button>' +
                    '<button id="dismissSaveNotification" class="dismiss-btn">Dismiss</button>' +
                    '</div>';
                
                // Add to the bottom right of the document
                document.body.appendChild(notification);
                
                // Add event listeners
                document.getElementById('saveChangesBtnNotification').addEventListener('click', () => {
                    // Click the main save button
                    document.getElementById('saveBtn').click();
                    if (notification && notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                });
                
                document.getElementById('dismissSaveNotification').addEventListener('click', () => {
                    if (notification && notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                });
            }
            
            // Function to scroll to top of the page
            function scrollToTop() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // Function to clear search
            function clearSearch() {
                document.getElementById('searchInput').value = '';
                document.getElementById('floatingSearchInput').value = '';
                searchResults = [];
                currentSearchIndex = -1;
                const searchResultsElement = document.getElementById('searchResults');
                searchResultsElement.textContent = '';
                searchResultsElement.className = ''; // Remove any classes
                hideSearchNavigationBar();
                renderBlocks();
                
                // Update floating search results
                const floatingSearchResults = document.getElementById('floatingSearchResults');
                floatingSearchResults.textContent = '';
                floatingSearchResults.className = ''; // Remove any classes
            }
            
            // Handle next result button
            document.getElementById('nextResultBtn').addEventListener('click', nextSearchResult);
            
            // Handle previous result button
            document.getElementById('prevResultBtn').addEventListener('click', previousSearchResult);
            
            // Handle close search navigation button
            document.getElementById('closeSearchNavBtn').addEventListener('click', clearSearch);
            
            // Handle scroll to top button
            document.getElementById('scrollToTopBtn').addEventListener('click', scrollToTop);
            
            // Handle window scroll to show/hide scroll to top button with progress indicator
            window.addEventListener('scroll', function() {
                const scrollToTopBtn = document.getElementById('scrollToTopBtn');
                const progressCircle = document.querySelector('.scroll-progress circle');
                
                // Calculate scroll percentage
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrollPercent = (scrollTop / scrollHeight) * 100;
                const safeScrollPercent = isNaN(scrollPercent) ? 0 : scrollPercent;
                
                // Update progress circle if it exists
                if (progressCircle) {
                    const circumference = 2 * Math.PI * 19; // 2 * π * radius
                    const offset = circumference - (safeScrollPercent / 100) * circumference;
                    progressCircle.style.strokeDashoffset = offset;
                }
                
                // Show/hide button with animation
                if (window.scrollY > 300) {
                    // Show button when scrolled down 300px
                    scrollToTopBtn.classList.add('visible');
                    scrollToTopBtn.style.display = 'flex';
                } else {
                    // Hide button when near the top
                    scrollToTopBtn.classList.remove('visible');
                }
                
                // Handle floating search box
                handleFloatingSearchBox();
            });
            
            // Hide scroll to top button initially
            hideScrollToTopButton();
            
            // Initialize progress circle
            const progressCircle = document.querySelector('.scroll-progress circle');
            if (progressCircle) {
                const circumference = 2 * Math.PI * 19; // 2 * π * radius
                progressCircle.style.strokeDasharray = circumference + ' ' + circumference;
                progressCircle.style.strokeDashoffset = circumference;
            }
            
            // Handle keyboard navigation (Enter, Shift+Enter, and arrow keys)
            document.addEventListener('keydown', (e) => {
                // Only handle if search results exist
                if (searchResults.length > 0) {
                    // For arrow keys, allow navigation even from input fields
                    if (e.key === 'ArrowDown') {
                        nextSearchResult();
                        e.preventDefault();
                    } else if (e.key === 'ArrowUp') {
                        previousSearchResult();
                        e.preventDefault();
                    } 
                    // For Enter keys, only handle when not in input fields
                    else if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            nextSearchResult();
                            e.preventDefault();
                        } else if (e.key === 'Enter' && e.shiftKey) {
                            previousSearchResult();
                            e.preventDefault();
                        }
                    }
                }
            });
            
            // Handle floating search box visibility
            function handleFloatingSearchBox() {
                const header = document.querySelector('.header');
                const floatingSearchContainer = document.getElementById('floatingSearchContainer');
                const headerRect = header.getBoundingClientRect();
                
                // If the header is not visible (scrolled out of view)
                if (headerRect.bottom < 0) {
                    floatingSearchContainer.style.display = 'flex';
                    // Sync the search input value
                    const searchInput = document.getElementById('searchInput');
                    const floatingSearchInput = document.getElementById('floatingSearchInput');
                    floatingSearchInput.value = searchInput.value;
                    
                    // Sync the search results text
                    const searchResultsElement = document.getElementById('searchResults');
                    const floatingSearchResults = document.getElementById('floatingSearchResults');
                    floatingSearchResults.textContent = searchResultsElement.textContent;
                } else {
                    floatingSearchContainer.style.display = 'none';
                }
            }
            
            // Handle floating search button
            document.getElementById('floatingSearchBtn').addEventListener('click', () => {
                const floatingSearchInput = document.getElementById('floatingSearchInput');
                document.getElementById('searchInput').value = floatingSearchInput.value;
                performSearch();
                // Update the floating search results display
                const searchResultsElement = document.getElementById('searchResults');
                const floatingSearchResults = document.getElementById('floatingSearchResults');
                floatingSearchResults.textContent = searchResultsElement.textContent;
            });
            
            // Handle floating clear search button
            document.getElementById('floatingClearSearchBtn').addEventListener('click', () => {
                document.getElementById('floatingSearchInput').value = '';
                clearSearch();
                // Update the floating search results display
                const floatingSearchResults = document.getElementById('floatingSearchResults');
                floatingSearchResults.textContent = '';
            });
            
            // Handle Enter key in floating search input
            document.getElementById('floatingSearchInput').addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    // If we already have search results, navigate to next result
                    if (searchResults.length > 0) {
                        nextSearchResult();
                    } else {
                        // Otherwise, perform a new search
                        const floatingSearchInput = document.getElementById('floatingSearchInput');
                        document.getElementById('searchInput').value = floatingSearchInput.value;
                        performSearch();
                    }
                    // Update the floating search results display
                    const searchResultsElement = document.getElementById('searchResults');
                    const floatingSearchResults = document.getElementById('floatingSearchResults');
                    floatingSearchResults.textContent = searchResultsElement.textContent;
                }
            });
            
            // Arrow key navigation is handled by the global keydown listener
            // No need for input-specific listener to avoid double navigation calls
            
            // Clear search when the floating search input is emptied
            document.getElementById('floatingSearchInput').addEventListener('input', (e) => {
                // Sync with fixed search input
                document.getElementById('searchInput').value = e.target.value;
                
                if (e.target.value.trim() === '') {
                    clearSearch();
                }
            });
            
            // Handle collapse button click
            document.getElementById('floatingCollapseBtn').addEventListener('click', () => {
                document.getElementById('floatingSearchExpanded').style.display = 'none';
                document.getElementById('floatingSearchCollapsed').style.display = 'block';
            });
            
            // Handle expand button click
            document.getElementById('floatingExpandBtn').addEventListener('click', () => {
                document.getElementById('floatingSearchCollapsed').style.display = 'none';
                document.getElementById('floatingSearchExpanded').style.display = 'flex';
            });
            
            // Add data-key attribute to block items for easier selection
            // This is in the renderBlocks function
            </script>`;
            
            // Add the file path to the HTML
            htmlContent = htmlContent.replace(
                '<h1>Structured Block Editor</h1>',
                '<h1>' + validation.typeName + ' Block Editor</h1>\n        <div style="display: flex; align-items: center; gap: 10px;">\n          <p style="color: var(--vscode-descriptionForeground); font-size: 0.9em; margin: 0; flex-grow: 1;">' + document.fileName + '</p>\n          <button id="openSourceBtn" class="open-source-btn">Open Source File</button>\n        </div>'
            );
            
            // Add CSS for the notification
            const styleInsert = `
            <style>
            /* Floating scroll to top button */
            .scroll-to-top-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                z-index: 999;
                opacity: 0;
                transform: translateY(100px);
                transition: all 0.3s ease;
                overflow: hidden;
                padding: 0;
            }
            
            .scroll-to-top-btn.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .scroll-progress {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: transparent;
            }
            
            .scroll-progress circle {
                fill: none;
                stroke-width: 2;
                stroke: #00a8ff;
                transform-origin: center;
                stroke-dasharray: 119.38;
                stroke-dashoffset: 119.38;
            }
            
            .scroll-to-top-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .scroll-to-top-btn span {
                position: relative;
                z-index: 1;
            }
            
            .document-changed-notification {
                background-color: var(--vscode-editorWarning-background);
                color: var(--vscode-editorWarning-foreground);
                border: 1px solid var(--vscode-editorWarning-border);
                padding: 10px;
                margin-bottom: 15px;
                border-radius: 3px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .document-changed-notification-bottom-right {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: var(--vscode-editorWarning-background);
                color: var(--vscode-editorWarning-foreground);
                border: 1px solid var(--vscode-editorWarning-border);
                padding: 12px 15px;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                max-width: 450px;
                font-family: var(--vscode-font-family);
                font-size: 13px;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .document-changed-notification-bottom-right span {
                flex: 1;
                white-space: nowrap;
            }
            
            .newly-added {
                border-left: 3px solid #4EC9B0;
                background-color: rgba(78, 201, 176, 0.1);
                animation: highlightAdded 2s ease-out;
            }
            
            @keyframes highlightAdded {
                0% { border-left-width: 10px; }
                100% { border-left-width: 3px; }
            }
            
            .reload-btn-notification, .dismiss-btn {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 12px;
                border-radius: 2px;
                cursor: pointer;
                white-space: nowrap;
                font-size: 12px;
                font-weight: 500;
            }
            
            .search-highlight {
                background-color: var(--vscode-editor-findMatchHighlightBackground);
                color: var(--vscode-editor-findMatchHighlightForeground);
            }
            
            .current-search-result {
                background-color: var(--vscode-editor-findMatchBackground);
                color: var(--vscode-editor-findMatchForeground);
            }
            
            .no-search-results {
                color: var(--vscode-errorForeground);
            }
            
            .reload-btn-notification:hover, .dismiss-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .cancel-edit-btn {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: none;
                padding: 5px 10px;
                border-radius: 2px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .cancel-edit-btn:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }
            
            button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            
            
            .delete-btn {
                background: none;
                border: none;
                color: var(--vscode-errorForeground);
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .delete-btn:hover {
                background-color: var(--vscode-toolbar-hoverBackground);
                border-radius: 3px;
            }
            
            .block-value {
                flex: 1;
                padding: 5px;
                background-color: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                color: var(--vscode-input-foreground);
                font-family: var(--vscode-editor-font-family);
                resize: vertical;
                min-height: 2em;
            }
            
            .block-value:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }
            
            .block-value[readonly] {
                background-color: var(--vscode-input-background);
                opacity: 0.7;
            }
            
            .block-value-readonly {
                flex: 1;
                padding: 5px;
                background-color: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                color: var(--vscode-input-foreground);
                font-family: var(--vscode-editor-font-family);
                opacity: 0.7;
                min-height: 2em;
            }
            </style>
            `;
            
            htmlContent = htmlContent.replace('</style>', styleInsert + '</style>');
            
            // Remove the existing script tag and placeholder
            htmlContent = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            
            // Add the new script content
            htmlContent = htmlContent.replace('</body>', scriptContent + '\n</body>');
            
            panel.webview.html = htmlContent;
            
            // Handle messages from the webview
            panel.webview.onDidReceiveMessage(
                async message => {
                    // Function to reload webview content - moved to fix ESLint no-inner-declarations error
                    async function reloadWebViewContent(currentDepth = null) {
                        let updatedDepthBlocks;
                        try {
                            // Force VS Code to refresh its view of the document from disk
                            await vscode.commands.executeCommand('workbench.action.files.revert', document.uri);
                            
                            // Re-read the document to get the updated content
                            const updatedDocument = await vscode.workspace.openTextDocument(document.uri);
                            const updatedContent = updatedDocument.getText();
                            
                            if (validation.fileExtension === '.json') {
                                const updatedJsonContent = JSON.parse(updatedContent);
                                updatedDepthBlocks = Parser.parseToDepthBlocks(updatedJsonContent);
                            } else {
                                updatedDepthBlocks = Parser.parseToDepthBlocks(updatedContent);
                            }
                            
                            // Convert array format to object format expected by the webview
                            const blocksObject = {};
                            updatedDepthBlocks.forEach(depthGroup => {
                                for (const key in depthGroup.blocks) {
                                    if (Object.prototype.hasOwnProperty.call(depthGroup.blocks, key)) {
                                        blocksObject[key] = depthGroup.blocks[key];
                                    }
                                }
                            });
                            
                            // Update the webview with new content and preserve current depth if provided
                            let updateMessage = {
                                command: 'update',
                                blocks: blocksObject
                            };
                            
                            // Add currentDepth to the message if provided
                            if (currentDepth !== null) {
                                updateMessage.currentDepth = currentDepth;
                            }
                            
                            panel.webview.postMessage(updateMessage);
                            
                            // Reset the external change notification flag when webview is reloaded
                            isExternalChangeNotified = false;
                        } catch (error) {
                            console.error('Error reloading webview content:', error);
                        }
                    }

                    switch (message.command) {
                        case 'save':
                            try {
                                console.log('=== BACKEND SAVE HANDLER START ===');
                                console.log('Save command received');
                                console.log('Message data:', JSON.parse(JSON.stringify(message)));
                                // Get the original content
                                const originalDocument = await vscode.workspace.openTextDocument(document.uri);
                                const originalContent = originalDocument.getText();
                                console.log('Original document content:', originalContent);
                                
                                // Get the appropriate parser
                                const Parser = FileTypeUtils.getParser(validation.fileExtension);
                                if (!Parser) {
                                    vscode.window.showErrorMessage(`Parser not found for file type: ${validation.fileExtension}`);
                                    return;
                                }
                                
                                console.log('Original content:', originalContent);
                                console.log('Message blocks:', message.blocks);
                                console.log('Deleted keys:', message.deletedKeys);
                                
                                // Debug: Log the structure of deleted keys
                                if (message.deletedKeys && message.deletedKeys.length > 0) {
                                    console.log('Number of deleted keys:', message.deletedKeys.length);
                                    message.deletedKeys.forEach((key, index) => {
                                        console.log(`Deleted key ${index}: ${key}`);
                                    });
                                } else {
                                    console.log('No deleted keys found');
                                }
                                
                                // Process updates and deletions separately to avoid interference
                                let updatedContent = await this.processFileUpdates(
                                    originalDocument, 
                                    originalContent, 
                                    message.blocks, 
                                    message.deletedKeys, 
                                    validation, 
                                    Parser
                                );
                                
                                if (!updatedContent) {
                                    return; // Error occurred in processFileUpdates
                                }
                                
                                // Update the document using direct file system write (same approach as syncDetector and batchUpdater)
                                try {
                                    console.log('Attempting to write file:', originalDocument.uri.fsPath);
                                    console.log('Content to write:', updatedContent);
                                    
                                    // Debug: Check if deletions are actually in the updated content
                                    if (message.deletedKeys && message.deletedKeys.length > 0) {
                                        console.log('Checking if deleted keys are present in updated content:');
                                        message.deletedKeys.forEach(key => {
                                            if (updatedContent.includes(key)) {
                                                console.log(`Key '${key}' still found in updated content - deletion may have failed`);
                                            } else {
                                                console.log(`Key '${key}' not found in updated content - deletion successful`);
                                            }
                                        });
                                    }
                                    
                                    fs.writeFileSync(originalDocument.uri.fsPath, updatedContent, 'utf8');
                                    console.log('File write successful');
                                    // Mark this as an internal change
                                    isInternalChange = true;
                                    
                                    // Force VS Code to refresh its view of the document
                                    await vscode.commands.executeCommand('workbench.action.files.revert', originalDocument.uri);
                                } catch (error) {
                                    console.error('Failed to apply changes to the file:', error);
                                    vscode.window.showErrorMessage('Failed to apply changes to the file: ' + error.message);
                                    return;
                                }
                                
                                // Reload the webview with the latest content from the updated document
                                let updatedDepthBlocks;
                                try {
                                    // Force VS Code to refresh its view of the document from disk
                                    await vscode.commands.executeCommand('workbench.action.files.revert', document.uri);
                                    
                                    // Re-read the document to get the updated content
                                    console.log('About to re-read document:', originalDocument.uri.fsPath);
                                    const updatedDocument = await vscode.workspace.openTextDocument(originalDocument.uri);
                                    const newContent = updatedDocument.getText();
                                    console.log('Content read from document:', newContent);
                                    console.log('Matches expected content:', newContent === updatedContent);
                                    
                                    if (validation.fileExtension === '.json') {
                                        const updatedJsonContent = JSON.parse(newContent);
                                        updatedDepthBlocks = Parser.parseToDepthBlocks(updatedJsonContent);
                                    } else {
                                        updatedDepthBlocks = Parser.parseToDepthBlocks(newContent);
                                    }
                                    
                                    // Convert array format to object format expected by the webview
                                    const blocksObject = {};
                                    updatedDepthBlocks.forEach(depthGroup => {
                                        for (const key in depthGroup.blocks) {
                                            if (Object.prototype.hasOwnProperty.call(depthGroup.blocks, key)) {
                                                blocksObject[key] = depthGroup.blocks[key];
                                            }
                                        }
                                    });
                                    
                                    // Update the webview with new content and preserve current depth
                                    panel.webview.postMessage({
                                        command: 'update',
                                        blocks: blocksObject,
                                        currentDepth: message.currentDepth
                                    });
                                } catch (error) {
                                    console.error('Error reloading webview content:', error);
                                }
                                
                                // Track changed blocks by comparing current blocks with original
                                const changedBlocks = this.identifyChangedBlocks(message);
                                
                                // Ask if user wants to apply batch update
                                const batchAction = await vscode.window.showInformationMessage(
                                    'Would you like to apply these changes to same-named file(s)?',
                                    { modal: true },
                                    'OK'
                                );
                                
                                // Only proceed with batch update if user explicitly selects "OK"
                                // If user selects "Cancel" or closes dialog, do nothing further
                                if (batchAction === 'OK') {
                                    await this.handleBatchUpdate(document, changedBlocks, message, panel, reloadWebViewContent);
                                } else if (batchAction === undefined) {
                                    // User selected "Cancel" or closed the dialog
                                    // Reload the webview with the latest content from the updated document
                                    await reloadWebViewContent(message.currentDepth);
                                    vscode.window.showInformationMessage('Current file block(s) updated successfully!');
                                    // Auto-hide message after 3 seconds
                                    setTimeout(() => {
                                        // Note: VS Code doesn't provide a direct way to hide messages
                                        // The message will automatically disappear when a new one is shown
                                    }, 3000);
                                }
                                console.log('=== BACKEND SAVE HANDLER END ===');

                            } catch (error) {
                                console.error('Error updating file:', error);
                                vscode.window.showErrorMessage('Error updating file: ' + error.message);
                            }
                            return;
                        case 'reload':
                            try {
                                // Get the current depth if provided, otherwise default to 1
                                const currentDepth = (message.currentDepth !== undefined && message.currentDepth !== null) ? message.currentDepth : 1;
                                
                                // Force VS Code to refresh its view of the document from disk
                                await vscode.commands.executeCommand('workbench.action.files.revert', document.uri);
                                
                                // Reload the document content
                                const updatedDocument = await vscode.workspace.openTextDocument(document.uri);
                                const updatedContent = updatedDocument.getText();
                                
                                // Get the appropriate parser
                                const Parser = FileTypeUtils.getParser(validation.fileExtension);
                                if (!Parser) {
                                    vscode.window.showErrorMessage(`Parser not found for file type: ${validation.fileExtension}`);
                                    return;
                                }
                                
                                let updatedDepthBlocks;
                                if (validation.fileExtension === '.json') {
                                    const updatedJsonContent = JSON.parse(updatedContent);
                                    updatedDepthBlocks = Parser.parseToDepthBlocks(updatedJsonContent);
                                } else {
                                    updatedDepthBlocks = Parser.parseToDepthBlocks(updatedContent);
                                }
                                
                                // Convert array format to object format expected by the webview
                                const blocksObject = {};
                                updatedDepthBlocks.forEach(depthGroup => {
                                    for (const key in depthGroup.blocks) {
                                        if (Object.prototype.hasOwnProperty.call(depthGroup.blocks, key)) {
                                            blocksObject[key] = depthGroup.blocks[key];
                                        }
                                    }
                                });
                                
                                // Update the webview with new content and preserve the depth
                                panel.webview.postMessage({
                                    command: 'update',
                                    blocks: blocksObject,
                                    currentDepth: currentDepth
                                });
                                
                                // Update our version tracking
                                documentVersion = updatedDocument.version;
                                
                                // Reset the external change notification flag when document is reloaded
                                isExternalChangeNotified = false;
                                
                                vscode.window.showInformationMessage('Document reloaded with latest changes');
                                // Auto-hide message after 3 seconds
                                setTimeout(() => {
                                    // Note: VS Code doesn't provide a direct way to hide messages
                                    // The message will automatically disappear when a new one is shown
                                }, 3000);
                            } catch (error) {
                                vscode.window.showErrorMessage('Error reloading document: ' + error.message);
                            }
                            return;
                        case 'dismissNotification':
                            // Reset the external change notification flag when user dismisses notification
                            isExternalChangeNotified = false;
                            return;
                        case 'openSource':
                            // Open the source file in VS Code editor
                            vscode.window.showTextDocument(document.uri);
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

        } catch (error) {
            vscode.window.showErrorMessage('Error processing file: ' + error.message);
        }
    }
    
    /**
     * Process file updates, handling both modifications and deletions separately
     * This separation helps prevent interference between update and deletion logic
     */
    static async processFileUpdates(originalDocument, originalContent, blocks, deletedKeys, validation, Parser) {
        let updatedContent;
        
        if (validation.fileExtension === '.json') {
            // Get the original JSON content
            // Extract original number formats before parsing
            const originalNumberFormats = Parser.extractOriginalNumberFormats(originalContent);
            const originalJsonContent = JSON.parse(originalContent);
            
            console.log('Original JSON content:', JSON.stringify(originalJsonContent, null, 2));
            
            // For JSON files, combine changes and deletions
            // Create a combined changes object with both updates and deletions
            const combinedChanges = { ...blocks };
            
            // Add deletions as null values (which applyBlockChangesEnhanced will properly handle)
            if (deletedKeys && deletedKeys.length > 0) {
                console.log('Adding deletions to combined changes for JSON');
                deletedKeys.forEach(key => {
                    console.log(`Marking key '${key}' for deletion`);
                    combinedChanges[key] = null;
                });
            }
            
            console.log('Combined changes object:', JSON.parse(JSON.stringify(combinedChanges)));
            
            // Apply all changes using applyBlockChangesEnhanced which properly handles deletions
            const updatedJson = Parser.applyBlockChangesEnhanced(originalJsonContent, combinedChanges, originalNumberFormats);
            updatedContent = JSON.stringify(updatedJson, null, 2);
            
            console.log('Updated JSON content:', updatedContent);
        } else {
            // For non-JSON files, combine changes and deletions and use applyOnlyChangedBlocks
            
            // Create a combined changes object with both updates and deletions
            const combinedChanges = { ...blocks };
            
            // Add deletions as null values (which applyOnlyChangedBlocks interprets as deletions)
            if (deletedKeys && deletedKeys.length > 0) {
                console.log('Adding deletions to combined changes for non-JSON');
                deletedKeys.forEach(key => {
                    console.log(`Marking key '${key}' for deletion`);
                    combinedChanges[key] = null;
                });
            }
            
            console.log('Combined changes object:', JSON.parse(JSON.stringify(combinedChanges)));
            
            // Apply all changes using applyOnlyChangedBlocks which properly handles deletions
            updatedContent = Parser.applyOnlyChangedBlocks(originalContent, combinedChanges);
        }
        
        return updatedContent;
    }
    
    /**
     * Identify changed blocks by comparing current blocks with original
     * This helps with batch updates to only synchronize actual changes
     */
    static identifyChangedBlocks(message) {
        const changedBlocks = {};
        
        // Create a map of original blocks for easier comparison, but only for the current depth
        const originalBlocksMap = {};
        if (message.originalBlocks && message.currentDepth !== undefined) {
            // Filter original blocks to only include those from the currently selected depth
            const selectedOriginalDepthGroups = message.originalBlocks.filter(depthGroup => depthGroup.depth === message.currentDepth);
            selectedOriginalDepthGroups.forEach(depthGroup => {
                for (const [key, block] of Object.entries(depthGroup.blocks)) {
                    originalBlocksMap[key] = block;
                }
            });
            
            // Compare the blocks sent by the webview with original to find changes
            for (const key in message.blocks) {
                if (Object.prototype.hasOwnProperty.call(message.blocks, key)) {
                    const currentBlock = message.blocks[key];
                    
                    // Check if this is a new block or a modified one
                    if (!originalBlocksMap[key]) {
                        // This is a new block
                        changedBlocks[key] = currentBlock;
                    } else {
                        // Check if the block actually changed
                        const originalBlock = originalBlocksMap[key];
                        const originalValue = 
                            (typeof originalBlock === 'object' && originalBlock !== null && Object.prototype.hasOwnProperty.call(originalBlock, 'value')) ?
                            ((typeof originalBlock.value === 'string' && originalBlock.value.startsWith('"') && originalBlock.value.endsWith('"')) ?
                            originalBlock.value.substring(1, originalBlock.value.length - 1) : 
                            originalBlock.value) : 
                            originalBlock;
                        const currentValue = 
                            (typeof currentBlock === 'object' && currentBlock !== null && Object.prototype.hasOwnProperty.call(currentBlock, 'value')) ?
                            ((typeof currentBlock.value === 'string' && currentBlock.value.startsWith('"') && currentBlock.value.endsWith('"')) ?
                            currentBlock.value.substring(1, currentBlock.value.length - 1) : 
                            currentBlock.value) : 
                            currentBlock;
                        
                        // Only include in changedBlocks if the value actually changed
                        if (originalValue !== currentValue) {
                            changedBlocks[key] = currentBlock;
                        }
                    }
                }
            }
            
            // Check for deleted blocks across all depths
            // First, collect all original keys from the current depth only
            // (since message.blocks only contains blocks from the current depth)
            const originalKeys = [];
            if (message.originalBlocks && message.currentDepth !== undefined) {
                // Filter original blocks to only include those from the currently selected depth
                const selectedOriginalDepthGroups = message.originalBlocks.filter(depthGroup => depthGroup.depth === message.currentDepth);
                selectedOriginalDepthGroups.forEach(depthGroup => {
                    for (const key of Object.keys(depthGroup.blocks)) {
                        originalKeys.push(key);
                    }
                });
            }
            
            // Then check which ones are missing from current blocks
            originalKeys.forEach(key => {
                // Check if this key exists in the current blocks
                let exists = false;
                for (const currentKey in message.blocks) {
                    if (currentKey === key) {
                        exists = true;
                        break;
                    }
                }
                
                if (!exists) {
                    // Mark as deleted with null value
                    changedBlocks[key] = null;
                }
            });
        } else {
            // If we don't have original blocks or currentDepth, send all current blocks
            for (const key in message.blocks) {
                if (Object.prototype.hasOwnProperty.call(message.blocks, key)) {
                    changedBlocks[key] = message.blocks[key];
                }
            }
        }
        
        return changedBlocks;
    }
    
    /**
     * Handle batch update functionality for same-named files
     */
    static async handleBatchUpdate(document, changedBlocks, message, panel, reloadWebViewContent) {
        // Find same-named files
        const sameNamedFiles = SyncDetector.findSameNamedFiles(document.fileName);
        
        if (sameNamedFiles.length === 0) {
            vscode.window.showInformationMessage('No same-named files found for synchronization.');
            // Auto-hide message after 3 seconds
            setTimeout(() => {
                // Note: VS Code doesn't provide a direct way to hide messages
                // The message will automatically disappear when a new one is shown
            }, 3000);
            // Reload the webview with the latest content from the updated document
            await reloadWebViewContent(message.currentDepth);
            return;
        }
        
        // Create quick pick items for file selection
        const quickPickItems = sameNamedFiles.map(file => ({
            label: path.basename(file),
            description: file,
            picked: true // Selected by default
        }));
        
        // Show quick pick dialog for file selection
        const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: 'Select files to synchronize (press SPACE to toggle selection)',
            title: 'Select Files to Synchronize',
            ignoreFocusOut: true
        });
        
        if (selectedItems && selectedItems.length > 0) {
            // Extract file paths from selected items
            const filePaths = selectedItems.map(item => item.description);
            
            // Synchronize only the CHANGED blocks, not the entire file content
            SyncDetector.synchronizeBlockChanges(document.fileName, changedBlocks, filePaths);
            vscode.window.showInformationMessage('File blocks updated successfully!');
            // Auto-hide message after 3 seconds
            setTimeout(() => {
                // Note: VS Code doesn't provide a direct way to hide messages
                // The message will automatically disappear when a new one is shown
            }, 3000);
        } else if (selectedItems && selectedItems.length === 0) {
            // User confirmed selection but didn't select any files
            vscode.window.showInformationMessage('No files selected. Only current file was updated.');
            // Auto-hide message after 3 seconds
            setTimeout(() => {
                // Note: VS Code doesn't provide a direct way to hide messages
                // The message will automatically disappear when a new one is shown
            }, 3000);
        } else if (selectedItems === undefined) {
            // User pressed Escape or closed the dialog
            vscode.window.showInformationMessage('Current file block(s) updated successfully!');
            // Auto-hide message after 3 seconds
            setTimeout(() => {
                // Note: VS Code doesn't provide a direct way to hide messages
                // The message will automatically disappear when a new one is shown
            }, 3000);
        }
        
        // Reload the webview with the latest content from the updated document
        await reloadWebViewContent(message.currentDepth);
    }
}

module.exports = BlockEditorHandler;