---
title: Workflow Builder Core Concepts
description: "Learn how triggers, element picking, native mode, and workflow import/export work in Flowscript."
---

The Workflow Builder is where you turn browser tasks into reusable logic. A workflow starts with a trigger, moves through connected nodes, and runs each reachable step in graph order.

## Triggers

Every workflow should start with a Trigger node. A trigger listens for a user action or page event, then starts the connected workflow graph.

### Hotkeys

Use a Hotkey trigger when you want to run a workflow on demand from the current page.

1. Drag a Trigger node onto the canvas.
2. Set the trigger type to `Hotkey`.
3. Click the hotkey recorder and press the shortcut you want to use.
4. Optionally add a URL Scope regex so the shortcut only runs on matching sites.

Hotkeys are matched against modifier keys (`Ctrl`, `Alt`, `Shift`, `Meta`/`Cmd`) plus the main key. Flowscript ignores hotkeys while the cursor is inside an input, textarea, or editable element, which helps avoid surprising runs while typing.

Common pitfalls:

- Browser and operating-system shortcuts usually win first. Shortcuts such as `Ctrl+L`, `Ctrl+T`, `Ctrl+W`, `Ctrl+R`, `Alt+Left`, and many `Cmd` shortcuts may be intercepted before Flowscript can use them.
- Site-level shortcuts can conflict with your workflow. If the page already uses `?`, `/`, `J`, `K`, or similar shortcuts, prefer a modifier-heavy combination such as `Ctrl+Shift+Y`.
- Avoid shortcuts that are hard to press consistently. A reliable shortcut is better than a clever one.

### Page Load

Use a Page Load trigger when the workflow should start automatically after visiting a matching URL.

1. Drag a Trigger node onto the canvas.
2. Set the trigger type to `Page Load`.
3. Enter a URL regex in `Trigger on URL (Regex)`.
4. Use the helper buttons when possible:
   - `All Sites` sets the pattern to `.*`.
   - `Current Website` matches the current host.
   - `Current Page` matches the exact current URL.

URL matching uses JavaScript regular expressions. Escape regex characters in literal URLs, especially `.`, `?`, `+`, and `/`.

```text
^https://example\.com/orders/.*
^https?://(www\.)?example\.com/.*
^https://app\.example\.com/dashboard$
```

Flowscript also watches single-page application navigation. It rechecks Page Load triggers when a site changes URL through `history.pushState`, `history.replaceState`, browser back/forward navigation, hash changes, or click-driven navigation that updates the URL without a full reload.

## Element Picker

The Pick button lets you select a page element instead of writing a CSS selector by hand.

1. Open the workflow in the side panel.
2. Add or select an Action or Scrape node with a selector field.
3. Click `Pick`.
4. Move the cursor over the target page. Flowscript highlights the element under the pointer.
5. Click the highlighted element to capture selector suggestions.

For scrape lists, use the list or wrapper picker where available so Flowscript can capture a selector that matches repeated items instead of one exact element.

### Selector strategy

When you pick an element, Flowscript suggests selectors in this order:

| Priority | Selector type | What it uses |
| --- | --- | --- |
| 1 | `ID` | A unique `#id` selector, when the element has one. |
| 2 | `Data` | Stable attributes such as `data-testid`, `data-qa`, `data-cy`, `name`, `aria-label`, or `role`. |
| 3 | `Class` | Unique class combinations or individual unique classes. |
| 4 | `Path` | A generated DOM path using tag names and `:nth-of-type(...)` as a fallback. |

Prefer selectors that describe the element's purpose, not its current layout. Data attributes, names, and ARIA labels usually survive page redesigns better than long path selectors.

### Manual selector entry

You can always type or paste a selector directly into the selector field. This is useful when:

- The picker cannot reach the element because it appears only after hover, focus, or scrolling.
- You need a broader selector, such as `.product-card` for a repeated list.
- You already know a stable app-specific selector.

Use your browser DevTools to test selectors with `document.querySelector(...)` or `document.querySelectorAll(...)` before saving a complex workflow.

## Native Mode vs. Standard Mode

Action nodes include a `Bypass Bot Detection` toggle. This enables Native Mode for that node.

### Standard Mode

Standard Mode uses DOM and JavaScript events from the content script. It is fast, works well for most sites, and is usually easier to debug. For example, standard typing updates the target element and dispatches input/change events so many React, Vue, and form-driven pages react normally.

Use Standard Mode first for ordinary buttons, links, inputs, scraping, highlighting, and waits.

### Native Mode

Native Mode uses browser-level input through the extension background process and Chrome Debugger Protocol. It sends lower-level mouse and keyboard events, closer to real user input than synthetic JavaScript events.

Turn on `Bypass Bot Detection` when:

- A site ignores synthetic clicks or typed values.
- A custom control reacts only to real pointer or keyboard events.
- Anti-automation logic blocks ordinary DOM events.
- You need coordinates captured during recording.

Native Mode may require the page to be focused and may be more sensitive to scroll position, viewport size, and timing. For Native typing, the selector can be optional when the correct field is already focused, but providing a selector is safer when possible.

## Managing Workflows

### Importing workflows

From the workflow list, click `Import` and choose a `.flowscript` or JSON manifest file. Flowscript validates the manifest before adding it. Imported workflows are saved as a new workflow and named with an `(Imported)` suffix.

If a manifest does not include visual positions, Flowscript automatically lays out the nodes on the canvas.

### Exporting workflows

Open a workflow and click the export button in the canvas header. Flowscript downloads a `.flowscript` file containing the workflow JSON manifest.

When exporting from Code view, the JSON must be valid and match the workflow schema. When exporting from Canvas view, Flowscript converts the current graph into a manifest for you.

### Renaming workflows

Open a workflow and edit the name field in the top bar. The new name is saved automatically and is used for the workflow list and exported file name.

### Deleting workflows

You can delete workflows from either place:

- Workflow list: click the delete button on a workflow card.
- Canvas header: open a workflow and click the delete button.

Deletion asks for confirmation and removes the saved workflow from local extension storage. Export a workflow first if you may need it later.
