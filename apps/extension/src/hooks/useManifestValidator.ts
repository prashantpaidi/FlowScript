import { useState, useCallback } from 'react';
import { validateManifest } from '@flowscript/schema';

export function useManifestValidator() {
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = useCallback((jsonCode: string) => {
    try {
      const parsed = JSON.parse(jsonCode);
      const validated = validateManifest(parsed);
      setValidationError(null);
      return validated;
    } catch (err: any) {
      const msg = 'Invalid schema: ' + (err.errors?.[0]?.message || err.message);
      setValidationError(msg);
      return null;
    }
  }, []);

  return {
    validationError,
    setValidationError,
    validate,
  };
}
