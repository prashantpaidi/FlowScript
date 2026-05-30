export function detectPlatform(): string {
  if (typeof navigator !== 'undefined') {
    return navigator.platform;
  }
  return 'unknown';
}

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || navigator.userAgent);
}

export function detectBrowser(): string {
  if (typeof navigator !== 'undefined' && (navigator as any).userAgentData) {
    const brands = (navigator as any).userAgentData.brands;
    if (brands && brands.length > 0) {
      return brands[0].brand;
    }
  }
  if (typeof navigator !== 'undefined') {
    return navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Unknown';
  }
  return 'Unknown';
}
