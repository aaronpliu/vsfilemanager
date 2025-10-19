const JsonBlockParser = require('../../src/parser/jsonBlockParser');

describe('JsonBlockParser', () => {
  describe('parseToBlocks', () => {
    test('should parse simple key-value pairs', () => {
      const jsonObject = { name: 'John', age: 30 };
      const blocks = JsonBlockParser.parseToBlocks(jsonObject);
      
      expect(blocks).toHaveProperty('name');
      expect(blocks).toHaveProperty('age');
      expect(blocks.name.value).toBe('"John"');
      expect(blocks.name.originalType).toBe('string');
      expect(blocks.age.value).toBe(30);
      expect(blocks.age.originalType).toBe('number');
    });

    test('should parse nested objects', () => {
      const jsonObject = { 
        user: { 
          name: 'John', 
          address: { 
            city: 'New York' 
          } 
        } 
      };
      const blocks = JsonBlockParser.parseToBlocks(jsonObject);
      
      // Using a different approach to check for properties
      expect(blocks.hasOwnProperty('user.name')).toBe(true);
      expect(blocks.hasOwnProperty('user.address.city')).toBe(true);
      expect(blocks['user.name'].value).toBe('"John"');
      expect(blocks['user.address.city'].value).toBe('"New York"');
    });

    test('should parse arrays', () => {
      const jsonObject = { 
        hobbies: ['reading', 'swimming'] 
      };
      const blocks = JsonBlockParser.parseToBlocks(jsonObject);
      
      expect(blocks.hasOwnProperty('hobbies')).toBe(true);
      expect(blocks.hobbies.originalType).toBe('array');
      expect(typeof blocks.hobbies.value).toBe('string'); // Should be stringified array
    });

    test('should parse arrays with objects', () => {
      const jsonObject = { 
        users: [
          { name: 'John' },
          { name: 'Jane' }
        ] 
      };
      const blocks = JsonBlockParser.parseToBlocks(jsonObject);
      
      expect(blocks.hasOwnProperty('users[0]')).toBe(true);
      expect(blocks.hasOwnProperty('users[1]')).toBe(true);
      expect(blocks.hasOwnProperty('users[0].name')).toBe(true);
      expect(blocks.hasOwnProperty('users[1].name')).toBe(true);
      expect(blocks['users[0].name'].value).toBe('"John"');
      expect(blocks['users[1].name'].value).toBe('"Jane"');
    });
  });

  describe('parseToDepthBlocks', () => {
    test('should group blocks by depth', () => {
      const jsonObject = { 
        user: { 
          name: 'John', 
          address: { 
            city: 'New York' 
          } 
        } 
      };
      const depthBlocks = JsonBlockParser.parseToDepthBlocks(jsonObject);
      
      // Should have blocks grouped by depth
      expect(Array.isArray(depthBlocks)).toBe(true);
      expect(depthBlocks.length).toBeGreaterThan(0);
      
      // Check that blocks are properly grouped by depth
      const depth0Blocks = depthBlocks.find(group => group.depth === 0);
      const depth1Blocks = depthBlocks.find(group => group.depth === 1);
      const depth2Blocks = depthBlocks.find(group => group.depth === 2);
      
      expect(depth0Blocks).toBeDefined();
      expect(depth1Blocks).toBeDefined();
      expect(depth2Blocks).toBeDefined();
      
      // Check specific blocks at each depth using hasOwnProperty
      expect(depth0Blocks.blocks.hasOwnProperty('user')).toBe(true);
      expect(depth1Blocks.blocks.hasOwnProperty('user.name')).toBe(true);
      expect(depth1Blocks.blocks.hasOwnProperty('user.address')).toBe(true);
      expect(depth2Blocks.blocks.hasOwnProperty('user.address.city')).toBe(true);
    });
  });
});