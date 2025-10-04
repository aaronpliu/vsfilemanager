// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const JsonBlockParser = require('./src/jsonBlockParser');
const SyncDetector = require('./src/syncDetector');
const BatchUpdater = require('./src/batchUpdater');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vsfilemanager" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('vsfilemanager.editJsonBlocks', async function () {
		// The code you place here will be executed every time your command is executed

		// Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found!');
			return;
		}

		// Check if it's a JSON file
		const document = editor.document;
		if (path.extname(document.fileName) !== '.json') {
			vscode.window.showErrorMessage('Active file is not a JSON file!');
			return;
		}

		try {
			// Parse the JSON content
			const jsonContent = JSON.parse(document.getText());
			
			// Convert to blocks grouped by depth
			const depthBlocks = JsonBlockParser.parseToDepthBlocks(jsonContent);
			
			// Get the file name for the title
			const fileName = path.basename(document.fileName);
			const filePath = document.fileName;
			
			// Create and show a webview panel
			const panel = vscode.window.createWebviewPanel(
				'jsonBlockEditor', // Identifies the type of the webview. Used internally
				`JSON Block Editor`, // Title of the panel displayed to the user
				vscode.ViewColumn.One, // Editor column to show the new webview panel in.
				{
					// Enable scripts in the webview
					enableScripts: true,
					// Restrict the webview to only load resources from workspace and webview directory
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'webview')
					]
				}
			);

			// Store the document's initial version
			let documentVersion = document.version;

			// Set up a listener for document changes
			const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.document.uri.toString() === document.uri.toString()) {
					// Document has changed, update the version
					documentVersion = event.document.version;
					
					// Notify the webview that the document has changed
					panel.webview.postMessage({
						command: 'documentChanged',
						version: documentVersion
					});
				}
			});

			// Set up a listener for when the panel is disposed
			panel.onDidDispose(() => {
				changeListener.dispose();
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
			let maxDepth = 2; // Default depth is 2 - matching the HTML selector
			let documentVersion = ${document.version}; // Track document version
			
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
							
							const blockHeader = document.createElement('div');
							blockHeader.className = 'block-header';
							
							const blockKey = document.createElement('div');
							blockKey.className = 'block-key';
							blockKey.textContent = key;
							blockHeader.appendChild(blockKey);
							
							const deleteBtn = document.createElement('button');
							deleteBtn.className = 'delete-btn';
							deleteBtn.textContent = '🗑';
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
								// Update the display value
								depthGroup.blocks[key].value = input.value;
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
							// Update the display value
							depthGroup.blocks[key].value = e.target.value;
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
			renderBlocks();
			// Disable save button by default
			resetSaveButtonState();
			
			// Handle Add Block button
			document.getElementById('addBlockBtn').addEventListener('click', () => {
				document.getElementById('newBlockForm').classList.remove('hidden');
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
					// Add to selected depth level
					let depthGroup = currentBlocks.find(dg => dg.depth === depth);
					if (!depthGroup) {
						depthGroup = { depth: depth, blocks: {} };
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
			
			// Handle Save button
			document.getElementById('saveBtn').addEventListener('click', () => {
				// Flatten blocks for saving
				const flattenedBlocks = {};
				currentBlocks.forEach(depthGroup => {
					for (const [key, block] of Object.entries(depthGroup.blocks)) {
						// Pass the entire block object to preserve type information
						flattenedBlocks[key] = block;
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
			
			// Handle messages from the extension
			window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'update':
						currentBlocks = JSON.parse(JSON.stringify(message.blocks));
						renderBlocks();
						// Disable save button after successful update
						resetSaveButtonState();
						break;
					case 'documentChanged':
						// Show a notification that the document has changed
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
								notification.remove();
							});
						}
						break;
				}
			});
			</script>`;
			
			// Add the file path to the HTML
			htmlContent = htmlContent.replace(
				'<h1>JSON Block Editor</h1>',
				'<h1>JSON Block Editor</h1>\n        <p style="color: var(--vscode-descriptionForeground); font-size: 0.9em; margin-top: -10px;">' + document.fileName + '</p>'
			);
			
			// Add depth selector to the HTML
			htmlContent = htmlContent.replace(
				'<p>Edit individual JSON blocks using dot notation paths</p>',
				'<p>Edit individual JSON blocks using dot notation paths</p>'
			);
			
			// Add CSS for the notification
			const styleInsert = `
			<style>
			.document-changed-notification {
				background-color: var(--vscode-editorWarning-foreground);
				color: var(--vscode-input-foreground);
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
			
			.reload-btn-notification, .dismiss-btn {
				background-color: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border: none;
				padding: 5px 10px;
				border-radius: 2px;
				cursor: pointer;
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
								// Get the original JSON content
								const originalJsonContent = JSON.parse(document.getText());
								
								// Apply block changes (including deletions) to the original content
								const updatedJson = JsonBlockParser.applyBlockChanges(originalJsonContent, message.blocks);
								
								// Handle deletions if any
								if (message.deletedKeys && message.deletedKeys.length > 0) {
									// Parse the updated JSON into blocks to work with
									const updatedBlocks = JsonBlockParser.parseToBlocks(updatedJson);
									
									// Remove deleted keys
									message.deletedKeys.forEach(key => {
										if (updatedBlocks.hasOwnProperty(key)) {
											delete updatedBlocks[key];
										}
									});
									
									// Convert back to JSON
									const finalJson = JsonBlockParser.blocksToJson(updatedBlocks);
									
									// Update the document
									const edit = new vscode.WorkspaceEdit();
									const fullRange = new vscode.Range(
										document.positionAt(0),
										document.positionAt(document.getText().length)
									);
									edit.replace(document.uri, fullRange, JSON.stringify(finalJson, null, 2));
									
									// Apply the edit
									await vscode.workspace.applyEdit(edit);
								} else {
									// No deletions, use the updated JSON directly
									// Update the document
									const edit = new vscode.WorkspaceEdit();
									const fullRange = new vscode.Range(
										document.positionAt(0),
										document.positionAt(document.getText().length)
									);
									edit.replace(document.uri, fullRange, JSON.stringify(updatedJson, null, 2));
									
									// Apply the edit
									await vscode.workspace.applyEdit(edit);
								}
								
								// Show success message for the current file update
								vscode.window.showInformationMessage('JSON blocks updated successfully!');
								
								// Reload the webview with the latest content from the updated document
								let updatedDepthBlocks;
								try {
									// Re-read the document to get the updated content
									const updatedDocument = await vscode.workspace.openTextDocument(document.uri);
									const updatedJsonContent = JSON.parse(updatedDocument.getText());
									updatedDepthBlocks = JsonBlockParser.parseToDepthBlocks(updatedJsonContent);
									
									// Update the webview with new content
									panel.webview.postMessage({
										command: 'update',
										blocks: updatedDepthBlocks
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
									
									// Compare current blocks with original to find changes
									// Use the updatedDepthBlocks we just fetched, not the message.blocks
									if (updatedDepthBlocks) {
										for (const depthGroup of updatedDepthBlocks) {
											for (const [key, block] of Object.entries(depthGroup.blocks)) {
												// Check if this is a new block or a modified one
												if (!originalBlocksMap[key]) {
													// This is a new block
													changedBlocks[key] = block;
												} else {
													// Compare the values properly
													const originalBlock = originalBlocksMap[key];
													const currentBlock = block;
													
													// Get normalized values for comparison
													const originalValue = getBlockValue(originalBlock);
													const currentValue = getBlockValue(currentBlock);
													
													// Compare the normalized values
													if (originalValue !== currentValue) {
														changedBlocks[key] = currentBlock;
													}
												}
											}
										}
									}
								} else {
									// If we don't have original blocks, send all current blocks
									if (updatedDepthBlocks) {
										for (const depthGroup of updatedDepthBlocks) {
											Object.assign(changedBlocks, depthGroup.blocks);
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
										
										// Synchronize only the changed blocks, not the entire file content
										SyncDetector.synchronizeBlockChanges(document.fileName, changedBlocks, filePaths);
									}
								} else if (batchAction === 'No' || batchAction === undefined) {
									// User selected "No" or closed the dialog
									// Nothing more to do, already updated current file and refreshed webview
								}
							} catch (error) {
								vscode.window.showErrorMessage('Error updating JSON: ' + error.message);
							}
							return;
						case 'reload':
							try {
								// Reload the document content
								const updatedDocument = await vscode.workspace.openTextDocument(document.uri);
								const updatedJsonContent = JSON.parse(updatedDocument.getText());
								const updatedDepthBlocks = JsonBlockParser.parseToDepthBlocks(updatedJsonContent);
								
								// Update the webview with new content
								panel.webview.postMessage({
									command: 'update',
									blocks: updatedDepthBlocks
								});
								
								// Update our version tracking
								documentVersion = updatedDocument.version;
								
								vscode.window.showInformationMessage('Document reloaded with latest changes');
							} catch (error) {
								vscode.window.showErrorMessage('Error reloading document: ' + error.message);
							}
							return;
					}
				},
				undefined,
				context.subscriptions
			);

		} catch (error) {
			vscode.window.showErrorMessage('Error processing JSON: ' + error.message);
		}
	});

	context.subscriptions.push(disposable);

	// Register the sync files command
	let syncDisposable = vscode.commands.registerCommand('vsfilemanager.syncFiles', async function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found!');
			return;
		}

		const document = editor.document;
		const filePath = document.fileName;

		// Find same-named files
		const sameNamedFiles = SyncDetector.findSameNamedFiles(filePath);

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
			
			// Get current document content and parse to blocks
			const content = document.getText();
			const jsonContent = JSON.parse(content);
			const blocks = JsonBlockParser.parseToBlocks(jsonContent);
			
			// Convert to the new block format to ensure compatibility
			const formattedBlocks = {};
			for (const key in blocks) {
				if (blocks.hasOwnProperty(key)) {
					const value = blocks[key];
					formattedBlocks[key] = {
						value: typeof value === 'string' ? `"${value}"` : value,
						type: typeof value,
						depth: 0,
						key: key,
						editable: true,
						originalType: typeof value
					};
				}
			}
			
			// Synchronize only the changed blocks, not the entire file content
			SyncDetector.synchronizeBlockChanges(filePath, formattedBlocks, filePaths);
		}
	});

	context.subscriptions.push(syncDisposable);
	
	// Register file save event listener for automatic sync detection
	vscode.workspace.onDidSaveTextDocument(async (document) => {
		// Only process JSON files
		if (path.extname(document.fileName) !== '.json') {
			return;
		}
		
		// Don't show any notifications or dialogs here
		// The webview's save flow handles synchronization prompts
		// This prevents interference with the correct workflow
	});
	
	// Register batch update command
	let batchUpdateDisposable = vscode.commands.registerCommand('vsfilemanager.batchUpdate', async function () {
		// Select files for batch update
		const filePaths = await BatchUpdater.selectFilesForBatchUpdate();
		if (!filePaths || filePaths.length === 0) {
			return;
		}
		
		// Ask for block changes
		const blockKey = await vscode.window.showInputBox({
			prompt: 'Enter block key to update (e.g., config.db.host)'
		});
		
		if (!blockKey) {
			return;
		}
		
		const blockValue = await vscode.window.showInputBox({
			prompt: 'Enter new value for the block'
		});
		
		if (blockValue === undefined) {
			return;
		}
		
		// Create blocks object with proper format
		const blocks = {};
		blocks[blockKey] = {
			value: blockValue,
			type: typeof blockValue,
			depth: 0,
			key: blockKey,
			editable: true,
			originalType: typeof blockValue
		};
		
		// Apply batch update
		await BatchUpdater.applyBatchUpdate(blocks, filePaths);
	});
	
	context.subscriptions.push(batchUpdateDisposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}