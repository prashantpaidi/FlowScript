---
title: UI Walkthrough
description: "Learn the main Flowscript interface areas: side panel tabs, node palette, canvas controls, and logs."
---

Flowscript's main workspace lives in the browser side panel. The side panel keeps your workflow editor next to the web page you are automating, so you can build and test without switching tools.

## Side panel tabs

### Workflows

The Workflows tab is the main builder. Use it to create, select, edit, and run workflows. This is where the canvas, node palette, and workflow controls live.

### Logs

The Logs tab shows workflow execution events. When a run fails, start here. Logs help you find selector failures, missing permissions, and node execution errors.

### Secrets

The Secrets tab stores sensitive values you do not want hard-coded into a workflow, such as API keys, usernames, or tokens. Use secrets when a workflow needs private data during execution.

## Node palette

The node palette is where you add steps to a workflow. Common node types include:

| Node type | Purpose |
| --- | --- |
| Trigger | Starts a workflow from a hotkey or page load event. |
| Action | Performs browser actions such as click, type, press key, highlight, or clipboard actions. |
| Scrape | Extracts text or structured lists from the current page. |
| Conditional | Branches based on page state or a JavaScript expression. |
| Save data | Persists scraped data to a named dataset. |
| Output | Sends the final result of a workflow to an output surface. |

Add a node, configure its fields, then connect it into the graph with edges.

## Canvas

The canvas is the visual graph editor. It shows the workflow as connected nodes, with execution moving from one node to the next along edges.

### Zoom

Use zoom when a workflow becomes too large to view at once. Zoom out to inspect structure, then zoom in when editing a specific node.

### Pan

Pan the canvas to move across the workflow. This is useful when a graph branches into multiple paths.

### MiniMap

The MiniMap gives you a small overview of the entire workflow. Use it to understand large automations and jump between distant parts of the canvas.

## Edges

Edges define execution order. A node that is not connected may appear on the canvas but will not run unless it is reachable from the trigger.

For conditional nodes, use the `true` and `false` outputs to route execution based on the condition result.

## Run controls

Use **Run** to test the current workflow. Keep the target tab active while testing, then check **Logs** after each run to confirm every node executed in the expected order.
