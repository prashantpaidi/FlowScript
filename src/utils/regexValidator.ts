/**
 * Safely tests if a regex string is valid.
 * @param pattern The regex pattern string to test.
 * @returns true if valid, false otherwise.
 */
export function isValidRegex(pattern: string): boolean {
  if (!pattern) return true; // Empty is considered valid (matches everything)
  try {
    new RegExp(pattern);
    return true;
  } catch (e) {
    return false;
  }
}
