import { ExecutionContext } from '../environment';

type ASTNode =
  | { type: 'Literal'; value: any }
  | { type: 'Identifier'; name: string }
  | { type: 'Member'; object: ASTNode; property: ASTNode; computed: boolean }
  | { type: 'Binary'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'Unary'; operator: string; argument: ASTNode }
  | { type: 'Conditional'; test: ASTNode; consequent: ASTNode; alternate: ASTNode }
  | { type: 'Call'; callee: ASTNode; arguments: ASTNode[] }
  | { type: 'Array'; elements: ASTNode[] }
  | { type: 'Object'; properties: { key: string; value: ASTNode }[] };

function tokenize(code: string): string[] {
  const tokens: string[] = [];
  const regex = /\s*(?:(\d+(?:\.\d+)?)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([a-zA-Z_$][a-zA-Z0-9_$]*)|(===|==|!==|!=|<=|>=|&&|\|\||[-+*/?:().,\[\]{}!&|<>=;|\.]))/g;
  let match;
  let lastIndex = 0;
  while ((match = regex.exec(code)) !== null) {
    const skipped = code.slice(lastIndex, match.index);
    if (skipped.trim() !== '') {
      throw new Error(`Unexpected token at position ${lastIndex}: "${skipped.trim()}"`);
    }

    if (match[1] !== undefined) tokens.push(match[1]); // number
    else if (match[2] !== undefined) tokens.push(`"${match[2]}"`); // double-quoted string
    else if (match[3] !== undefined) tokens.push(`'${match[3]}'`); // single-quoted string
    else if (match[4] !== undefined) tokens.push(match[4]); // identifier
    else if (match[5] !== undefined) tokens.push(match[5]); // operator/punctuation

    lastIndex = regex.lastIndex;
  }

  const tail = code.slice(lastIndex);
  if (tail.trim() !== '') {
    throw new Error(`Unexpected token at end: "${tail.trim()}"`);
  }

  return tokens;
}

class Parser {
  private tokens: string[];
  private pos = 0;

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private next(): string | undefined {
    return this.tokens[this.pos++];
  }

