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
			
			// Create and show a webview panel
			const panel = vscode.window.createWebviewPanel(
				'jsonBlockEditor', // Identifies the type of the webview. Used internally
				'JSON Block Editor', // Title of the panel displayed to the user
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
			
			// Function to render blocks grouped by depth
			function renderBlocks() {
				const blockList = document.getElementById('blockList');
				blockList.innerHTML = '';
				
				// Find the depth group that matches the selected depth
				const selectedDepthGroup = currentBlocks.find(depthGroup => depthGroup.depth === maxDepth);
				
				if (selectedDepthGroup && Object.keys(selectedDepthGroup.blocks).length > 0) {
					const depthContainer = document.createElement('div');
					depthContainer.className = 'depth-group';
					
					const depthHeader = document.createElement('div');
					depthHeader.className = 'depth-header';
					const depthTitle = document.createElement('h3');
					depthTitle.textContent = 'Depth Level ' + selectedDepthGroup.depth;
					depthHeader.appendChild(depthTitle);
					depthContainer.appendChild(depthHeader);
					
					const blocksContainer = document.createElement('div');
					blocksContainer.className = 'depth-blocks';
					
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
						deleteBtn.textContent = '✕';
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
					
					depthContainer.appendChild(blocksContainer);
					blockList.appendChild(depthContainer);
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
						const depthGroup = currentBlocks.find(dg => dg.depth === depthIndex);
						if (depthGroup) {
							delete depthGroup.blocks[key];
							renderBlocks();
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
							input.removeAttribute('readonly');
							input.focus();
							e.target.textContent = 'Save';
						} else {
							input.setAttribute('readonly', 'readonly');
							// Update the value in our data structure
							const depthGroup = currentBlocks.find(dg => dg.depth === depthIndex);
							if (depthGroup && depthGroup.blocks[key]) {
								depthGroup.blocks[key].value = input.value;
							}
							e.target.textContent = 'Edit';
						}
					});
				});
				
				// Add event listeners to value inputs
				document.querySelectorAll('.block-value').forEach(input => {
					input.addEventListener('change', (e) => {
						const key = e.target.getAttribute('data-key');
						const depthIndex = parseInt(e.target.getAttribute('data-depth'));
						const depthGroup = currentBlocks.find(dg => dg.depth === depthIndex);
						if (depthGroup && depthGroup.blocks[key]) {
							depthGroup.blocks[key].value = e.target.value;
						}
					});
				});
			}
			
			// Initial render
			renderBlocks();
			
			// Handle Add Block button
			document.getElementById('addBlockBtn').addEventListener('click', () => {
				document.getElementById('newBlockForm').classList.remove('hidden');
			});
			
			// Handle Cancel Add button
			document.getElementById('cancelAddBtn').addEventListener('click', () => {
				document.getElementById('newBlockForm').classList.add('hidden');
				document.getElementById('newBlockKey').value = '';
				document.getElementById('newBlockValue').value = '';
			});
			
			// Handle Confirm Add button
			document.getElementById('confirmAddBtn').addEventListener('click', () => {
				const key = document.getElementById('newBlockKey').value.trim();
				const value = document.getElementById('newBlockValue').value;
				
				if (key) {
					// Add to first depth level (top level)
					if (!currentBlocks[0]) {
						currentBlocks[0] = { depth: 0, blocks: {} };
					}
					currentBlocks[0].blocks[key] = {
						value: value,
						type: typeof value,
						depth: 0,
						key: key,
						editable: true
					};
					renderBlocks();
					document.getElementById('newBlockForm').classList.add('hidden');
					document.getElementById('newBlockKey').value = '';
					document.getElementById('newBlockValue').value = '';
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
						// Remove quotes from string values if they exist
						let value = block.value;
						if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
							value = value.substring(1, value.length - 1);
						}
						flattenedBlocks[key] = value;
					}
				});
				
				vscode.postMessage({
					command: 'save',
					blocks: flattenedBlocks
				});
			});
			
			// Handle messages from the extension
			window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'update':
						currentBlocks = JSON.parse(JSON.stringify(message.blocks));
						renderBlocks();
						break;
				}
			});
			</script>`;
			
			// Add depth selector to the HTML
			htmlContent = htmlContent.replace(
				'<p>Edit individual JSON blocks using dot notation paths</p>',
				'<p>Edit individual JSON blocks using dot notation paths</p>'
			);
			
			panel.webview.html = htmlContent.replace(
				'// SCRIPT_PLACEHOLDER',
				scriptContent.replace('<script>', '').replace('</script>', '')
			);
			
			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				async message => {
					switch (message.command) {
						case 'save':
							try {
								// Convert blocks back to JSON
								const updatedJson = JsonBlockParser.blocksToJson(message.blocks);
								
								// Update the document
								const edit = new vscode.WorkspaceEdit();
								const fullRange = new vscode.Range(
									document.positionAt(0),
									document.positionAt(document.getText().length)
								);
								edit.replace(document.uri, fullRange, JSON.stringify(updatedJson, null, 2));
								
								// Apply the edit
								await vscode.workspace.applyEdit(edit);
								
								// Ask if user wants to apply batch update
								const batchAction = await vscode.window.showInformationMessage(
									'Changes saved successfully! Would you like to apply these changes to other files?',
									'Batch Update',
									'Cancel'
								);
								
								if (batchAction === 'Batch Update') {
									const batchResult = await BatchUpdater.showBatchUpdateDialog(message.blocks);
									if (batchResult) {
										await BatchUpdater.applyBatchUpdate(batchResult.blocks, batchResult.filePaths);
									}
								} else {
									vscode.window.showInformationMessage('JSON blocks updated successfully!');
								}
							} catch (error) {
								vscode.window.showErrorMessage('Error updating JSON: ' + error.message);
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

		// Prompt user for sync
		const shouldSync = await SyncDetector.promptForSync(filePath, sameNamedFiles);

		if (shouldSync) {
			// Get current document content
			const content = document.getText();
			
			// Synchronize files
			SyncDetector.synchronizeFiles(filePath, content, sameNamedFiles);
		}
	});

	context.subscriptions.push(syncDisposable);
	
	// Register file save event listener for automatic sync detection
	vscode.workspace.onDidSaveTextDocument(async (document) => {
		// Only process JSON files
		if (path.extname(document.fileName) !== '.json') {
			return;
		}
		
		// Find same-named files
		const sameNamedFiles = SyncDetector.findSameNamedFiles(document.fileName);
		
		if (sameNamedFiles.length > 0) {
			// Prompt user for sync
			const shouldSync = await SyncDetector.promptForSync(document.fileName, sameNamedFiles);
			
			if (shouldSync) {
				// Get current document content
				const content = document.getText();
				
				// Synchronize files
				SyncDetector.synchronizeFiles(document.fileName, content, sameNamedFiles);
			}
		}
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
		
		// Create blocks object
		const blocks = {};
		blocks[blockKey] = blockValue;
		
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