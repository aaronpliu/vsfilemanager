const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { FileTypeUtils } = require('../utils/fileTypeUtils');
const SyncDetector = require('../syncDetector');

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
                        // Also reset the notification flag since we made an internal change
                        isExternalChangeNotified = false;
                    }
                }
            });

            // Set up a listener for when the panel is disposed
            panel.onDidDispose(() => {
                changeListener.dispose();
                // Clear any pending external change timer
                if (externalChangeTimer) {
                    clearTimeout(externalChangeTimer);
                }
            }, null, context.subscriptions);

            // Get path to HTML file on disk
            const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'blockEditor.html');
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
            
            // Set the webview's html content
            const scriptContent = `
            <script>
            const vscode = acquireVsCodeApi();
            
            // Store the original blocks
            const originalBlocks = ${JSON.stringify(depthBlocks)};
            let currentBlocks = JSON.parse(JSON.stringify(originalBlocks));
            
            // Set initial depth to 2 (default selected depth)
            let maxDepth = 2;
            
            // Calculate the maximum depth from the actual data (for populating selectors)
            const actualMaxDepth = Math.max(...originalBlocks.map(block => block.depth), 2); // Default to 2 if no blocks
            let documentVersion = ${document.version}; // Track document version
            
            // Search state
            let searchResults = [];
            let currentSearchIndex = -1;
            
            // Newly added blocks tracking
            let newlyAddedBlocks = [];
            
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
                const maxDepthInFile = Math.max(...currentBlocks.map(block => block.depth), 2); // Default to 2 if no blocks
                
                // Create options from 0 to maxDepthInFile (no fixed minimum)
                for (let i = 0; i <= maxDepthInFile; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    if (i === 2) { // Default selected depth
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
                const maxDepthInFile = Math.max(...currentBlocks.map(block => block.depth), 2); // Default to 2 if no blocks
                
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
                
                // Find all depth groups that match the selected depth
                const selectedDepthGroups = currentBlocks.filter(depthGroup => depthGroup.depth === maxDepth);
                
                if (selectedDepthGroups.length > 0) {
                    // Create a container for all blocks at this depth
                    const allBlocksContainer = document.createElement('div');
                    allBlocksContainer.className = 'depth-group';
                    
                    const depthHeader = document.createElement('div');
                    depthHeader.className = 'depth-header';
                    const depthTitle = document.createElement('h3');
                    depthTitle.textContent = 'Depth Level ' + maxDepth;
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
                            groupHeader.style.fontWeight = 'bold';
                            groupHeader.style.marginTop = '10px';
                            groupHeader.style.paddingBottom = '5px';
                            groupHeader.style.borderBottom = '1px solid var(--vscode-panel-border)';
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
                                const input = document.createElement('input');
                                input.type = 'text';
                                input.className = 'block-value';
                                input.value = block.value;
                                input.setAttribute('readonly', 'readonly');
                                input.setAttribute('data-key', key);
                                input.setAttribute('data-depth', selectedDepthGroup.depth);
                                blockValueContainer.appendChild(input);
                                
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
                    noBlocksMessage.textContent = 'No blocks found at depth level ' + maxDepth;
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
                        
                        // Find the correct depth group and delete the block
                        let deleted = false;
                        for (const depthGroup of currentBlocks) {
                            if (depthGroup.depth === depthIndex && depthGroup.blocks.hasOwnProperty(key)) {
                                delete depthGroup.blocks[key];
                                deleted = true;
                                break;
                            }
                        }
                        
                        // If not found in the specific depth, search all groups
                        if (!deleted) {
                            for (const depthGroup of currentBlocks) {
                                if (depthGroup.blocks.hasOwnProperty(key)) {
                                    delete depthGroup.blocks[key];
                                    deleted = true;
                                    break;
                                }
                            }
                        }
                        
                        if (deleted) {
                            renderBlocks();
                            // Enable save button when block is deleted
                            updateSaveButtonState();
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
                            e.target.textContent = 'Save';
                            
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
                                    dg.depth === depthIndex && dg.blocks.hasOwnProperty(key));
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
                            });
                        } else {
                            input.setAttribute('readonly', 'readonly');
                            // Update the value in our data structure
                            const depthGroup = currentBlocks.find(dg => 
                                dg.depth === depthIndex && dg.blocks.hasOwnProperty(key));
                            if (depthGroup && depthGroup.blocks[key]) {
                                // Handle different data types properly - keep the object structure
                                // but update the value property with the correct type
                                if (depthGroup.blocks[key].originalType === 'number') {
                                    const numValue = Number(input.value);
                                    depthGroup.blocks[key].value = !isNaN(numValue) ? numValue : input.value;
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
                        }
                    });
                });
                
                // Add event listeners to value inputs
                document.querySelectorAll('.block-value').forEach(input => {
                    input.addEventListener('input', (e) => {
                        const key = e.target.getAttribute('data-key');
                        const depthIndex = parseInt(e.target.getAttribute('data-depth'));
                        const depthGroup = currentBlocks.find(dg => 
                            dg.depth === depthIndex && dg.blocks.hasOwnProperty(key));
                        if (depthGroup && depthGroup.blocks[key]) {
                            // Handle different data types properly - keep the object structure
                            // but update the value property with the correct type
                            if (depthGroup.blocks[key].originalType === 'number') {
                                const numValue = Number(e.target.value);
                                depthGroup.blocks[key].value = !isNaN(numValue) ? numValue : e.target.value;
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
                            // Check if value has actually changed from original
                            const originalValue = e.target.getAttribute('data-original-value');
                            if (originalValue !== undefined && originalValue !== e.target.value) {
                                // Enable save button when value changes
                                updateSaveButtonState();
                            } else {
                                resetSaveButtonState();
                            }
                        }
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
                document.getElementById('newBlockDepth').value = maxDepth;
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
                } else {
                    alert('Please enter a valid key!');
                }
            });
            
            // Handle depth selection change
            document.getElementById('depthSelector').addEventListener('change', (e) => {
                maxDepth = parseInt(e.target.value);
                renderBlocks();
            });
            
            // Handle search button
            document.getElementById('searchBtn').addEventListener('click', performSearch);
            
            // Handle clear search button
            document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
            
            // Handle Enter key in search input
            document.getElementById('searchInput').addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
            
            // Clear search when the search input is emptied
            document.getElementById('searchInput').addEventListener('input', (e) => {
                if (e.target.value.trim() === '') {
                    clearSearch();
                }
            });
            
            // Handle Save button
            document.getElementById('saveBtn').addEventListener('click', () => {
                // Flatten blocks for saving
                const flattenedBlocks = {};
                currentBlocks.forEach(depthGroup => {
                    for (const [key, block] of Object.entries(depthGroup.blocks)) {
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
                
                // Create a list of deleted keys by comparing with originalBlocks
                const deletedKeys = [];
                if (originalBlocks) {
                    originalBlocks.forEach(depthGroup => {
                        for (const [key, block] of Object.entries(depthGroup.blocks)) {
                            // Check if this key exists in the current blocks
                            let exists = false;
                            for (const currentDepthGroup of currentBlocks) {
                                if (currentDepthGroup.blocks.hasOwnProperty(key)) {
                                    exists = true;
                                    break;
                                }
                            }
                            
                            if (!exists) {
                                deletedKeys.push(key);
                            }
                        }
                    });
                }
                
                // Clear newly added blocks tracking on save
                newlyAddedBlocks = [];
                
                vscode.postMessage({
                    command: 'save',
                    blocks: flattenedBlocks,
                    deletedKeys: deletedKeys,
                    originalBlocks: originalBlocks
                });
            });
            
            // Handle Reload button
            document.getElementById('reloadBtn').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'reload'
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
                        // When we receive updated blocks, we need to reorganize them into the proper grouped structure
                        const updatedBlocks = JSON.parse(JSON.stringify(message.blocks));
                        currentBlocks = [];
                        
                        // Store the currently selected depth
                        const currentSelectedDepth = maxDepth;
                        
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
                        
                        populateDepthSelector();
                        populateNewBlockDepthSelector();
                        
                        // Restore the previously selected depth
                        maxDepth = currentSelectedDepth;
                        const depthSelector = document.getElementById('depthSelector');
                        if (depthSelector) {
                            depthSelector.value = maxDepth;
                        }
                        
                        // Clear newly added blocks tracking after update
                        newlyAddedBlocks = [];
                        
                        renderBlocks();
                        // Disable save button after successful update
                        resetSaveButtonState();
                        // Also reset the external change notification flag
                        isExternalChangeNotified = false;
                        break;
                    case 'documentChanged':
                        // Show a notification that the document has been modified. Would you like to reload the latest content?
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
                                vscode.postMessage({
                                    command: 'reload'
                                });
                                notification.remove();
                            });
                            
                            document.getElementById('dismissBtn').addEventListener('click', () => {
                                vscode.postMessage({
                                    command: 'dismissNotification'
                                });
                                notification.remove();
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
                    return;
                }
                
                // Find all matching blocks across all depths
                searchResults = [];
                currentBlocks.forEach(depthGroup => {
                    for (const key in depthGroup.blocks) {
                        if (key.toLowerCase().includes(searchTerm)) {
                            searchResults.push(key);
                        }
                    }
                });
                
                if (searchResults.length > 0) {
                    currentSearchIndex = 0;
                    searchResultsElement.textContent = 'Found ' + searchResults.length + ' result(s). Use Enter or Search button to navigate.';
                    showSearchNavigationBar();
                    updateSearchNavigationCounter();
                } else {
                    currentSearchIndex = -1;
                    searchResultsElement.textContent = 'No matching blocks found.';
                    hideSearchNavigationBar();
                }
                
                renderBlocks();
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
                    document.getElementById('searchResults').textContent = 
                        'Result ' + (currentSearchIndex + 1) + ' of ' + searchResults.length;
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
            
            // Function to clear search
            function clearSearch() {
                document.getElementById('searchInput').value = '';
                searchResults = [];
                currentSearchIndex = -1;
                document.getElementById('searchResults').textContent = '';
                hideSearchNavigationBar();
                renderBlocks();
            }
            
            // Handle next result button
            document.getElementById('nextResultBtn').addEventListener('click', nextSearchResult);
            
            // Handle previous result button
            document.getElementById('prevResultBtn').addEventListener('click', previousSearchResult);
            
            // Handle close search navigation button
            document.getElementById('closeSearchNavBtn').addEventListener('click', clearSearch);
            
            // Handle keyboard navigation (Enter and Shift+Enter)
            document.addEventListener('keydown', (e) => {
                // Only handle if search results exist and we're not in an input field
                if (searchResults.length > 0 && 
                    e.target.tagName !== 'INPUT' && 
                    e.target.tagName !== 'TEXTAREA') {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        nextSearchResult();
                        e.preventDefault();
                    } else if (e.key === 'Enter' && e.shiftKey) {
                        previousSearchResult();
                        e.preventDefault();
                    }
                }
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
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 15px;
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
                padding: 5px 10px;
                border-radius: 2px;
                cursor: pointer;
            }
            
            .search-highlight {
                background-color: var(--vscode-editor-findMatchHighlightBackground);
                color: var(--vscode-editor-findMatchHighlightForeground);
            }
            
            .current-search-result {
                background-color: var(--vscode-editor-findMatchBackground);
                color: var(--vscode-editor-findMatchForeground);
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
            
            .open-source-btn {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 4px 8px;
                border-radius: 2px;
                cursor: pointer;
                font-size: 0.8em;
                white-space: nowrap;
            }
            
            .open-source-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
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
                    switch (message.command) {
                        case 'save':
                            try {
                                // Get the original content
                                const originalContent = document.getText();
                                
                                // Get the appropriate parser
                                const Parser = FileTypeUtils.getParser(validation.fileExtension);
                                if (!Parser) {
                                    vscode.window.showErrorMessage(`Parser not found for file type: ${validation.fileExtension}`);
                                    return;
                                }
                                
                                let updatedContent;
                                if (validation.fileExtension === '.json') {
                                    // Get the original JSON content
                                    const originalJsonContent = JSON.parse(originalContent);
                                    
                                    // Apply block changes (including deletions) to the original content using enhanced method
                                    const updatedJson = Parser.applyBlockChangesEnhanced(originalJsonContent, message.blocks);
                                    updatedContent = JSON.stringify(updatedJson, null, 2);
                                } else {
                                    // Apply block changes (including deletions) to the original content using enhanced method
                                    updatedContent = Parser.applyBlockChangesEnhanced(originalContent, message.blocks);
                                }
                                
                                // Handle deletions if any
                                if (message.deletedKeys && message.deletedKeys.length > 0) {
                                    if (validation.fileExtension === '.json') {
                                        // For JSON files, we need to parse the updated content into blocks
                                        const updatedBlocks = Parser.parseToBlocks(JSON.parse(updatedContent));
                                        
                                        // Remove deleted keys
                                        message.deletedKeys.forEach(key => {
                                            if (updatedBlocks.hasOwnProperty(key)) {
                                                delete updatedBlocks[key];
                                            }
                                        });
                                        
                                        // Convert back to JSON
                                        const finalJson = Parser.blocksToJson(updatedBlocks);
                                        updatedContent = JSON.stringify(finalJson, null, 2);
                                    } else {
                                        // For other formats, we need to parse the updated content into blocks
                                        const updatedBlocks = Parser.parseToBlocks(updatedContent);
                                        
                                        // Remove deleted keys
                                        message.deletedKeys.forEach(key => {
                                            if (updatedBlocks.hasOwnProperty(key)) {
                                                delete updatedBlocks[key];
                                            }
                                        });
                                        
                                        // Convert back to the appropriate format
                                        updatedContent = Parser.blocksToContent ?
                                            Parser.blocksToContent(updatedBlocks) :
                                            (Parser.blocksToYaml ? Parser.blocksToYaml(updatedBlocks) :
                                                (Parser.blocksToXml ? Parser.blocksToXml(updatedBlocks) :
                                                    Parser.blocksToToml(updatedBlocks)));
                                    }
                                }
                                
                                // Update the document
                                const edit = new vscode.WorkspaceEdit();
                                const fullRange = new vscode.Range(
                                    document.positionAt(0),
                                    document.positionAt(document.getText().length)
                                );
                                edit.replace(document.uri, fullRange, updatedContent);
                                
                                // Mark this as an internal change
                                isInternalChange = true;
                                
                                // Apply the edit
                                await vscode.workspace.applyEdit(edit);
                                
                                // Show success message for the current file update
                                vscode.window.showInformationMessage('File blocks updated successfully!');
                                
                                // Reload the webview with the latest content from the updated document
                                let updatedDepthBlocks;
                                try {
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
                                            if (depthGroup.blocks.hasOwnProperty(key)) {
                                                blocksObject[key] = depthGroup.blocks[key];
                                            }
                                        }
                                    });
                                    
                                    // Update the webview with new content
                                    panel.webview.postMessage({
                                        command: 'update',
                                        blocks: blocksObject
                                    });
                                } catch (error) {
                                    console.error('Error reloading webview content:', error);
                                }
                                
                                // Track changed blocks by comparing current blocks with original
                                const changedBlocks = {};
                                
                                // Helper function to normalize values for comparison
                                function normalizeValueForComparison(value) {
                                    // If it's a string that looks like a quoted string, remove the quotes
                                    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                                        return value.substring(1, value.length - 1);
                                    }
                                    return value;
                                }
                                
                                // Helper function to get the actual value from a block
                                function getBlockValue(block) {
                                    if (typeof block === 'object' && block !== null && block.hasOwnProperty('value')) {
                                        return normalizeValueForComparison(block.value);
                                    }
                                    return block;
                                }
                                
                                // Create a map of original blocks for easier comparison
                                const originalBlocksMap = {};
                                if (message.originalBlocks) {
                                    message.originalBlocks.forEach(depthGroup => {
                                        for (const [key, block] of Object.entries(depthGroup.blocks)) {
                                            originalBlocksMap[key] = block;
                                        }
                                    });
                                    
                                    // Compare the blocks sent by the webview with original to find changes
                                    for (const key in message.blocks) {
                                        if (message.blocks.hasOwnProperty(key)) {
                                            const currentBlock = message.blocks[key];
                                            
                                            // Check if this is a new block or a modified one
                                            if (!originalBlocksMap[key]) {
                                                // This is a new block
                                                changedBlocks[key] = currentBlock;
                                            } else {
                                                // Include all blocks in changedBlocks for batch update,
                                                // regardless of whether they've changed from the original values
                                                // This ensures that when a value is reverted to its original state,
                                                // it's still properly synchronized to other files
                                                changedBlocks[key] = currentBlock;
                                            }
                                        }
                                    }
                                    
                                    // Check for deleted blocks
                                    message.originalBlocks.forEach(depthGroup => {
                                        for (const [key, block] of Object.entries(depthGroup.blocks)) {
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
                                        }
                                    });
                                } else {
                                    // If we don't have original blocks, send all current blocks
                                    for (const key in message.blocks) {
                                        if (message.blocks.hasOwnProperty(key)) {
                                            changedBlocks[key] = message.blocks[key];
                                        }
                                    }
                                }
                                
                                // Ask if user wants to apply batch update
                                const batchAction = await vscode.window.showInformationMessage(
                                    'Would you like to apply these changes to other files?',
                                    { modal: true },
                                    'Batch Update',
                                    'No'
                                );
                                
                                // Only proceed with batch update if user explicitly selects "Batch Update"
                                // If user selects "No" or closes dialog, do nothing further
                                if (batchAction === 'Batch Update') {
                                    // Find same-named files
                                    const sameNamedFiles = SyncDetector.findSameNamedFiles(document.fileName);
                                    
                                    if (sameNamedFiles.length === 0) {
                                        vscode.window.showInformationMessage('No same-named files found for synchronization.');
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
                                    }
                                } else if (batchAction === 'No' || batchAction === undefined) {
                                    // User selected "No" or closed the dialog
                                    // Nothing more to do, already updated current file and refreshed webview
                                }

                            } catch (error) {
                                vscode.window.showErrorMessage('Error updating file: ' + error.message);
                            }
                            return;
                        case 'reload':
                            try {
                                // Reset the external change notification flag
                                isExternalChangeNotified = false;
                                
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
                                        if (depthGroup.blocks.hasOwnProperty(key)) {
                                            blocksObject[key] = depthGroup.blocks[key];
                                        }
                                    }
                                });
                                
                                // Update the webview with new content
                                panel.webview.postMessage({
                                    command: 'update',
                                    blocks: blocksObject
                                });
                                
                                // Update our version tracking
                                documentVersion = updatedDocument.version;
                                
                                vscode.window.showInformationMessage('Document reloaded with latest changes');
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
}

module.exports = BlockEditorHandler;