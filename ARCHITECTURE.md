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
- **Node Palette**: Provides draggable nodes: `TriggerNode` (Hotkey, Page Load), `ActionNode` (Click, Highlight, Type, Press Key, Scrape, Save Data), `ConditionalNode` (Element Exists, JS Expression), and `OutputNode`.
- **Native Execution Toggle**: `ActionNode` and elements can be marked as `isNative` to bypass bot detection and use OS-level events.
- **Hotkey Recorder**: A specialized component for capturing keyboard combinations.
- **Element Picker**: Sends a `START_PICKING` message to the content script to allow users to select DOM elements directly from the web page.

### 2. Content Script (`entrypoints/content/`)
The bridge between the extension UI and the active web page.
- **Storage Watcher**: Monitors `local:workflows` and dynamically registers/unregisters hotkey listeners based on the active workflows.
- **Trigger Detection**: Listens for `keydown` events (for Hotkeys) or script initialization (for Page Load).
- **Execution Orchestrator` (`index.ts`): When a trigger is activated, it fetches the relevant workflow, validates the URL regex, and invokes the `executeWorkflow` engine.
- **Interaction Recorder** (`utils/recorder.ts`): Captures page interaction events and coordinates recording states.
- **Element Picker Overlay** (`utils/recorder.ts`): Implements the visual highlighting and selection logic when the user is picking an element from the Side Panel.
- **Recording HUD Dashboard** (`components/RecorderHUD.ts`): Provides visual feedback (glows, toasts) and the recording dashboard overlay.


### 3. DAG Execution Engine (`packages/core/`)
A robust, standalone engine that executes the workflow logic.
- **Sequential Flowchart Traversal** (`executor.ts`): Follows flowchart edges sequentially using active pointer lookups, acting as a dynamic state machine.
- **Input Collection** (`collector.ts`): Extracts output values and maps upstream outputs to downstream inputs.
- **CDP Debugger Manager** (`debugger.ts`): Scans the workflow for `isNative` nodes and coordinates with the background script to attach the Chrome Debugger.
- **Node Registry** (`registry.ts`): Maps node subtypes (e.g., `click`, `pressKey`, `scrape`, `saveData`, `elementExists`) to their respective implementation handlers.
- **Branching Logic**: Specifically handles conditional nodes by evaluating the `conditionResult` and routing the next execution path based on `true`/`false` handles.


### 4. Background Script (`entrypoints/background/index.ts`)
The privileged component that handles system-level interactions.
- **Debugger Controller**: Manages `chrome.debugger` lifecycle (`attach`/`detach`) for active workflows.
- **Native Interaction Handlers**: Implements RPC listeners for `NATIVE_CLICK`, `NATIVE_TYPE`, and `NATIVE_KEYPRESS`.
- **Command Dispatch**: Translates high-level actions into CDP (Chrome Debugger Protocol) commands like `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent`.

## Execution Flow

1. **Trigger**: User presses a hotkey OR a page finishes loading.
2. **Detection**: Content script identifies the matching workflow.
3. **Native Pre-flight**: The executor checks if any nodes require `isNative` execution. If so, it requests a debugger attachment via the background script.
4. **Graph Analysis**: The executor starts execution directly from the trigger node.
5. **Step-by-Step Execution**:
   - The executor traverses downstream nodes sequentially following active edges.
   - For each node, it collects inputs from connected upstream nodes.
   - The handler performs the action. For native actions, it sends an RPC message to the background script.
   - The handler returns its output.
   - **Branching**: For conditional nodes, the engine determines which outgoing edge to follow based on the result (`true` or `false`).

6. **Teardown**: If the debugger was attached, it is detached automatically.
7. **Completion**: The workflow finishes, and the result is logged to `local:logs`.

## Data Models (`packages/schema/src/types.ts`)

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
- `tabs`: To allow the side panel to query the active tab's URL.
- `debugger`: Required for native automation and CDP-based interactions (Bot Detection Bypass).
