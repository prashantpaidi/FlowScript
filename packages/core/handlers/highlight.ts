import { waitForStable } from '../utils/dom';
import { ExecutionContext } from '../environment';

export async function handleHighlight(config: Record<string, any>, inputs: Record<string, any>, _context: ExecutionContext) {
  const scope = config.scope || inputs.scope;
  const regexStr = config.regex || inputs.regex;
  const color = config.color || inputs.color || '#ffeb3b';

  if (!scope || !regexStr) {
    throw new Error('Highlight node requires scope and regex configurations.');
  }

  const regex = new RegExp(regexStr, 'gi');

  console.log(`[Flowscript] Waiting for highlighted scope matching: ${scope}`);
  const container = await waitForStable(scope, 100, 10000);

  const applyHighlight = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.parentElement) {
      const tagName = node.parentElement.tagName;
      if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'MARK') return;

      const text = node.nodeValue;
      regex.lastIndex = 0;

      if (regex.test(text)) {
        regex.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }

          const mark = document.createElement('mark');
          mark.style.backgroundColor = color;
          mark.style.color = 'inherit';
          mark.style.padding = '0 2px';
          mark.style.borderRadius = '2px';
          mark.textContent = match[0];
          fragment.appendChild(mark);

          lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        node.parentElement.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(applyHighlight);
    }
  };

  applyHighlight(container);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((n) => {
        applyHighlight(n);
      });

      if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
        applyHighlight(mutation.target);
      }
    });
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log(`[Flowscript] Attached highlight observer for regex /${regexStr}/i`);
  return { success: true, scope, regex: regexStr };
}
