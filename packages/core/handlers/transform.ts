import { ExecutionContext } from '../environment';

/**
 * Node handler for data transformation.
 */
export async function handleTransform(config: Record<string, any>, inputs: Record<string, any>, _context: ExecutionContext) {
    const expression = config.expression || config.expr || 'inputs';
    
    console.log(`[Flowscript] Transforming with expression: ${expression}`);

    try {
        const transformer = new Function('inputs', 'window', 'document', 'browser', 'chrome', `
            "use strict";
            try {
                return (${expression});
            } catch (e) {
                throw new Error("Expression evaluation failed: " + e.message);
            }
        `);

        const result = transformer(inputs, null, null, null, null);
        const key = config.key || config.dataKey || 'data';
        
        console.log(`[Flowscript] Transform result:`, result);
        
        const output = { [key]: result };
        return { 
            data: result,
            ...output,
            'trigger-out': output 
        };
    } catch (err: any) {
        console.error(`[Flowscript] Transform error:`, err);
        throw new Error(`Transformation failed: ${err.message}`);
    }
}
