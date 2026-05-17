---
title: Introduction
description: Understand what Flowscript is and when it is more useful than a simple macro recorder.
---

Flowscript is a visual browser automation engine packaged as a browser extension. Instead of recording a short sequence of clicks and hoping the page looks the same next time, you build a workflow from nodes that can type, click, scrape, branch, save data, and react to browser events.

## Why not a macro recorder?

Macro recorders are useful for quick repetition, but they tend to be fragile. They often depend on exact screen positions, timing, or a single happy path through a page.

Flowscript is designed for automations that need to survive real websites:

- Native browser actions can look more like real user input than script-only DOM manipulation.
- Node-based workflows make each step visible and editable.
- Conditional nodes let a workflow choose a path when a page changes.
- Scrape and save nodes turn browser actions into reusable data workflows.
- URL scopes and triggers let workflows run only in the right context.

## What Flowscript is good at

Flowscript works best for browser tasks that are repeatable but not completely linear. Examples include searching, filling forms, collecting page data, highlighting matching content, or running a sequence only after a page with a matching URL loads.

The main idea is simple: create nodes, connect them with edges, then run the workflow from the extension.

## Core concepts

- A workflow is the full automation.
- A node is one step, such as a trigger, click, type, scrape, condition, or save action.
- An edge connects one node to the next.
- A trigger starts the workflow, usually from a hotkey or page load.
- The canvas is where you arrange and connect workflow nodes.

The next step is loading Flowscript in your browser.
