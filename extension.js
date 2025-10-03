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
			const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
			
			// Set the webview's html content
			const scriptContent = `
			<script>
			const vscode = acquireVsCodeApi();
			
			// Store the original blocks
			const originalBlocks = ${JSON.stringify(depthBlocks)};
			let currentBlocks = JSON.parse(JSON.stringify(originalBlocks));
			
			// Function to render blocks grouped by depth
			function renderBlocks() {
				const blockList = document.getElementById('blockList');
				blockList.innerHTML = '';
				
				currentBlocks.forEach((depthGroup, index) => {
					if (Object.keys(depthGroup.blocks).length === 0) return;
					
					const depthContainer = document.createElement('div');
					depthContainer.className = 'depth-group';
					depthContainer.innerHTML = \`
						<div class="depth-header">
							<h3>Depth Level \${depthGroup.depth}</h3>
						</div>
						<div class="depth-blocks"></div>
					\`;
					
					const blocksContainer = depthContainer.querySelector('.depth-blocks');
					
					for (const [key, block] of Object.entries(depthGroup.blocks)) {
						const blockItem = document.createElement('div');
						blockItem.className = 'block-item';
						blockItem.innerHTML = \`
							<div>
								<div class="block-header">
									<div class="block-key">\${key}</div>
									<button class="delete-btn" data-key="\${key}" data-depth="\${index}">✕</button>
								</div>
								<div class="block-value-container">
									\${block.editable ? 
									  \`<input type="text" class="block-value" data-key="\${key}" data-depth="\${index}" value="\${block.value}" readonly>\` : 
									  \`<div class="block-value-readonly">\${block.value}</div>\` }
									\${block.editable ? 
									  \`<button class="edit-toggle-btn" data-key="\${key}" data-depth="\${index}">Edit</button>\` : 
									  '' }
								</div>
								<div class="block-info">
									<small>Depth: \${block.depth}</small>
								</div>
							</div>
						\`;
						blocksContainer.appendChild(blockItem);
					}
					
					blockList.appendChild(depthContainer);
				});
				
				// Add event listeners to delete buttons
				document.querySelectorAll('.delete-btn').forEach(button => {
					button.addEventListener('click', (e) => {
						const key = e.target.getAttribute('data-key');
						const depthIndex = parseInt(e.target.getAttribute('data-depth'));
						delete currentBlocks[depthIndex].blocks[key];
						renderBlocks();
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
							currentBlocks[depthIndex].blocks[key].value = input.value;
							e.target.textContent = 'Edit';
						}
					});
				});
				
				// Add event listeners to value inputs
				document.querySelectorAll('.block-value').forEach(input => {
					input.addEventListener('change', (e) => {
						const key = e.target.getAttribute('data-key');
						const depthIndex = parseInt(e.target.getAttribute('data-depth'));
						currentBlocks[depthIndex].blocks[key].value = e.target.value;
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