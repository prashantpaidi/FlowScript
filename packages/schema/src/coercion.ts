import { ColumnType } from './types';

export interface CoercionResult {
  success: boolean;
  value: any;
  error?: string;
}

export function coerceValue(value: any, columnType: ColumnType, options?: string[]): CoercionResult {
  if (value === null || value === undefined || value === '') {
    if (columnType === 'boolean') {
      return { success: true, value: false };
    }
    if (columnType === 'multiselect') {
      return { success: true, value: [] };
    }
    return { success: true, value: null };
  }

  switch (columnType) {
    case 'text':
      return { success: true, value: typeof value === 'object' ? JSON.stringify(value) : String(value) };

    case 'number': {
      if (typeof value === 'number') {
        return { success: true, value };
      }
      const valStr = String(value).trim();
      const parsed = Number(valStr);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return { success: true, value: parsed };
      }
      // Attempt to extract digits/decimals if it contains prefix/suffix (e.g. "$120" -> 120)
      const cleaned = valStr.replace(/[^\d.-]/g, '');
      const parsedFloat = parseFloat(cleaned);
      if (!isNaN(parsedFloat) && isFinite(parsedFloat)) {
        return { success: true, value: parsedFloat };
      }
      return { success: false, value, error: `Value "${value}" is not a valid number` };
    }

    case 'boolean': {
      if (typeof value === 'boolean') {
        return { success: true, value };
      }
      const str = String(value).toLowerCase().trim();
      if (str === 'true' || str === 'yes' || str === '1' || str === 'checked' || str === 'on') {
        return { success: true, value: true };
      }
      if (str === 'false' || str === 'no' || str === '0' || str === 'unchecked' || str === 'off') {
        return { success: true, value: false };
      }
      return { success: false, value, error: `Value "${value}" is not a valid boolean` };
    }

    case 'date': {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          return { success: false, value, error: 'Invalid Date' };
        }
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return { success: true, value: `${y}-${m}-${d}` };
      }
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return { success: true, value: value.trim() };
      }
      const parsedDate = new Date(value);
      if (!isNaN(parsedDate.getTime())) {
        const y = parsedDate.getFullYear();
        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const d = String(parsedDate.getDate()).padStart(2, '0');
        return { success: true, value: `${y}-${m}-${d}` };
      }
      return { success: false, value, error: `Value "${value}" is not a valid date` };
    }

    case 'select': {
      const valStr = String(value).trim();
      if (options && options.length > 0) {
        if (options.includes(valStr)) {
          return { success: true, value: valStr };
        }
        return { success: false, value: valStr, error: `Value "${valStr}" is not one of the allowed options` };
      }
      return { success: true, value: valStr };
    }

    case 'multiselect': {
      let arr: string[] = [];
      if (Array.isArray(value)) {
        arr = value.map(v => String(v).trim());
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            arr = Array.isArray(parsed) ? parsed.map(v => String(v).trim()) : [trimmed];
          } catch {
            arr = trimmed.split(',').map(v => v.trim()).filter(Boolean);
          }
        } else {
          arr = trimmed.split(',').map(v => v.trim()).filter(Boolean);
        }
      } else {
        arr = [String(value).trim()];
      }

      if (options && options.length > 0) {
        const invalid = arr.filter(v => !options.includes(v));
        if (invalid.length > 0) {
          return { success: false, value: arr, error: `Values ${JSON.stringify(invalid)} are not in the allowed options` };
        }
      }
      return { success: true, value: arr };
    }

    default:
      return { success: true, value };
  }
}
