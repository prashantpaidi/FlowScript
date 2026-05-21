import { describe, it, expect, vi } from 'vitest';
import { VariableResolver } from './variableResolver';
import { WorkflowContext } from '../environment';

describe('VariableResolver', () => {
    const context: WorkflowContext = {
        nodes: {
            "scraper": {
                success: true,
                data: {
                    price: "$49.99",
                    stock: "In Stock"
                }
            },
            "math": {
                result: 42
            }
        },
        trigger: {
            url: "https://example.com/product",
            user: {
                id: "user-123",
                name: "John Doe"
            }
        },
        secrets: {
            MY_KEY: 'secret-value-123',
            API_TOKEN: 'token-456'
        },
        env: {
            url: 'https://example.com/env',
            browser: 'Chrome',
            platform: 'Win32'
        }
    };

    describe('Secrets', () => {
        it('should resolve $secrets variables', () => {
            const template = 'Bearer {{$secrets.MY_KEY}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Bearer secret-value-123');
        });

        it('should resolve multiple $secrets variables', () => {
            const template = '{{$secrets.MY_KEY}} and {{$secrets.API_TOKEN}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('secret-value-123 and token-456');
        });
    });

    describe('System Variables', () => {
        it('should resolve $sys.url', () => {
            const template = 'Running on {{$sys.url}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Running on https://example.com/env');
        });

        it('should resolve $sys.browser', () => {
            const template = 'Browser: {{$sys.browser}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Browser: Chrome');
        });

        it('should resolve $sys.now as a timestamp', () => {
            const template = '{{$sys.now}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(Number(resolved)).toBeGreaterThan(0);
        });

        it('should resolve $sys.uuid', () => {
            const template = '{{$sys.uuid}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });

    describe('Trigger Variables', () => {
        it('should resolve $trigger variables', () => {
            const template = 'Source: {{$trigger.url}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Source: https://example.com/product');
        });

        it('should resolve nested $trigger variables', () => {
            const template = 'Hello {{$trigger.user.name}} ({{$trigger.user.id}})';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Hello John Doe (user-123)');
        });
    });

    describe('Node Variables', () => {
        it('should resolve $node variables by alias', () => {
            const template = 'Price is {{$node.scraper.price}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Price is $49.99');
        });

        it('should fall back to looking inside "data" property if not found at root', () => {
            // Note: In our context, 'scraper' has 'data' property
            const template = 'Stock: {{$node.scraper.stock}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Stock: In Stock');
        });

        it('should resolve top-level node results', () => {
            const template = 'Result is {{$node.math.result}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('Result is 42');
        });

        it('should return placeholder if node not found', () => {
            const template = '{{$node.missing.val}}';
            const resolved = VariableResolver.resolveString(template, context);
            expect(resolved).toBe('{{$node.missing.val}}');
        });
    });

    describe('StaticTable Variables', () => {
        it('should resolve static table column and loop variables', () => {
            const tableContext: WorkflowContext = {
                ...context,
                nodes: {
                    ...context.nodes,
                    "MyTable": {
                        Email: "alice@example.com",
                        Name: "Alice",
                        $index: 0,
                        $total: 3
                    }
                }
            };
            const template = 'Email is {{$node.MyTable.Email}} (Index {{$node.MyTable.$index}} of {{$node.MyTable.$total}})';
            const resolved = VariableResolver.resolveString(template, tableContext);
            expect(resolved).toBe('Email is alice@example.com (Index 0 of 3)');
        });
    });

    describe('General Resolution', () => {
        it('should resolve deep objects', () => {
            const input = {
                config: {
                    url: "{{$trigger.url}}",
                    token: "Key {{$secrets.API_TOKEN}}"
                },
                tags: ["{{$sys.browser}}", "stable"]
            };
            const resolved = VariableResolver.resolveDeep(input, context);
            expect(resolved).toEqual({
                config: {
                    url: "https://example.com/product",
                    token: "Key token-456"
                },
                tags: ["Chrome", "stable"]
            });
        });

        it('should handle non-string values gracefully', () => {
            const input = { num: 123, bool: true, null: null };
            const resolved = VariableResolver.resolveDeep(input, context);
            expect(resolved).toEqual(input);
        });
    });
});
