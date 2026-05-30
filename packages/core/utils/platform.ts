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
    if (Array.isArray(brands) && brands.length > 0) {
      // Prioritize recognizable specific brands
      const specificBrand = brands.find(b => 
        /Chrome|Edge|Brave|Opera|Vivaldi|Firefox|Safari/i.test(b.brand) &&
        !/Chromium|Not/i.test(b.brand)
      );
      if (specificBrand) return specificBrand.brand;
      
      // Fallback: first brand that isn't a generic/mock brand
      const fallbackBrand = brands.find(b => !/Not/i.test(b.brand));
      if (fallbackBrand) return fallbackBrand.brand;
      
      return brands[0].brand;
    }
  }
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
    if (ua.includes('Vivaldi/')) return 'Vivaldi';
    if (ua.includes('Brave/')) return 'Brave';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    if (ua.includes('Chrome/')) return 'Chrome';
  }
  return 'Unknown';
}
