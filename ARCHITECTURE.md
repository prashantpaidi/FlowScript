# Flowscript Architecture

## High-Level Overview

Flowscript is a configurable browser automation engine built as a browser extension. It allows users to define triggers (like custom hotkeys or page loads) that execute automated actions (like clicking DOM elements or highlighting text) on targeted websites.

The extension is built using:
- **Framework:** [WXT](https://wxt.dev/) (Next-gen framework for browser extensions)
- **UI library:** React 19
- **Styling:** Tailwind CSS v4
- **Manifest Version:** MV3 (Manifest V3)

## Core Components

The architecture follows standard WebExtension patterns, managed by WXT:

### 1. Side Panel (`entrypoints/sidepanel/App.tsx`)
The primary user interface of the extension. It provides:
- A form to configure new automations, selecting triggers (Hotkey or Page Load) and actions (Click Element or Highlight Text), alongside URL regex rules.
- A list of all active automations managed by the user, with options to remove them.
- A real-time activity log showing executed automations and system feedback.
- Uses `wxt/storage` to persist state across the extension.

### 2. Content Script (`entrypoints/content/index.ts`)
The execution engine of the extension.
- Injected into `<all_urls>` (all web pages).
- Listens to active automations from `wxt/storage`.
- Evaluates **Page Load** triggers immediately upon script initialization.
- Attaches a global `keydown` event listener for **Hotkey** triggers. When a key is pressed, it checks if the user is typing in an input/textarea (and ignores if so).
- Before executing any automation, it verifies if the current page URL matches the automation's `urlRegex`.
- Executes defined actions based on their type:
  - `click`: Finds the element by selector and clicks it.
  - `highlight`: Uses a `TreeWalker` to find text matching a regex within a specific scope and wraps it in a colored `<mark>` element.
- Writes a log entry back to the shared storage for each execution or failure.

### 3. Background Script (`entrypoints/background/index.ts`)
A lightweight service worker that initializes the extension.
- Listens to when the user clicks the extension icon in the toolbar.
- Ensures the side panel opens automatically when the action icon is clicked.

## Data Flow & State Management

State is synced globally between the Side Panel and Content Scripts using the `wxt/storage` API. This relies on the `chrome.storage.local` API underneath.

The application uses two main storage keys:
1. `local:automations`: An array of configured automations.
2. `local:logs`: An array of recent activity log entries (capped at 50 entries).

When a user adds an automation in the Side Panel, it is written to `local:automations`. The Content Script actively watches this storage key using `storage.watch()` and updates its internal list immediately, ensuring hotkeys take effect without needing a page refresh.

## Data Models

The common data structures used across the extension:

```typescript
// Triggers define what initiates the automation
interface Trigger {
  type: 'hotkey' | 'pageload';
  key?: string; // Required for 'hotkey'
}

// Actions define what the automation does
interface Action {
  type: 'click' | 'highlight';
  selector?: string; // Used for 'click'
  scope?: string;    // Used for 'highlight' (CSS selector)
  regex?: string;    // Used for 'highlight' (text pattern)
  color?: string;    // Used for 'highlight' (background color)
}

// An Automation ties a trigger and action together, optionally constrained by URL
interface Automation {
  trigger: Trigger;
  action: Action;
  urlRegex?: string; // Regex pattern to restrict which sites the automation runs on
}

// Activity logs
interface LogEntry {
  timestamp: number; // Unix timestamp
  message: string;   // The log text
}
```

## Security & Permissions

Defined in `wxt.config.ts`, the extension requires:
- `sidePanel`: To render the main UI inside the browser's side panel.
- `storage`: To persist user automations and logs locally.
- `tabs`: To allow the side panel to query the active tab's URL (for URL regex preset suggestions).
