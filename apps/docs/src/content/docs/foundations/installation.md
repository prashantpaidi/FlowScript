---
title: Installation Guide
description: Load Flowscript as an unpacked extension in Chrome or Firefox and understand the required permissions.
---

Flowscript is currently loaded as an unpacked development extension. Build the extension first, then point your browser at the generated output directory.

## Build the extension

From the repository root, install dependencies and build the extension:

```bash
bun install
bun run build
```

For local development with hot reload, run:

```bash
bun run dev
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated Chrome extension output folder from `apps/extension/.output/chrome-mv3` (or `apps/extension/.output/chrome-mv3-dev` when running `bun run dev`).
5. Pin Flowscript if you want quick access from the toolbar.

When using `bun run dev`, keep the dev process running while you test the extension.

## Load in Firefox

Build or run the Firefox target:

```bash
bun --cwd apps/extension dev:firefox
```

Then load the temporary extension:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select the generated manifest file from the Firefox output folder.

Temporary Firefox add-ons are removed when the browser restarts, so you may need to load Flowscript again during development.

## Permissions overview

Flowscript asks for browser permissions because it needs to coordinate actions across extension entrypoints and web pages.

| Permission | Why Flowscript needs it |
| --- | --- |
| `debugger` | Runs native browser automation through the browser debugging protocol for realistic clicks, typing, and key presses. |
| `sidePanel` | Opens the main workflow builder in the browser side panel. |
| Storage access | Saves workflows, logs, secrets, and captured data locally. |
| Host/page access | Lets content scripts observe pages, locate elements, and execute workflow steps in the active browser context. |

Only load development builds you trust. Extension permissions are powerful by design.
