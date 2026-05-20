---
title: Developer API & Architecture
description: "Understand the workflow schema, DAG executor, native bridge, and how to extend Flowscript with new nodes."
---

This guide is for contributors and advanced developers who want to understand how Flowscript stores workflows, executes graphs, talks to the browser, and adds new node capabilities.

## JSON Schema

Workflow manifests are validated with Zod in `packages/schema/src/schema.ts`.

### `WorkflowManifest`

A workflow manifest has four primary fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Unique workflow ID. |
| `name` | string | Human-readable workflow name. |
| `nodes` | array | Logical node definitions. |
| `edges` | array | Connections between nodes. |

`updatedAt` is optional in exported manifests and stored workflows.

### Node shape

Each node contains:

| Field | Purpose |
| --- | --- |
| `id` | Stable node ID. |
| `type` | UI/runtime family, such as `actionNode`, `triggerNode`, or `conditionalNode`. |
| `subtype` | Registry key, such as `click`, `scrape`, `saveData`, or `jsExpression`. |
| `data` | Configuration for the node subtype. |
| `alias` | Optional readable name for variables and debugging. |
| `visual` | Optional editor-only layout metadata. |

### Visual vs. logical data

Logical data is what the executor needs: node type, subtype, config, and edges.

Visual data is what the editor needs: canvas position and measured node dimensions. In the manifest schema, visual data lives under `visual`:

```json
{
  "visual": {
    "position": { "x": 100, "y": 200 },
    "measured": { "width": 240, "height": 120 }
  }
}
```

The side panel uses React Flow nodes while editing. When exporting, `dehydrateWorkflow` strips runtime-only values such as callbacks and converts the editor graph into a clean manifest.

## Execution Engine (DAG)

The executor lives in `packages/core/executor.ts`. It runs workflows as directed acyclic graphs.

### Kahn's Algorithm

Before execution, the engine:

1. Builds a node map and adjacency list.
2. Finds nodes reachable from the trigger that started the run.
3. Computes in-degrees for the reachable subgraph.
4. Uses Kahn's Algorithm to produce topological execution order.
5. Throws if the reachable graph contains a cycle.

This means actions run only after their dependencies are available, and disconnected nodes do not run.

### State between nodes

Each node returns an output object. The executor stores those outputs in `nodeOutputs` by node ID, then maps them into a workflow context by both node ID and node alias.

Before each node runs, the executor:

- Collects values from incoming edges.
- Resolves `{{ ... }}` variables in `node.data`.
- Calls the registered handler for the node `subtype`.
- Stores the returned output for downstream nodes.

Conditional nodes add one extra step. After a condition runs, the executor marks either the `true` or `false` branch as dead, so only the matching branch continues.

## Native Bridge (CDP)

Native Mode uses the background script and Chrome Debugger Protocol (CDP) to send lower-level browser input.

### Background script responsibilities

The background script in `apps/extension/entrypoints/background/index.ts` listens for runtime messages such as:

| Message | Purpose |
| --- | --- |
| `DEBUGGER_ATTACH` | Attach CDP to the active tab. |
| `DEBUGGER_DETACH` | Detach CDP after execution. |
| `NATIVE_CLICK` | Dispatch mouse events. |
| `NATIVE_TYPE` | Dispatch keyboard events for text. |
| `NATIVE_KEYPRESS` | Dispatch key combinations and modifiers. |
| `EVALUATE_JS` | Evaluate JavaScript through CDP. |
| `SAVE_SCRAPED_DATA` | Persist data to IndexedDB. |

The executor attaches the debugger before workflows that need native behavior, then detaches it in a `finally` block so cleanup runs even when a node fails.

### Implementing new native actions

To add a native action:

1. Define or extend the message type in `apps/extension/src/types/messages.ts`.
2. Add a background handler that translates the message to one or more `chrome.debugger.sendCommand(...)` calls.
3. Add a core handler in `packages/core/handlers`.
4. Register the handler in `packages/core/registry.ts`.
5. Add a UI control for the subtype in `@flowscript/ui`.
6. Test both success and failure responses.

Prefer small, explicit native messages. Native actions are easier to debug when the background script receives a focused command such as "click at x/y" rather than an entire workflow step.

## Extending Flowscript

New node behavior usually needs changes in three layers: schema/types, runtime registry, and UI.

### Add a node subtype to the registry

Create a handler with the standard signature:

```ts
export async function handleMyNode(
  config: Record<string, any>,
  inputs: Record<string, any>,
  context: ExecutionContext
) {
  return { success: true };
}
```

Then register it in `packages/core/registry.ts`:

```ts
export const nodeRegistry: Record<string, NodeHandler> = {
  myNode: handleMyNode as NodeHandler,
};
```

If the subtype should be part of the shared TypeScript model, add it to `NodeSubtype` in `packages/schema/src/types.ts`.

### Add a custom UI component

UI node components live in `packages/ui`. Existing examples include `ActionNode`, `ScrapeNode`, `ConditionalNode`, `SaveDataNode`, and `TransformNode`.

To add a new visual node:

1. Create the component in `packages/ui/nodes`.
2. Export it from `packages/ui/index.ts`.
3. Add it to the `nodeTypes` map in the side panel workflow canvas.
4. Add it to `NodePalette` if users should be able to drag it onto the canvas.
5. Ensure the component writes serializable config into `data`.

Keep UI data serializable. Functions such as `onUpdate` and `onRemove` are editor callbacks and should not appear in exported manifests.

### Test the extension point

For a new node subtype, test at least:

- Manifest validation and import/export.
- Handler success and failure.
- Variable resolution in node config.
- Edge wiring and downstream output.
- UI serialization through Canvas view and Code view.
