const fs = require('fs');
const path = require('path');
const JsonBlockParser = require('../src/parser/jsonBlockParser');

console.log('=== DEBUG BATCH UPDATE ISSUE ===\n');

// Create a test that exactly replicates the webview behavior
const sourceFile = path.join(__dirname, 'source.json');
const targetFile = path.join(__dirname, 'target.json');

// Original file loaded in webview
const originalData = {
  "config": {
    "database": {
      "host": "localhost",
      "port": 5432
    },
    "api": {
      "version": "v1",
      "key": "secret1"
    }
  },
  "app": "editorApp",
  "version": "1.0.0"
};

// What user actually edited (only database.host)
const editedData = {
  "config": {
    "database": {
      "host": "newhost",  // Only this changed
      "port": 5432
    },
    "api": {
      "version": "v1",
      "key": "secret1"
    }
  },
  "app": "editorApp",
  "version": "1.0.0"
};

// Target same-named file with different content
const targetData = {
  "config": {
    "database": {
      "host": "remotehost", // Should become "newhost"
      "port": 3306          // Should remain 3306
    },
    "api": {
      "version": "v2",      // Should remain "v2"
      "key": "secret2"      // Should remain "secret2"
    }
  },
  "app": "targetApp",       // Should remain "targetApp"
  "version": "2.0.0",       // Should remain "2.0.0"
  "unique": "preserveMe"    // Should remain "preserveMe"
};

fs.writeFileSync(sourceFile, JSON.stringify(originalData, null, 2));
fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2));

console.log('1. ORIGINAL STATE');
console.log('Original data (loaded in webview):');
console.log(JSON.stringify(originalData, null, 2));

console.log('\nEdited data (after user changes):');
console.log(JSON.stringify(editedData, null, 2));

console.log('\nTarget file (same-named file to sync):');
console.log(JSON.stringify(targetData, null, 2));

// Simulate webview behavior - parse to depth blocks
const originalDepthBlocks = JsonBlockParser.parseToDepthBlocks(originalData);
const editedDepthBlocks = JsonBlockParser.parseToDepthBlocks(editedData);

console.log('\n2. DEPTH BLOCKS');
console.log('Original depth blocks:');
originalDepthBlocks.forEach(group => {
  console.log(`  Depth ${group.depth}:`, Object.keys(group.blocks));
});

console.log('\nEdited depth blocks:');
editedDepthBlocks.forEach(group => {
  console.log(`  Depth ${group.depth}:`, Object.keys(group.blocks));
});

// Simulate what webview sends when saving - ALL current blocks
const webviewBlocks = {};
editedDepthBlocks.forEach(depthGroup => {
  for (const key in depthGroup.blocks) {
    if (depthGroup.blocks.hasOwnProperty(key)) {
      webviewBlocks[key] = depthGroup.blocks[key];
    }
  }
});

console.log('\n3. WEBVIEW SENDS ALL BLOCKS');
console.log('Webview sends these blocks:');
Object.keys(webviewBlocks).sort().forEach(key => {
  console.log(`  ${key}:`, webviewBlocks[key].value);
});

// Simulate what extension does - compare with original to find changes
const originalBlocksMap = {};
originalDepthBlocks.forEach(depthGroup => {
  for (const key in depthGroup.blocks) {
    if (depthGroup.blocks.hasOwnProperty(key)) {
      originalBlocksMap[key] = depthGroup.blocks[key];
    }
  }
});

// Find actual changes
const actualChanges = {};
for (const key in webviewBlocks) {
  if (webviewBlocks.hasOwnProperty(key)) {
    const currentBlock = webviewBlocks[key];
    
    if (!originalBlocksMap[key]) {
      // New block
      actualChanges[key] = currentBlock;
      console.log(`New block: ${key}`);
    } else {
      // Compare with original
      const originalBlock = originalBlocksMap[key];
      
      // Normalize for comparison
      function normalize(block) {
        if (typeof block.value === 'string' && 
            block.originalType === 'string' &&
            block.value.startsWith('"') && 
            block.value.endsWith('"')) {
          return block.value.substring(1, block.value.length - 1);
        }
        return block.value;
      }
      
      const origValue = normalize(originalBlock);
      const currValue = normalize(currentBlock);
      
      if (origValue !== currValue) {
        actualChanges[key] = currentBlock;
        console.log(`Changed block: ${key} (${origValue} -> ${currValue})`);
      }
    }
  }
}

console.log('\n4. ACTUAL CHANGES IDENTIFIED');
console.log('Extension identifies these changes:');
Object.keys(actualChanges).sort().forEach(key => {
  console.log(`  ${key}:`, actualChanges[key].value);
});

// Apply to target file
console.log('\n5. APPLYING TO TARGET FILE');
const targetContent = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
console.log('Target before update:');
console.log(JSON.stringify(targetContent, null, 2));

const result = JsonBlockParser.applyOnlyChangedBlocks(targetContent, actualChanges);
console.log('\nTarget after update:');
console.log(JSON.stringify(result, null, 2));

// Verification
console.log('\n6. VERIFICATION');
const checks = [
  {name: 'database.host changed to "newhost"', result: result.config.database.host === 'newhost'},
  {name: 'database.port preserved as 3306', result: result.config.database.port === 3306},
  {name: 'api.version preserved as "v2"', result: result.config.api.version === 'v2'},
  {name: 'api.key preserved as "secret2"', result: result.config.api.key === 'secret2'},
  {name: 'app preserved as "targetApp"', result: result.app === 'targetApp'},
  {name: 'version preserved as "2.0.0"', result: result.version === '2.0.0'},
  {name: 'unique field preserved as "preserveMe"', result: result.unique === 'preserveMe'}
];

let allPassed = true;
checks.forEach(check => {
  console.log(`  ${check.result ? '✓' : '✗'} ${check.name}`);
  if (!check.result) allPassed = false;
});

console.log(`\nAll checks passed: ${allPassed}`);

// Clean up
fs.unlinkSync(sourceFile);
fs.unlinkSync(targetFile);
console.log('\n7. CLEANUP COMPLETE');