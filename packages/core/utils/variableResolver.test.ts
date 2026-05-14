import { describe, it, expect, vi } from 'vitest';
import { VariableResolver } from './variableResolver';
import { WorkflowContext } from '../environment';

describe('VariableResolver - Secrets', () => {
    const context: WorkflowContext = {
        nodes: {},
        trigger: {},
        secrets: {
            MY_KEY: 'secret-value-123',
            API_TOKEN: 'token-456'
        },
        env: {
            url: 'https://example.com',
            browser: 'Chrome',
            platform: 'Win32'
        }
    };

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

    it('should keep placeholder if secret not found', () => {
        const template = '{{$secrets.MISSING}}';
        const resolved = VariableResolver.resolveString(template, context);
        expect(resolved).toBe('{{$secrets.MISSING}}');
    });
});
