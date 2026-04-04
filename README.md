# Flowscript 🌊

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![WXT](https://img.shields.io/badge/WXT-0.20-green)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-cyan?logo=tailwindcss)
![XYFlow](https://img.shields.io/badge/XYFlow-12-orange)

**Flowscript** is a powerful visual browser automation engine built as a modern browser extension. It allows users to design complex automation workflows using a drag-and-drop canvas, triggered by custom hotkeys or page events.

## 🚀 Key Features

- **Visual Workflow Builder**: Create automations using an intuitive node-based canvas (powered by React Flow). Connect triggers (Hotkeys, Page Load) to various actions.
- **DAG Execution Engine**: Sophisticated execution logic that performs a topological sort on your workflow graph to ensure actions run in the correct order.
- **Robust Element Picker**: An advanced DOM selector tool that generates multiple fallback strategies (ID, attributes, class paths) to ensure stable automation.
- **Native Browser Automation**: Bypass bot detection and interact with complex web elements using the Chrome Debugger Protocol (CDP).
- **Native Events**: Perform OS-level clicks, typing, and keypresses that are indistinguishable from real user input.
- **Hotkey Recorder**: Easily capture complex keyboard shortcuts to trigger your workflows.
- **Dynamic Content Support**: Built-in `MutationObserver` and retry logic to wait for elements on modern, reactive websites.
- **URL Contexts**: Restrict workflows to specific domains or paths using powerful Regular Expression matching.

## 🏗️ Architecture & Entrypoints

The extension leverages the WXT framework to manage standard WebExtension entrypoints efficiently:

- **Side Panel** (`entrypoints/sidepanel/App.tsx`): The primary workspace. It features a **Workflow List** to manage multiple flows and a **Flow Canvas** to design them. State is persisted via `wxt/storage` in `local:workflows`.
- **Content Script** (`entrypoints/content/index.ts`): Injected into web pages. It listens for triggers, manages the DOM element picker overlay, and manages the execution lifecycle.
- **DAG Executor** (`nodes/executor.ts`): The "brain" of the extension. It walks the workflow graph, resolves dependencies, and coordinates with the background script for native execution.
- **Background Script** (`entrypoints/background/index.ts`): Handles system-level interactions, specifically managing the `chrome.debugger` API for native automation and RPC commands.

## 🛠️ Development

### Prerequisites

Ensure you have Node.js and a package manager (e.g., `npm` or `bun`) installed.

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install # or bun install
   ```

### Running Locally

To start the development server with Hot Module Replacement (HMR):

```bash
# For Chrome
npm run dev

# For Firefox
npm run dev:firefox
```

### Testing

Run the suite of unit tests for the executor and utility functions:
```bash
npm test
```

### Building for Production

```bash
npm run build
# Package as zip:
npm run zip
```
