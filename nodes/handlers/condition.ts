declare const browser: any;

export async function handleCondition(config: Record<string, any>, inputs: Record<string, any>, context?: any) {
  if (config.subtype === 'elementExists') {
    if (!config.selector) return { conditionResult: false };
    const expr = `!!document.querySelector(${JSON.stringify(config.selector)})`;
    try {
      const res = await browser.runtime.sendMessage({
        type: 'EVALUATE_JS',
        expression: expr
      });
      return { conditionResult: !!res?.result?.value };
    } catch (e) {
      console.error('Element Exists Native Error:', e);
      return { conditionResult: false };
    }
  } else if (config.subtype === 'jsExpression') {
    if (!config.expr) return { conditionResult: false };
    const expr = `(function(inputs) { return ${config.expr}; })(${JSON.stringify(inputs)})`;
    try {
      const res = await browser.runtime.sendMessage({
        type: 'EVALUATE_JS',
        expression: expr
      });
      return { conditionResult: !!res?.result?.value };
    } catch (e) {
      console.error('JS Expression Native Error:', e);
      return { conditionResult: false };
    }
  }
  return { conditionResult: false };
};
