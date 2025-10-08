// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const BlockEditorHandler = require('./src/handlers/blockEditorHandler');
const SyncFilesHandler = require('./src/handlers/syncFilesHandler');
const BatchUpdateHandler = require('./src/handlers/batchUpdateHandler');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vsfilemanager" is now active!');

	try {
		// The command has been defined in the package.json file
		// Now provide the implementation of the command with  registerCommand
		// The commandId parameter must match the command field in package.json
		let disposable = vscode.commands.registerCommand('vsfilemanager.editStructuredBlocks', async function () {
			// The code you place here will be executed every time your command is executed
			console.log('vsfilemanager.editStructuredBlocks command executed');
			const editor = vscode.window.activeTextEditor;
			await BlockEditorHandler.openEditor(context, editor);
		});

		context.subscriptions.push(disposable);

		// Register the sync files command
		let syncDisposable = vscode.commands.registerCommand('vsfilemanager.syncFiles', async function () {
			console.log('vsfilemanager.syncFiles command executed');
			await SyncFilesHandler.syncFiles();
		});

		context.subscriptions.push(syncDisposable);
		
		// Register batch update command
		let batchUpdateDisposable = vscode.commands.registerCommand('vsfilemanager.batchUpdate', async function () {
			console.log('vsfilemanager.batchUpdate command executed');
			await BatchUpdateHandler.batchUpdate();
		});
		
		context.subscriptions.push(batchUpdateDisposable);
		
		// Register file save event listener for automatic sync detection
		vscode.workspace.onDidSaveTextDocument(async (document) => {
			// Only process supported file types
			const fileExtension = path.extname(document.fileName).toLowerCase();
			if (fileExtension !== '.json' && fileExtension !== '.yaml' && fileExtension !== '.yml' &&
				fileExtension !== '.xml' && fileExtension !== '.toml') {
				return;
			}
			
			// Don't show any notifications or dialogs here
			// The webview's save flow handles synchronization prompts
			// This prevents interference with the correct workflow
		});
		
		console.log('All commands registered successfully');
	} catch (error) {
		console.error('Error registering commands:', error);
	}
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}