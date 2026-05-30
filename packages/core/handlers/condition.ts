import { ExecutionContext } from '../environment';

export async function handleCondition(config: Record<string, any>, inputs: Record<string, any>, context: ExecutionContext) {
  const { env } = context;
  let conditionResult = false;

  if (config.subtype === 'elementExists') {
    if (!config.selector) {
      throw new Error('[Condition] Element Exists check requires a selector');
    }
    const expr = `!!document.querySelector(${JSON.stringify(config.selector)})`;
    try {
      const res = await env.sendMessage({
        type: 'EVALUATE_JS',
        expression: expr
      });
      conditionResult = !!res?.result?.value;
    } catch (e) {
      console.error('Element Exists Native Error:', e);
    }
  } else if (config.subtype === 'jsExpression') {
    if (!config.expr) {
      throw new Error('[Condition] JS Expression check requires an expression');
    }
    const expr = `(function(inputs) { return ${config.expr}; })(${JSON.stringify(inputs)})`;
    try {
      const res = await env.sendMessage({
        type: 'EVALUATE_JS',
        expression: expr
      });
      conditionResult = !!res?.result?.value;
    } catch (e) {
      console.error('JS Expression Native Error:', e);
    }
  }

  const nextNodeId = context.getNextNodeId ? context.getNextNodeId(conditionResult ? 'true' : 'false') : undefined;
  return {
    data: { conditionResult },
    nextNodeId
  };
}
