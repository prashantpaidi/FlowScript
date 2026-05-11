/**
 * Node handler for data transformation.
 * Evaluates a JavaScript expression with access to all dynamic inputs.
 * 
 * @param config Node configuration (expression)
 * @param inputs Dynamic inputs (data from previous nodes)
 * @returns { data: any }
 */
export async function handleTransform(config: Record<string, any>, inputs: Record<string, any>, _context?: any) {
    const expression = config.expression || config.expr || 'inputs';
    
    console.log(`[Flowscript] Transforming with expression: ${expression}`);
    console.log(`[Flowscript] Available inputs:`, inputs);

    try {
        // Create a function that takes 'inputs' as an argument
        // This is safer than eval() and allows the user to use 'inputs.keyA + inputs.keyB'
        const transformer = new Function('inputs', `
            try {
                return ${expression};
            } catch (e) {
                throw new Error("Expression evaluation failed: " + e.message);
            }
        `);

        const result = transformer(inputs);
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
