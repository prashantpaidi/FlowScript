import { findLabelForInput } from '../utils/dom';
import { ExecutionContext } from '../environment';


/**
 * handleDynamicForm implements the Phase 4: Dual-Mode Execution Engine.
 * It iterates through MappingRows, matches them to DOM elements semantically,
 * and fills them using either native CDP commands or standard DOM events.
 */
export async function handleDynamicForm(
  config: Record<string, any>, 
  inputs: Record<string, any>, 
  context: ExecutionContext
) {
  const { env } = context;
  const mappings = config.mappings || [];
  const globalNative = config.globalNative || false;

  console.log(`[Flowscript] Starting Dynamic Form execution with ${mappings.length} mappings`);

  // Phase 4.1: The Resolver - Gather all potential input candidates once
  const candidates = Array.from(
    document.querySelectorAll('input, textarea, select, [contenteditable="true"]')
  ) as HTMLElement[];

  // Pre-calculate semantic labels to avoid redundant DOM climbing
  const candidateData = candidates.map(el => ({
    el,
    // Use lowercased semantic label for easier matching
    label: (findLabelForInput(el) || '').toLowerCase()
  }));

  const results = [];

  // Phase 4.2: Iterate through the MappingRow array
  for (const mapping of mappings) {
    const { include = [], exclude = [], value, isNative, label: rowLabel, id } = mapping;
    
    // The Matcher: Implement (Include) AND NOT (Exclude) logic
    const matchedCandidate = candidateData.find(can => {
      const label = can.label;
      const matchesInclude = include.every((inc: string) => 
        label.includes(inc.toLowerCase().trim())
      );
      const matchesExclude = exclude.some((exc: string) => 
        label.includes(exc.toLowerCase().trim())
      );
      return matchesInclude && !matchesExclude && include.length > 0;
    });

    if (matchedCandidate) {
      const el = matchedCandidate.el;
      const useNative = isNative ?? globalNative;

      // Phase 5: Visual Audit - Apply purple glow
      if (env.onVisualFeedback) {
        env.onVisualFeedback({ type: 'glow', element: el });
      }

      console.log(`[Flowscript] Matched "${rowLabel}" to element with label "${matchedCandidate.label}" (Mode: ${useNative ? 'Native' : 'Non-Native'})`);


      // Phase 4.3: The Driver Switch
      if (useNative) {
        // Native: Focus -> Get Coordinates -> Send NATIVE_TYPE
        el.focus();
        
        const rect = el.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);

        // Note: NATIVE_TYPE handles the click-to-focus and typing via CDP
        const response = await env.sendMessage({
          type: 'NATIVE_TYPE',
          x,
          y,
          text: value,
          delayMs: config.delayMs || 50
        });

        if (response && !response.success) {
          console.error(`[Flowscript] Native type failed for "${rowLabel}":`, response.error);
          results.push({ id, label: rowLabel, success: false, error: response.error });
        } else {
          results.push({ id, label: rowLabel, success: true });
        }
      } else {
        // Non-Native: Focus -> Value -> Dispatch input, change, blur events
        el.focus();
        
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          (el as any).value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        } else {
          // Fallback for contenteditable
          el.innerText = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        results.push({ id, label: rowLabel, success: true });
      }
    } else {
      console.warn(`[Flowscript] No match found for mapping: "${rowLabel}" (Include: ${include.join(', ')}, Exclude: ${exclude.join(', ')})`);
      results.push({ id, label: rowLabel, success: false, error: 'No matching element found' });
    }
  }

  // Phase 5: Execution Summary HUD
  const successCount = results.filter(r => r.success).length;
  if (env.onVisualFeedback) {
    env.onVisualFeedback({ type: 'summary', success: successCount, total: mappings.length });
  }

  return { 
    data: {
      success: results.every(r => r.success), 
      results 
    },
    nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
  };
}
