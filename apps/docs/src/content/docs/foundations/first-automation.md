---
title: Your First Automation
description: Create a Hello World workflow that searches Google for Flowscript.
---

In this tutorial, you will create a workflow that opens Google, types `Flowscript`, and runs the search.

## Goal

The workflow will contain three steps:

1. A trigger that starts the workflow.
2. A type node that enters `Flowscript` into Google search.
3. A key press node that submits the search with `Enter`.

## Open Google

Open a new browser tab and go to:

```text
https://www.google.com
```

Keep the tab active while you build and test the workflow.

## Create a workflow

1. Open the Flowscript side panel.
2. Go to the **Workflows** tab.
3. Create a new workflow.
4. Name it `Search Google for Flowscript`.

## Add the trigger node

1. Open the node palette.
2. Add a **Trigger** node.
3. Choose a hotkey trigger.
4. Set the hotkey to something you can safely test, such as `Control+Shift+G`.

Every workflow needs a trigger. This is the entry point Flowscript uses when it starts execution.

## Add the type node

1. Add an **Action** node.
2. Set the action subtype to **Type**.
3. Set the selector to:

```css
textarea[name='q']
```

4. Set the text value to:

```text
Flowscript
```

This selector targets Google search's text input.

## Add the key press node

1. Add another **Action** node.
2. Set the action subtype to **Press Key**.
3. Set the key list to:

```json
["Enter"]
```

Pressing `Enter` submits the search after the query is typed.

## Connect the nodes

Drag an edge from the trigger node to the type node. Then drag an edge from the type node to the press key node.

The final order should be:

```text
Trigger -> Type "Flowscript" -> Press Enter
```

## Run the workflow

1. Make sure the Google tab is active.
2. Click **Run**, or press the hotkey you configured.
3. Watch the input field receive `Flowscript`.
4. Confirm the search results page opens.

## Example manifest

The visual builder creates this structure for you, but this example shows the same workflow as JSON:

```json
{
  "id": "wf-search-google-flowscript",
  "name": "Search Google for Flowscript",
  "nodes": [
    {
      "id": "n-trigger",
      "type": "triggerNode",
      "subtype": "hotkey",
      "data": {
        "key": "Control+Shift+G"
      }
    },
    {
      "id": "n-type",
      "type": "actionNode",
      "subtype": "type",
      "data": {
        "selector": "textarea[name='q']",
        "text": "Flowscript"
      }
    },
    {
      "id": "n-enter",
      "type": "actionNode",
      "subtype": "pressKey",
      "data": {
        "keys": ["Enter"]
      }
    }
  ],
  "edges": [
    { "id": "e-1", "source": "n-trigger", "target": "n-type" },
    { "id": "e-2", "source": "n-type", "target": "n-enter" }
  ]
}
```

If the workflow does not run, check the logs tab first. Most early issues are caused by the active tab being on the wrong page or a selector that no longer matches the page.
