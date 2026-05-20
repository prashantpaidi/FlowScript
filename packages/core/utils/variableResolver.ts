import { WorkflowContext } from '../environment';

export class VariableResolver {
  private static readonly VAR_REGEX = /\{\{(.*?)\}\}/g;

  /**
   * Resolves all placeholders in a string using the provided context.
   */
  static resolveString(template: string, context: WorkflowContext): any {
    if (!template || typeof template !== 'string' || !template.includes('{{')) {
      return template;
    }

    // Optimization: If the template is exactly one variable placeholder, return the raw value (could be object/array)
    const singleVarMatch = template.match(/^\{\{(.*?)\}\}$/);
    if (singleVarMatch) {
      const path = singleVarMatch[1].trim();
      const value = this.getValueByPath(path, context);
      if (value !== undefined && value !== null) return typeof value === 'object' ? value : String(value);
    }

    return template.replace(this.VAR_REGEX, (match, path) => {
      const cleanPath = path.trim();
      const value = this.getValueByPath(cleanPath, context);
      
      if (value === undefined || value === null) {
        return match; // Keep the placeholder if no value found
      }

      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  /**
   * Recursively resolves placeholders in an object or array.
   */
  static resolveDeep<T>(obj: T, context: WorkflowContext, depth = 0): T {
    if (obj === null || obj === undefined) return obj;
    if (depth > 10) {
      console.warn('[Flowscript] VariableResolver: Max recursion depth reached');
      return obj;
    }

    if (typeof obj === 'string') {
      return this.resolveString(obj, context) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveDeep(item, context, depth + 1)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const resolvedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolvedObj[key] = this.resolveDeep(value, context, depth + 1);
      }
      return resolvedObj as T;
    }

    return obj;
  }

  /**
   * Retrieves a value from the context using a dot-notation path.
   * Supports:
   * - $sys.date, $sys.time, $sys.uuid, $sys.url, $sys.browser
   * - $node.Alias.key
   * - $trigger.key
   */
  private static getValueByPath(path: string, context: WorkflowContext): any {
    // 1. System Variables
    if (path.startsWith('$sys.')) {
      const key = path.substring(5);
      return this.resolveSystemVariable(key, context);
    }

    // 2. Trigger Variables
    if (path.startsWith('$trigger.')) {
      const key = path.substring(9);
      return this.getNestedValue(context.trigger, key);
    }

    // 3. Secret Variables
    if (path.startsWith('$secrets.')) {
      const key = path.substring(9);
      return this.getNestedValue(context.secrets, key);
    }

    // 4. Node Variables: $node.Alias.key
    if (path.startsWith('$node.')) {
      const parts = path.split('.');
      if (parts.length >= 3) {
        const alias = parts[1];
        const key = parts.slice(2).join('.');
        const nodeData = context.nodes[alias];
        
        if (!nodeData) {
          console.warn(`[Flowscript] Variable Resolver: Node with alias/ID "${alias}" not found in context. Available:`, Object.keys(context.nodes));
          return undefined;
        }

        const value = this.getNestedValue(nodeData, key);
        return value;
      }
      return undefined;
    }

    // Fallback: Check trigger directly or top-level keys if any (legacy support)
    return this.getNestedValue(context.trigger, path);
  }

  private static resolveSystemVariable(key: string, context: WorkflowContext): any {
    switch (key) {
      case 'date':
        return new Date().toLocaleDateString();
      case 'time':
        return new Date().toLocaleTimeString();
      case 'datetime':
        return new Date().toISOString();
      case 'uuid':
        return crypto.randomUUID();
      case 'url':
        return context.env.url;
      case 'browser':
        return context.env.browser;
      case 'platform':
        return context.env.platform;
      case 'now':
        return Date.now();
      default:
        return undefined;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    if (!obj) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      
      // Smart Fallback: If we are at the top level of a node result and the key doesn't exist,
      // but 'data' does exist, try looking inside 'data'.
      if (current === obj && current[key] === undefined && current['data'] !== undefined) {
        const fallback = current['data'][key];
        if (fallback !== undefined) {
          current = fallback;
          continue;
        }
      }

      current = current[key];
    }
    
    return current;
  }
}
