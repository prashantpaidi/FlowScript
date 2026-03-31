export interface SelectorOption {
  type: 'ID' | 'Data' | 'Class' | 'Path';
  value: string;
}

/**
 * Generates all possible unique selectors for a given element.
 */
export function getAllSelectors(el: Element): SelectorOption[] {
  if (!(el instanceof Element)) return [];

  const options: SelectorOption[] = [];

  // 1. Unique ID
  if (el.id && isUniqueSelector(`#${CSS.escape(el.id)}`)) {
    options.push({ type: 'ID', value: `#${CSS.escape(el.id)}` });
  }

  // 2. Data attributes
  const dataAttributes = ['data-testid', 'data-qa', 'data-cy', 'name', 'aria-label', 'role'];
  for (const attr of dataAttributes) {
    const val = el.getAttribute(attr);
    if (val) {
      const selector = `[${attr}="${CSS.escape(val)}"]`;
      if (isUniqueSelector(selector)) {
        options.push({ type: 'Data', value: selector });
      }
    }
  }

  // 3. Unique class combinations
  if (el.classList.length > 0) {
    const fullClassSelector = '.' + Array.from(el.classList).map(c => CSS.escape(c)).join('.');
    if (isUniqueSelector(fullClassSelector)) {
      options.push({ type: 'Class', value: fullClassSelector });
    }
    
    // Individual unique classes
    for (const className of el.classList) {
      const selector = `.${CSS.escape(className)}`;
      if (isUniqueSelector(selector) && !options.some(o => o.value === selector)) {
        options.push({ type: 'Class', value: selector });
      }
    }
  }

  // 4. Path-based selector (always provided as fallback)
  const pathSelector = getPathSelector(el);
  if (!options.some(o => o.value === pathSelector)) {
    options.push({ type: 'Path', value: pathSelector });
  }

  return options;
}

/**
 * Generates a single robust CSS selector (default).
 */
export function getRobustSelector(el: Element): string {
  const options = getAllSelectors(el);
  return options[0]?.value || '';
}

function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function getPathSelector(el: Element): string {
  const names: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current.id && isUniqueSelector(`#${CSS.escape(current.id)}`)) {
      names.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    let name = current.localName;
    const parent = current.parentElement as Element | null;

    if (parent) {
      const siblings = Array.from(parent.children).filter((s): s is Element => s instanceof Element && s.localName === name);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        name += `:nth-of-type(${index})`;
      }
    }

    names.unshift(name);
    current = parent;
  }

  return names.join(' > ');
}
