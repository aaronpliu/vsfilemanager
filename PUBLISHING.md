# Publishing the Extension

This document explains how to build and publish the VS File Manager extension to the Visual Studio Code Marketplace.

## Prerequisites

Before you can publish the extension, you'll need:

1. Visual Studio Code Extension Manager (vsce) installed:
   ```
   npm install -g vsce
   ```

2. An Azure DevOps organization and personal access token (PAT) with the appropriate permissions:
   - Create an organization at [Azure DevOps](https://azure.microsoft.com/services/devops/)
   - Create a PAT with `Marketplace (publish)` scope
   - When creating the PAT:
     - Set Organization to "All accessible organizations"
     - Set Scopes to "Full access" or at minimum select "Marketplace (publish)"

3. A publisher ID in the Visual Studio Code Marketplace:
   - Create one at the [Marketplace management page](https://marketplace.visualstudio.com/manage)

## Building the Extension

1. Install dependencies:
   ```
   npm install
   ```

2. Package the extension into a .vsix file:
   ```
   vsce package
   ```

   This will create a `.vsix` file in the root directory with a name like `vsfilemanager-0.0.1.vsix`.

## Publishing the Extension

### Manual Publishing

1. Login with your PAT:
   ```
   vsce login YOUR_PUBLISHER_NAME
   ```

2. Publish the extension:
   ```
   vsce publish
   ```

   This will automatically use the version from package.json. If you want to publish with a specific version:
   ```
   vsce publish 0.0.1
   ```

### Automated Publishing with GitHub Actions

The extension includes a GitHub Actions workflow (`.github/workflows/publish.yml`) that automatically publishes when you push a tag starting with "v".

To use this workflow:

1. Create a personal access token as described above
2. Add it as a secret named `VSCE_PAT` in your GitHub repository settings:
   - Go to your repository's Settings
   - Click "Secrets and variables" > "Actions"
   - Click "New repository secret"
   - Name it `VSCE_PAT` and paste your token
3. Create and push a tag:
   ```
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Troubleshooting

### TF400813: The user is not authorized to access this resource

This error typically occurs when:

1. The PAT is expired - create a new one
2. The PAT doesn't have the correct scopes - ensure it has "Marketplace (publish)" permissions
3. The PAT organization is not set to "All accessible organizations"
4. The PAT was copied incorrectly

### Failed to open credential store

This warning is harmless and occurs in CI environments. The system falls back to storing secrets in clear-text, which is acceptable in CI environments.

## Creating Icon Assets

For marketplace publishing, you need PNG icons in multiple sizes:
- 128x128 pixels
- 256x256 pixels

Currently, placeholder files exist in the `media/icons` directory. Replace these with actual PNG conversions of `media/icon.svg`.

## Marketplace Content Guidelines

Ensure your extension follows the [Visual Studio Code Marketplace Content Guidelines](https://code.visualstudio.com/api/references/extension-manifest).

## Versioning

Follow semantic versioning (SemVer) for your releases:
- MAJOR version for incompatible API changes
- MINOR version for functionality added in a backwards compatible manner
- PATCH version for backwards compatible bug fixes

Update the version in `package.json` before publishing a new version.