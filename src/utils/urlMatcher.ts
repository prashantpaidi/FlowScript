/**
 * Tests if a URL matches a given regex pattern.
 * @param currentUrl The URL to test.
 * @param pattern The regex pattern string. If empty or missing, returns true.
 * @returns true if it matches or pattern is empty, false otherwise.
 */
export function isUrlMatch(currentUrl: string, pattern?: string): boolean {
  if (!pattern || pattern.trim() === '') {
    return true; // Allow all websites if pattern is empty
  }

  try {
    const regex = new RegExp(pattern);
    return regex.test(currentUrl);
  } catch (e) {
    console.error('Invalid regex pattern:', pattern, e);
    return false;
  }
}
