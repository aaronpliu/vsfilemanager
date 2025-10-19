const { FileTypeUtils } = require('../../src/utils/fileTypeUtils');

// Simple test to verify the testing framework is working
describe('BlockEditorHandler', () => {
  test('should be able to import FileTypeUtils', () => {
    expect(FileTypeUtils).toBeDefined();
  });
});