---
title: Node Reference
description: "A registry-style dictionary of Flowscript node subtypes, what they do, and when to use them."
---

This reference explains the node subtypes available in the workflow registry. Use it as a dictionary when you are deciding which node belongs in a flow.

## Action Nodes

Action nodes interact with the current page. Most action nodes wait for the target element to exist and become stable before running.

### `click`

Clicks an element on the page.

Use a selector when the target can be described reliably with CSS, such as `button[data-testid="submit"]` or `#checkout`. The click handler waits for that selector, then clicks the matching element.

Coordinates matter most in Native Mode or when the click was captured by the recorder. If recorded coordinates exist, Flowscript can click that viewport position. Without recorded coordinates, it calculates the center point of the selected element.

Prefer selectors for resilient workflows. Prefer coordinates only when a custom control cannot be addressed cleanly with a selector, or when the site responds differently to a low-level native click.

### `type`

Types text into an input, textarea, or editable element.

Type modes:

| Mode | Behavior |
| --- | --- |
| `overwrite` | Replaces the existing value with the configured text. |
| `append` | Adds the configured text to the end of the existing value. |
| `prepend` | Adds the configured text to the beginning of the existing value. |

Standard typing requires a selector. It focuses the element, updates the value, and dispatches input/change events so framework-driven forms can react.

Native typing can optionally type into the current focused field when no selector is provided. For repeatable workflows, provide a selector whenever possible.

### `pressKey`

Presses one key or a key combination.

Use this for actions like `Enter`, `Escape`, `Tab`, or combinations such as `Control+Shift+P`. Modifier keys are stored as part of the key array, so a shortcut can include `Control`, `Shift`, `Alt`, `Meta`, or `Cmd` with a main key.

`pressKey` is handled natively because browser and application shortcuts often need lower-level keyboard events to work consistently.

### `wait`

Pauses the workflow for a fixed number of milliseconds.

Hard waits are useful after navigation, animation, lazy loading, or third-party scripts where there is no single reliable selector that proves the page is ready. They are also helpful while debugging a workflow step by step.

Do not use hard waits as the first tool for ordinary element readiness. Selector-based actions already wait for DOM stability, which is usually more reliable and faster than guessing a delay.

## Scraping Nodes

Scrape nodes read data from the page and pass it downstream.

### `scrape` (Single)

Captures text from one element.

Use single-mode scraping when you need one value, such as a page title, price, status message, account balance, or confirmation number. Configure `selector` and optionally set an output key. If no key is provided, the output uses `scraped`.

The node waits for the selector, reads `innerText` or text content, trims it, then returns an object keyed by the output name.

### `scrape` (List)

Captures repeated records from a page.

Use list-mode scraping when a page contains repeated cards, rows, search results, products, messages, or table-like items. Configure an `itemSelector` for the wrapper element that repeats, then add child fields for values inside each wrapper.

Example pattern:

| Field | Selector inside wrapper | Type |
| --- | --- | --- |
| `title` | `h2` | text |
| `price` | `.price` | text |
| `href` | `a` | attribute |

Wrapper selectors should match each repeated item, not the whole list container. Child field selectors are evaluated inside each wrapper so they can be short and stable.

If list mode has no fields, Flowscript returns the trimmed text for each matched wrapper.

## Logic & Branching

Logic nodes decide which path a workflow should take next.

### `conditionalNode`

A conditional node evaluates a condition and exposes two handles: `true` and `false`.

Connect the `true` handle to the branch that should run when the condition passes. Connect the `false` handle to the fallback branch. Edges without the matching handle are skipped during execution, so disconnected or incorrectly connected branches may never run.

### `elementExists`

Checks whether a selector exists in the page DOM.

Use this to branch on UI state:

- A login button exists, so the user is signed out.
- A success message exists, so the form submitted.
- A modal exists, so the workflow should close it first.
- A product card exists, so scraping can continue.

If the selector is missing or the check fails, the condition result is `false`.

### `jsExpression`

Runs a JavaScript expression that returns a boolean.

Use this when the decision depends on data from earlier nodes or on logic more complex than a selector check. The expression receives upstream values through `inputs`.

Examples:

```js
inputs.data.length > 0
inputs.scraped.price.includes("$")
Number(inputs.total) > 100
```

Keep expressions boolean and side-effect free. If the expression throws or cannot be evaluated, the condition result is treated as `false`.

## Storage & Integrations

Storage nodes persist or send workflow output.

### `saveData`

Saves upstream data into Flowscript's local IndexedDB storage.

Configure a `datasetName` so records are easy to find later. Saved records include the workflow ID, dataset name, current URL, scraped data, and timestamp.

To find saved data, open the Dashboard from the extension side panel. The Dashboard groups records by dataset, lets you inspect rows, and supports CSV export.

### `webhook`

`webhook` is a planned integration node for sending workflow data to external APIs such as Zapier, Make, or custom servers.

It is not registered in the current runtime registry yet, so a manifest containing `subtype: "webhook"` will not execute until a handler is added. When implemented, it should define:

- Request URL and HTTP method.
- Headers, including optional authentication headers.
- Body mapping from upstream workflow data.
- Success and failure behavior for non-2xx responses.

Until the node exists, export saved data from the Dashboard or add a custom handler before using webhook-style manifests.
