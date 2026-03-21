# Flowscript Architecture

## High-Level Overview

Flowscript is a configurable browser automation engine built as a browser extension. It allows users to define custom hotkeys that trigger automated actions (like clicking specific DOM elements) on targeted websites.

The extension is built using:
- **Framework:** [WXT](https://wxt.dev/) (Next-gen framework for browser extensions)
- **UI library:** React 19
- **Styling:** Tailwind CSS v4
- **Manifest Version:** MV3 (Manifest V3)

## Core Components

The architecture follows standard WebExtension patterns, managed by WXT:

### 1. Side Panel (`entrypoints/sidepanel/App.tsx`)
The primary user interface of the extension. It provides:
- A form to record new custom hotkeys and define their corresponding CSS selectors and URL regex rules.
- A list of all active automations managed by the user, with options to remove them.
- A real-time activity log showing executed automations and system feedback.
- Uses `wxt/storage` to persist state across the extension.

### 2. Content Script (`entrypoints/content/index.ts`)
The execution engine of the extension.
- Injected into `<all_urls>` (all web pages).
- Listens to active automations from `wxt/storage`.
- Attaches a global `keydown` event listener to the `window`.
- When a key is pressed, it checks:
  1. Is the user typing in an input/textarea? (If yes, ignores the event).
  2. Does the current page URL match any automation's `urlRegex`?
  3. Does the pressed combination match the automation's hotkey trigger?
- If all conditions are met, it executes the defined action (e.g., `element.click()`) and writes a log entry back to the shared storage.

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
  type: string; // e.g., 'hotkey'
  key: string;  // e.g., 'ctrl+shift+k'
}

// Actions define what the automation does
interface Action {
  type: string;     // e.g., 'click'
  selector: string; // The CSS selector of the target element
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
