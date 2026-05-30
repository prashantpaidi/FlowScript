import { ExecutionContext } from '../environment';

function validateExpression(expr: string) {
    const forbiddenPatterns = [
        /\bconstructor\b/,
        /\bprototype\b/,
        /\bchrome\b/,
        /\bbrowser\b/,
        /\bfetch\b/,
        /\bXMLHttpRequest\b/,
        /\bWebSocket\b/,
        /\beval\b/,
        /\bFunction\b/,
        /\bimport\b/,
        /\b__proto__\b/
    ];
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(expr)) {
            throw new Error(`Security violation: expression contains forbidden pattern (${pattern.source})`);
        }
    }
}

/**
 * Node handler for data transformation.
 */
export async function handleTransform(config: Record<string, any>, inputs: Record<string, any>, context: ExecutionContext) {
    const expression = config.expression || config.expr || 'input';
    const input = config.input !== undefined ? config.input : inputs;
    
    console.log(`[Flowscript] Transforming with expression: ${expression}`);

    try {
        validateExpression(expression);

        const transformer = new Function(
            'input', 
            'inputs', 
            'window', 
            'document', 
            'browser', 
            'chrome', 
            'fetch', 
            'XMLHttpRequest', 
            'WebSocket', 
            'globalThis',
            'top',
            'parent',
            'self',
            'frames',
            `
            "use strict";
            try {
                return (${expression});
            } catch (e) {
                throw new Error("Expression evaluation failed: " + e.message);
            }
        `);

        const result = transformer(input, inputs, null, null, null, null, null, null, null, null, null, null, null, null);
        const key = config.key || config.dataKey || 'data';
        
        console.log(`[Flowscript] Transform result:`, result);
        
        const output: Record<string, any> = { [key]: result };
        return { 
            data: {
                data: result,
                result,
                ...output,
                'trigger-out': { ...output, result } 
            },
            nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
        };
    } catch (err: any) {
        console.error(`[Flowscript] Transform error:`, err);
        throw new Error(`Transformation failed: ${err.message}`);
    }
}
