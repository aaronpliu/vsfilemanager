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
   - Create a PAT with ` Marketplace (publish)` scope

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