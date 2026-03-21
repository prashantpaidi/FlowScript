# Flowscript

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![WXT](https://img.shields.io/badge/WXT-0.20-green)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-cyan?logo=tailwindcss)

**Flowscript** is a configurable browser automation engine built as a modern browser extension. It empowers users to define custom hotkeys that trigger automated actions (like clicking specific elements) on targeted websites.

## 🚀 Features

- **Hotkey Recording**: Intuitive side panel interface to easily record complex keyboard shortcuts (e.g., `ctrl+shift+k`).
- **Configurable Automations**: Map custom hotkeys to specific CSS selectors to automate clicks.
- **URL Contexts**: Restrict automations to run only on specific websites or pages using Regular Expressions, complete with handy built-in presets.
- **Activity Logging**: View a real-time log of triggered automations and system feedback directly in the extension's side panel.
- **Modern Tech Stack**: Built with WXT (Next-gen framework for browser extensions), React 19, and Tailwind CSS v4.

## 🏗️ Architecture & Entrypoints

The extension is beautifully structured around standard WebExtension entrypoints, powerfully managed by the WXT framework:

- **Background Script** (`entrypoints/background/index.ts`): Initializes the extension and handles global events, such as ensuring the side panel opens when the extension action icon is clicked.
- **Side Panel** (`entrypoints/sidepanel/App.tsx`): The primary user interface. It provides the form to add new automations, lists active automations, and displays the activity log. State configuration is persisted globally using the robust `wxt/storage` API (`local:automations` and `local:logs`).
- **Content Script** (`entrypoints/content/index.ts`): Injected seamlessly into `<all_urls>`. It actively listens for keyboard events, securely matches them against the configured automations (respecting URL regex constraints), and instantly executes the corresponding actions (e.g., clicking DOM elements). It simultaneously pushes execution logs back to the shared storage.
- **Popup** (`entrypoints/popup/App.tsx`): Default WXT+React popup fallback, though the primary UI is within the side panel.

## 🛠️ Development

This project heavily utilizes `wxt` for a streamlined developer experience.

### Prerequisites

Ensure you have Node.js and your preferred package manager (e.g., `npm`, `yarn`, `pnpm`, or `bun`) installed.

### Installation

1. Clone the repository.
2. Install the dependencies:

```bash
npm install # or bun install
```

### Running Locally

To start the development server with Hot Module Replacement (HMR) seamlessly loading the extension into your browser:

```bash
# For Chrome
npm run dev

# For Firefox
npm run dev:firefox
```

### Building for Production

To compile and bundle the extension for production deployment:

```bash
npm run build

# Or package it as a distributable zip file:
npm run zip
```
