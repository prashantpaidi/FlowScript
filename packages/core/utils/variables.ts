import { WorkflowContext } from '../environment';
import { VariableResolver } from './variableResolver';

/**
 * Context for resolving variables in a workflow.
 * @deprecated Use WorkflowContext from executor.ts
 */
export type ResolutionContext = WorkflowContext;

/**
 * Resolves variables in a string using the provided context.
 * Supports:
 * - {{$sys.now}}
 * - {{$node.Alias.key}}
 * - {{$trigger.url}} (or any key in trigger data)
 * 
 * @param template The string containing {{variables}}
 * @param context The resolution context
 * @returns The resolved string
 */
export function resolveVariables(template: string, context: WorkflowContext): string {
    return String(VariableResolver.resolveString(template, context) ?? '');
}
