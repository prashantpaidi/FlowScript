# Flowscript Architecture

## High-Level Overview

Flowscript is a visual browser automation engine. Unlike simple trigger-action tools, it uses a directed acyclic graph (DAG) model to represent complex sequences of interactions. Users design these workflows on a canvas, and the extension's execution engine ensures that actions are performed in the correct order, handling asynchronous dependencies automatically.

The extension is built with:
- **Framework:** [WXT](https://wxt.dev/)
- **Visual Engine:** [@xyflow/react](https://reactflow.dev/) (React Flow)
- **UI Library:** React 19
- **Styling:** Tailwind CSS v4
- **State Management:** `wxt/storage` (Local Storage)

## Visual Architecture

The application is split into three primary layers: the **UI Layer** (Side Panel), the **Persistence Layer** (Storage), and the **Execution Layer** (Content Script + DAG Executor).

### 1. Side Panel (`entrypoints/sidepanel/`)
The main user interface for creating and managing workflows.
- **Workflow List**: Lists all saved workflows stored in `local:workflows`.
- **Flow Canvas** (`WorkflowsTab.tsx`): A drag-and-drop environment for building graphs.
- **Node Palette**: Provides draggable nodes: `TriggerNode` (Hotkey, Page Load), `ActionNode` (Click, Highlight), and `OutputNode`.
- **Hotkey Recorder**: A specialized component for capturing keyboard combinations.
- **Element Picker**: Sends a `START_PICKING` message to the content script to allow users to select DOM elements directly from the web page.

### 2. Content Script (`entrypoints/content/index.ts`)
The bridge between the extension UI and the active web page.
- **Storage Watcher**: Monitors `local:workflows` and dynamically registers/unregisters hotkey listeners based on the active workflows.
- **Trigger Detection**: Listens for `keydown` events (for Hotkeys) or script initialization (for Page Load).
- **Execution Orchestrator**: When a trigger is activated, it fetches the relevant workflow, validates the URL regex, and invokes the `executeWorkflow` engine.
- **Element Picker Overlay**: Implements the visual highlighting and selection logic when the user is picking an element from the Side Panel.

### 3. DAG Execution Engine (`nodes/executor.ts`)
A robust, standalone engine that executes the workflow logic.
- **Topological Sort**: Uses Kahn's algorithm to determine the correct execution order of nodes based on their connections.
- **Dependency Resolution**: Pass data (outputs) from upstream nodes to downstream nodes via port mappings (sourceHandle -> targetHandle).
- **Node Registry**: Maps node subtypes (e.g., `click`, `hotkey`) to their respective implementation handlers.

## Execution Flow

1. **Trigger**: User presses a hotkey OR a page finishes loading.
2. **Detection**: Content script identifies the matching workflow and trigger node.
3. **Graph Analysis**: The executor performs a topological sort starting from the trigger node.
4. **Step-by-Step Execution**:
   - The executor iterates through sorted nodes.
   - For each node, it collects inputs from connected upstream nodes.
   - It calls the specific **Node Handler** from the registry.
   - The handler performs the action (e.g., `click` an element) and returns its output.
5. **Completion**: The workflow finishes, and the result is logged to `local:logs`.

## Data Models (`nodes/types.ts`)

The common data structures used across the extension:

```typescript
export interface WorkflowNode {
  id: string;
  type: string;        // 'triggerNode', 'actionNode', 'outputNode'
  subtype: string;     // 'hotkey', 'pageload', 'click', 'highlight'
  position: { x: number; y: number };
  data: Record<string, any>; // Configuration for the specific node type
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // Port name on the source node
  targetHandle?: string; // Port name on the target node
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  updatedAt: number;
}
```

## Storage Keys

The application uses the following `local` storage keys via `wxt/storage`:

1. `local:workflows`: An array of `Workflow` objects. The content script watches this for real-time trigger registration.
2. `local:logs`: An array of `LogEntry` objects (capped at 50) for the activity feed.

## Security & Permissions

Defined in `wxt.config.ts`, the extension requires:
- `sidePanel`: To render the main UI inside the browser's side panel.
- `storage`: To persist user automations and logs locally.
- `tabs`: To allow the side panel to query the active tab's URL (for URL regex preset suggestions).
