import { describe, it, expect } from 'vitest';
import { coerceValue } from './coercion';

describe('coerceValue', () => {
  describe('text', () => {
    it('should coerce simple values to strings', () => {
      expect(coerceValue('hello', 'text')).toEqual({ success: true, value: 'hello' });
      expect(coerceValue(123, 'text')).toEqual({ success: true, value: '123' });
      expect(coerceValue(true, 'text')).toEqual({ success: true, value: 'true' });
    });

    it('should serialize objects/arrays', () => {
      expect(coerceValue({ a: 1 }, 'text')).toEqual({ success: true, value: '{"a":1}' });
      expect(coerceValue([1, 2], 'text')).toEqual({ success: true, value: '[1,2]' });
    });
  });

  describe('number', () => {
    it('should pass-through valid numbers', () => {
      expect(coerceValue(42, 'number')).toEqual({ success: true, value: 42 });
      expect(coerceValue(3.14, 'number')).toEqual({ success: true, value: 3.14 });
    });

    it('should parse valid number strings', () => {
      expect(coerceValue(' 123.45 ', 'number')).toEqual({ success: true, value: 123.45 });
      expect(coerceValue('-99', 'number')).toEqual({ success: true, value: -99 });
    });

    it('should extract numbers from formatted text', () => {
      expect(coerceValue('$1,250.99', 'number')).toEqual({ success: true, value: 1250.99 });
      expect(coerceValue('45px', 'number')).toEqual({ success: true, value: 45 });
      expect(coerceValue('   -1.5% ', 'number')).toEqual({ success: true, value: -1.5 });
    });

    it('should fail for completely invalid strings', () => {
      expect(coerceValue('abc', 'number').success).toBe(false);
      expect(coerceValue('pending', 'number').success).toBe(false);
    });
  });

  describe('boolean', () => {
    it('should pass-through booleans', () => {
      expect(coerceValue(true, 'boolean')).toEqual({ success: true, value: true });
      expect(coerceValue(false, 'boolean')).toEqual({ success: true, value: false });
    });

    it('should parse true-like values', () => {
      expect(coerceValue('true', 'boolean')).toEqual({ success: true, value: true });
      expect(coerceValue('yes', 'boolean')).toEqual({ success: true, value: true });
      expect(coerceValue('1', 'boolean')).toEqual({ success: true, value: true });
      expect(coerceValue('checked', 'boolean')).toEqual({ success: true, value: true });
    });

    it('should parse false-like values', () => {
      expect(coerceValue('false', 'boolean')).toEqual({ success: true, value: false });
      expect(coerceValue('no', 'boolean')).toEqual({ success: true, value: false });
      expect(coerceValue('0', 'boolean')).toEqual({ success: true, value: false });
      expect(coerceValue('off', 'boolean')).toEqual({ success: true, value: false });
    });

    it('should fail for invalid booleans', () => {
      expect(coerceValue('pending', 'boolean').success).toBe(false);
    });
  });

  describe('date', () => {
    it('should parse ISO date strings', () => {
      expect(coerceValue('2026-06-03', 'date')).toEqual({ success: true, value: '2026-06-03' });
    });

    it('should format Date objects to YYYY-MM-DD', () => {
      const date = new Date(2026, 5, 3); // Month is 0-indexed (June = 5)
      expect(coerceValue(date, 'date')).toEqual({ success: true, value: '2026-06-03' });
    });

    it('should fail for invalid dates', () => {
      expect(coerceValue('not-a-date', 'date').success).toBe(false);
    });
  });

  describe('select', () => {
    const options = ['active', 'inactive', 'pending'];

    it('should succeed for matching option', () => {
      expect(coerceValue('active', 'select', options)).toEqual({ success: true, value: 'active' });
    });

    it('should fail for non-matching option', () => {
      expect(coerceValue('deleted', 'select', options)).toEqual({ success: false, value: 'deleted', error: 'Value "deleted" is not one of the allowed options' });
    });

    it('should succeed if no options configured', () => {
      expect(coerceValue('anything', 'select')).toEqual({ success: true, value: 'anything' });
    });
  });

  describe('multiselect', () => {
    const options = ['apple', 'banana', 'cherry'];

    it('should parse array values', () => {
      expect(coerceValue(['apple', 'banana'], 'multiselect', options)).toEqual({ success: true, value: ['apple', 'banana'] });
    });

    it('should parse JSON strings', () => {
      expect(coerceValue('["apple", "cherry"]', 'multiselect', options)).toEqual({ success: true, value: ['apple', 'cherry'] });
    });

    it('should parse comma-separated lists', () => {
      expect(coerceValue('apple, banana', 'multiselect', options)).toEqual({ success: true, value: ['apple', 'banana'] });
    });

    it('should fail if any value is not in options', () => {
      expect(coerceValue('apple, grape', 'multiselect', options).success).toBe(false);
    });
  });
});
