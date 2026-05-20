import { z } from 'zod';

export const UrlScopeSchema = z.object({
  pattern: z.string(),
  matchIframes: z.boolean().optional().default(false),
});

export const WebhookNodeSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().min(1),
  headers: z.string().optional(),
  body: z.string().optional(),
  responseType: z.enum(['json', 'text']).optional().default('json'),
});

export const MappingRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  include: z.array(z.string()),
  exclude: z.array(z.string()),
  value: z.string(),
  isNative: z.boolean(),
});

export const DynamicFormNodeSchema = z.object({
  mappings: z.array(MappingRowSchema),
  globalNative: z.boolean().optional().default(false),
});

/**
 * NodeSchema represents the logical manifest of a single node.
 * It differentiates between Logical Data (id, type, subtype, data)
 * and Visual Data (position, measured dimensions).
 */
export const NodeSchema = z.object({
  id: z.string().min(1, "ID is required"),
  type: z.string().min(1),
  subtype: z.string().min(1),
  data: z.record(z.string(), z.any()),
  alias: z.string().optional(),
  visual: z.object({
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional(),
    measured: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
  }).optional(),
}).superRefine((val, ctx) => {
  if (val.subtype === 'webhook') {
    const result = WebhookNodeSchema.safeParse(val.data);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          ...issue,
          path: ['data', ...issue.path],
        });
      });
    }
  }

  if (val.subtype === 'dynamicForm') {
    const result = DynamicFormNodeSchema.safeParse(val.data);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          ...issue,
          path: ['data', ...issue.path],
        });
      });
    }
  }
});

/**
 * EdgeSchema represents a connection between nodes.
 */
export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
});

/**
 * WorkflowSchema is the main blueprint for a workflow manifest.
 */
export const WorkflowSchema = z.object({
  // P0: Relaxed temporarily to support legacy IDs (wf-*)
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  updatedAt: z.number().optional(),
});

export type WorkflowManifest = z.infer<typeof WorkflowSchema>;
export type NodeManifest = z.infer<typeof NodeSchema>;

/**
 * Validates a JSON object against the WorkflowSchema.
 * @param json The raw JSON manifest to validate.
 * @returns A typed WorkflowManifest object.
 * @throws ZodError if validation fails.
 */
export function validateManifest(json: unknown): WorkflowManifest {
  return WorkflowSchema.parse(json);
}

/**
 * Dehydrates a React Flow based workflow into a clean JSON manifest.
 * Strips internal properties like dragging, selected, and non-serializable callbacks.
 * 
 * @param visualWorkflow The workflow object containing React Flow nodes/edges.
 * @returns A clean WorkflowManifest object.
 */
export function dehydrateWorkflow(visualWorkflow: { 
  id: string; 
  name: string; 
  nodes: any[]; 
  edges: any[]; 
  updatedAt?: number 
  }): WorkflowManifest {
  return WorkflowSchema.parse({
    id: visualWorkflow.id,
    name: visualWorkflow.name,
    nodes: visualWorkflow.nodes.map((node) => {
      // Extract subtype from either the top level or data
      const subtype = node.subtype || node.data?.subtype || 'unknown';
      
      // P1: Filter all function values generically to prevent manifest leaks
      const cleanData = Object.fromEntries(
        Object.entries(node.data || {}).filter(
          ([_, value]) => typeof value !== "function" && _ !== "subtype"
        )
      );

      return {
        id: node.id,
        type: node.type || 'actionNode',
        subtype,
        data: cleanData,
        alias: node.alias ?? node.data?.alias,
        visual: {
          position: node.position,
          measured: node.measured,
        },
      };
    }),
    edges: visualWorkflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
    // P2: Use nullish coalescing to avoid overwriting valid 0 timestamps
    updatedAt: visualWorkflow.updatedAt ?? Date.now(),
  });
}