  private match(expected: string): boolean {
    if (this.peek() === expected) {
      this.pos++;
      return true;
    }
    return false;
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token: ${this.peek()}`);
    }
    return node;
  }

  private parseExpression(): ASTNode {
    return this.parseConditional();
  }

  private parseConditional(): ASTNode {
    const expr = this.parseLogicalOr();
    if (this.match('?')) {
      const consequent = this.parseExpression();
      if (!this.match(':')) throw new Error("Expected ':' in conditional expression");
      const alternate = this.parseExpression();
      return { type: 'Conditional', test: expr, consequent, alternate };
    }
    return expr;
  }

  private parseLogicalOr(): ASTNode {
    let expr = this.parseLogicalAnd();
    while (this.match('||')) {
      expr = { type: 'Binary', operator: '||', left: expr, right: this.parseLogicalAnd() };
    }
    return expr;
  }

  private parseLogicalAnd(): ASTNode {
    let expr = this.parseEquality();
    while (this.match('&&')) {
      expr = { type: 'Binary', operator: '&&', left: expr, right: this.parseEquality() };
    }
    return expr;
  }

  private parseEquality(): ASTNode {
    let expr = this.parseRelational();
    let op: string | undefined;
    while ((op = this.peek()) && ['===', '==', '!==', '!='].includes(op)) {
      this.pos++;
      expr = { type: 'Binary', operator: op, left: expr, right: this.parseRelational() };
    }
    return expr;
  }

  private parseRelational(): ASTNode {
    let expr = this.parseAdditive();
    let op: string | undefined;
    while ((op = this.peek()) && ['<', '<=', '>', '>='].includes(op)) {
      this.pos++;
      expr = { type: 'Binary', operator: op, left: expr, right: this.parseAdditive() };
    }
    return expr;
  }

  private parseAdditive(): ASTNode {
    let expr = this.parseMultiplicative();
    let op: string | undefined;
    while ((op = this.peek()) && ['+', '-'].includes(op)) {
      this.pos++;
      expr = { type: 'Binary', operator: op, left: expr, right: this.parseMultiplicative() };
    }
    return expr;
  }

  private parseMultiplicative(): ASTNode {
    let expr = this.parseUnary();
    let op: string | undefined;
    while ((op = this.peek()) && ['*', '/'].includes(op)) {
      this.pos++;
      expr = { type: 'Binary', operator: op, left: expr, right: this.parseUnary() };
    }
    return expr;
  }

  private parseUnary(): ASTNode {
    const op = this.peek();
    if (op && ['!', '-', '+'].includes(op)) {
      this.pos++;
      return { type: 'Unary', operator: op, argument: this.parseUnary() };
    }
    return this.parseMember();
  }

  private parseMember(): ASTNode {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match('.')) {
        const prop = this.next();
        if (!prop || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop)) {
          throw new Error("Expected property identifier after '.'");
        }
        expr = {
          type: 'Member',
          object: expr,
          property: { type: 'Identifier', name: prop },
          computed: false
        };
      } else if (this.match('[')) {
        const prop = this.parseExpression();
        if (!this.match(']')) throw new Error("Expected ']' in member access");
        expr = {
          type: 'Member',
          object: expr,
          property: prop,
          computed: true
        };
      } else if (this.match('(')) {
        const args: ASTNode[] = [];
        if (!this.peek() || this.peek() !== ')') {
          while (true) {
            args.push(this.parseExpression());
            if (this.match(',')) continue;
            if (this.peek() === ')') break;
            throw new Error("Expected ',' or ')' in argument list");
          }
        }
        if (!this.match(')')) throw new Error("Expected ')' after arguments");
        expr = {
          type: 'Call',
          callee: expr,
          arguments: args
        };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.startsWith('"') || token.startsWith("'")) {
      this.pos++;
      return { type: 'Literal', value: token.slice(1, -1) };
    }

    if (/^\d/.test(token)) {
      this.pos++;
      return { type: 'Literal', value: Number(token) };
    }

    if (['true', 'false', 'null', 'undefined'].includes(token)) {
      this.pos++;
      const val = token === 'true' ? true : token === 'false' ? false : token === 'null' ? null : undefined;
      return { type: 'Literal', value: val };
    }

    if (this.match('(')) {
      const expr = this.parseExpression();
      if (!this.match(')')) throw new Error("Expected ')'");
      return expr;
    }

    if (this.match('[')) {
      const elements: ASTNode[] = [];
      if (this.peek() !== ']') {
        while (true) {
          elements.push(this.parseExpression());
          if (this.match(',')) continue;
          if (this.peek() === ']') break;
          throw new Error("Expected ',' or ']'");
        }
      }
      if (!this.match(']')) throw new Error("Expected ']'");
      return { type: 'Array', elements };
    }

    if (this.match('{')) {
      const properties: { key: string; value: ASTNode }[] = [];
      if (this.peek() !== '}') {
        while (true) {
          const keyToken = this.next();
          if (!keyToken) throw new Error("Expected property key");
          const key = (keyToken.startsWith('"') || keyToken.startsWith("'")) ? keyToken.slice(1, -1) : keyToken;
          if (!this.match(':')) throw new Error("Expected ':' after property key");
          const value = this.parseExpression();
          properties.push({ key, value });
          if (this.match(',')) continue;
          if (this.peek() === '}') break;
          throw new Error("Expected ',' or '}'");
        }
      }
      if (!this.match('}')) throw new Error("Expected '}'");
      return { type: 'Object', properties };
    }

    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
      this.pos++;
      return { type: 'Identifier', name: token };
    }

    throw new Error(`Unexpected token: ${token}`);
  }
}

const FORBIDDEN_WORDS = [
  'constructor',
  'prototype',
  '__proto__',
  'chrome',
  'browser',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'globalThis',
  'eval',
  'Function',
  'import'
];

function checkSecurity(name: string) {
  if (FORBIDDEN_WORDS.includes(name)) {
    throw new Error(`Security violation: expression contains forbidden pattern (\\b${name}\\b)`);
  }
}

function evaluate(node: ASTNode, scope: Record<string, any>): any {
  switch (node.type) {
    case 'Literal':
      return node.value;
    case 'Identifier': {
      const name = node.name;
      checkSecurity(name);
      
      // Shadow globals securely: return null if referencing blacklisted globals
      if (['window', 'document', 'chrome', 'browser', 'fetch', 'XMLHttpRequest', 'WebSocket', 'globalThis', 'top', 'parent', 'self', 'frames'].includes(name)) {
        return null;
      }
      
      if (name in scope) {
        return scope[name];
      }
      throw new ReferenceError(`${name} is not defined`);
    }
    case 'Unary': {
      const val = evaluate(node.argument, scope);
      switch (node.operator) {
        case '!': return !val;
        case '-': return -val;
        case '+': return +val;
        default: throw new Error(`Unknown unary operator: ${node.operator}`);
      }
    }
    case 'Binary': {
      const left = evaluate(node.left, scope);
      // Short-circuit logical operators
      if (node.operator === '&&') return left && evaluate(node.right, scope);
      if (node.operator === '||') return left || evaluate(node.right, scope);

      const right = evaluate(node.right, scope);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '==': return left == right;
        case '===': return left === right;
        case '!=': return left != right;
        case '!==': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        default: throw new Error(`Unknown binary operator: ${node.operator}`);
      }
    }
    case 'Conditional': {
      const test = evaluate(node.test, scope);
      return test ? evaluate(node.consequent, scope) : evaluate(node.alternate, scope);
    }
    case 'Member': {
      const obj = evaluate(node.object, scope);
      if (obj === null || obj === undefined) {
        throw new TypeError(`Cannot read properties of ${obj}`);
      }
      let propName: any;
      if (node.computed) {
        propName = evaluate(node.property, scope);
      } else {
        if (node.property.type !== 'Identifier') {
          throw new Error("Expected identifier property");
        }
        propName = node.property.name;
      }

      if (typeof propName === 'string') {
        const cleanProp = propName.trim();
        checkSecurity(cleanProp);
      }

      return obj[propName];
    }
    case 'Call': {
      let fn: any;
      let context: any = null;
      if (node.callee.type === 'Member') {
        context = evaluate(node.callee.object, scope);
        if (context === null || context === undefined) {
          throw new TypeError(`Cannot read properties of ${context}`);
        }
        let propName: any;
        if (node.callee.computed) {
          propName = evaluate(node.callee.property, scope);
        } else {
          if (node.callee.property.type !== 'Identifier') {
            throw new Error("Expected identifier property");
          }
          propName = node.callee.property.name;
        }

        if (typeof propName === 'string') {
          const cleanProp = propName.trim();
          checkSecurity(cleanProp);
        }
        fn = context[propName];
      } else {
        fn = evaluate(node.callee, scope);
      }

      if (typeof fn !== 'function') {
        throw new TypeError(`${fn} is not a function`);
      }

      const args = node.arguments.map(arg => evaluate(arg, scope));
      
      if (fn === Function || fn === eval) {
        throw new Error("Security violation: Function or eval invocation blocked");
      }

      return fn.apply(context, args);
    }
    case 'Array':
      return node.elements.map(el => evaluate(el, scope));
    case 'Object': {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        const key = prop.key;
        if (typeof key === 'string') {
          const cleanKey = key.trim();
          checkSecurity(cleanKey);
        }
        obj[key] = evaluate(prop.value, scope);
      }
      return obj;
    }
    default:
      throw new Error(`Unknown AST Node: ${(node as any).type}`);
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
    const tokens = tokenize(expression);
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const scope = {
      input,
      inputs
    };

    const result = evaluate(ast, scope);
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
