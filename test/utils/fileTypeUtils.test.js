const { FileTypeUtils } = require('../../src/utils/fileTypeUtils');

describe('FileTypeUtils', () => {
  describe('isSupportedFileType', () => {
    test('should return true for supported file types', () => {
      expect(FileTypeUtils.isSupportedFileType('.json')).toBe(true);
      expect(FileTypeUtils.isSupportedFileType('.yaml')).toBe(true);
      expect(FileTypeUtils.isSupportedFileType('.yml')).toBe(true);
      expect(FileTypeUtils.isSupportedFileType('.xml')).toBe(true);
      expect(FileTypeUtils.isSupportedFileType('.toml')).toBe(true);
    });

    test('should return false for unsupported file types', () => {
      expect(FileTypeUtils.isSupportedFileType('.txt')).toBe(false);
      expect(FileTypeUtils.isSupportedFileType('.js')).toBe(false);
    });

    test('should be case insensitive', () => {
      expect(FileTypeUtils.isSupportedFileType('.JSON')).toBe(true);
      expect(FileTypeUtils.isSupportedFileType('.YAML')).toBe(true);
      expect(FileTypeUtils.isSupportedFileType('.Yml')).toBe(true);
    });
  });

  describe('getParser', () => {
    test('should return a parser for supported file types', () => {
      expect(FileTypeUtils.getParser('.json')).not.toBeNull();
      expect(FileTypeUtils.getParser('.yaml')).not.toBeNull();
      expect(FileTypeUtils.getParser('.yml')).not.toBeNull();
      expect(FileTypeUtils.getParser('.xml')).not.toBeNull();
      expect(FileTypeUtils.getParser('.toml')).not.toBeNull();
    });

    test('should return null for unsupported file types', () => {
      expect(FileTypeUtils.getParser('.txt')).toBeNull();
      expect(FileTypeUtils.getParser('.js')).toBeNull();
    });
  });

  describe('getFileTypeName', () => {
    test('should return correct type names for supported file types', () => {
      expect(FileTypeUtils.getFileTypeName('.json')).toBe('JSON');
      expect(FileTypeUtils.getFileTypeName('.yaml')).toBe('YAML');
      expect(FileTypeUtils.getFileTypeName('.yml')).toBe('YAML');
      expect(FileTypeUtils.getFileTypeName('.xml')).toBe('XML');
      expect(FileTypeUtils.getFileTypeName('.toml')).toBe('TOML');
    });

    test('should return "Unknown" for unsupported file types', () => {
      expect(FileTypeUtils.getFileTypeName('.txt')).toBe('Unknown');
      expect(FileTypeUtils.getFileTypeName('.js')).toBe('Unknown');
    });
  });

  describe('getEmptyContent', () => {
    test('should return correct empty content for supported file types', () => {
      expect(FileTypeUtils.getEmptyContent('.json')).toBe('{}');
      expect(FileTypeUtils.getEmptyContent('.yaml')).toBe('{}');
      expect(FileTypeUtils.getEmptyContent('.yml')).toBe('{}');
      expect(FileTypeUtils.getEmptyContent('.toml')).toBe('{}');
      expect(FileTypeUtils.getEmptyContent('.xml')).toBe('<root></root>');
    });

    test('should return empty string for unsupported file types', () => {
      expect(FileTypeUtils.getEmptyContent('.txt')).toBe('');
      expect(FileTypeUtils.getEmptyContent('.js')).toBe('');
    });
  });

  describe('getSupportedExtensions', () => {
    test('should return all supported extensions', () => {
      const extensions = FileTypeUtils.getSupportedExtensions();
      expect(extensions).toContain('.json');
      expect(extensions).toContain('.yaml');
      expect(extensions).toContain('.yml');
      expect(extensions).toContain('.xml');
      expect(extensions).toContain('.toml');
      // Use >= in case more extensions are added in the future
      expect(extensions.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('validateFile', () => {
    test('should validate supported file paths', () => {
      const result = FileTypeUtils.validateFile('/path/to/file.json');
      expect(result.isValid).toBe(true);
      expect(result.fileExtension).toBe('.json');
      expect(result.typeName).toBe('JSON');
    });

    test('should not validate unsupported file paths', () => {
      const result = FileTypeUtils.validateFile('/path/to/file.txt');
      expect(result.isValid).toBe(false);
      expect(result.fileExtension).toBe('.txt');
      expect(result.typeName).toBe('Unknown');
    });
  });
});