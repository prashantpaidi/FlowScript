import { describe, it, expect } from 'bun:test';
import { VariableResolver } from './variableResolver';
import { WorkflowContext } from '../environment';

describe('VariableResolver', () => {
  const context: WorkflowContext = {
    nodes: {
      'Scraper': {
        'price': '$100',
        'details': {
          'brand': 'Acme',
          'rating': 4.5
        }
      }
    },
    trigger: {
      'url': 'https://example.com',
      'user': {
        'name': 'John Doe'
      }
    },
    env: {
      url: 'https://current.url',
      browser: 'Chrome',
      platform: 'MacIntel'
    }
  };

  describe('resolveString', () => {
    it('should resolve system variables', () => {
      expect(VariableResolver.resolveString('{{$sys.url}}', context)).toBe('https://current.url');
      expect(VariableResolver.resolveString('{{$sys.browser}}', context)).toBe('Chrome');
      expect(VariableResolver.resolveString('{{$sys.platform}}', context)).toBe('MacIntel');
      expect(VariableResolver.resolveString('{{$sys.date}}', context)).toMatch(/\d+/);
    });

    it('should resolve trigger variables', () => {
      expect(VariableResolver.resolveString('{{$trigger.url}}', context)).toBe('https://example.com');
      expect(VariableResolver.resolveString('{{$trigger.user.name}}', context)).toBe('John Doe');
    });

    it('should resolve node variables', () => {
      expect(VariableResolver.resolveString('{{$node.Scraper.price}}', context)).toBe('$100');
      expect(VariableResolver.resolveString('{{$node.Scraper.details.brand}}', context)).toBe('Acme');
    });

    it('should handle missing variables by keeping the placeholder', () => {
      expect(VariableResolver.resolveString('{{$node.Missing.key}}', context)).toBe('{{$node.Missing.key}}');
    });

    it('should handle mixed content', () => {
      expect(VariableResolver.resolveString('Price is {{$node.Scraper.price}} at {{$trigger.url}}', context))
        .toBe('Price is $100 at https://example.com');
    });
  });

  describe('resolveDeep', () => {
    it('should resolve variables in nested objects', () => {
      const input = {
        config: {
          url: '{{$trigger.url}}',
          timeout: 5000
        },
        items: [
          '{{$node.Scraper.price}}',
          'static'
        ]
      };

      const expected = {
        config: {
          url: 'https://example.com',
          timeout: 5000
        },
        items: [
          '$100',
          'static'
        ]
      };

      expect(VariableResolver.resolveDeep(input, context)).toEqual(expected);
    });
  });

  describe('Enhanced Resolution', () => {
    const context: WorkflowContext = {
      nodes: {
        'node_123': { // Node ID
          data: { val: 'Result1' }
        },
        'Scraper': { // Alias
          data: { price: '$99' },
          other: 'metadata'
        }
      },
      trigger: {},
      env: { url: '', browser: '', platform: '' }
    };

    it('should resolve via Node ID if alias is not used', () => {
      expect(VariableResolver.resolveString('{{$node.node_123.data.val}}', context)).toBe('Result1');
    });

    it('should support Smart Data Flattening (skip .data.)', () => {
      // Scraper has data.price, we access it via Scraper.price
      expect(VariableResolver.resolveString('{{$node.Scraper.price}}', context)).toBe('$99');
    });

    it('should still allow explicit .data. access', () => {
      expect(VariableResolver.resolveString('{{$node.Scraper.data.price}}', context)).toBe('$99');
    });

    it('should prioritize top-level keys over .data fallback', () => {
      // 'other' is at the top level
      expect(VariableResolver.resolveString('{{$node.Scraper.other}}', context)).toBe('metadata');
    });
  });
});
