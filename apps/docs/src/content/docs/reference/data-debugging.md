---
title: Data & Debugging
description: "Use the Data Dashboard, activity logs, and browser developer tools to inspect results and fix workflow failures."
---

Flowscript gives you two main feedback surfaces after a workflow runs: saved data in the Dashboard and execution messages in Activity Logs. Use the Dashboard to inspect results, and use logs plus the browser console when a workflow does not behave as expected.

## Data Dashboard

The Data Dashboard is the workspace for inspecting scraped records. Open it from the side panel with the Dashboard button.

### Managing datasets in IndexedDB

Saved data is stored locally in IndexedDB through the `FlowscriptDB` database. The main table is `scrapedRecords`, indexed by:

| Field | Purpose |
| --- | --- |
| `id` | Auto-incrementing record ID. |
| `workflowId` | Workflow that produced the record. |
| `datasetName` | Dataset configured in the Save Data node. |
| `timestamp` | Time the record was saved. |

Each record also stores the source `url` and the scraped `data` payload.

Use dataset names intentionally. A good dataset name should describe what the workflow collects, such as `daily-products`, `lead-search-results`, or `support-tickets`.

### Filtering and searching scraped data

The Dashboard supports several ways to narrow records:

- Select a dataset in the sidebar to view only that dataset.
- Use the global search box to search visible records.
- Use column filters for specific fields.
- Use Advanced Filters for grouped `AND` / `OR` rules.

Advanced Filters support operators such as equals, not equals, contains, starts with, ends with, greater than, and less than. Numeric-looking fields can also be filtered by range.

### Exporting to CSV

Use CSV export when you need to move data into a spreadsheet, database, or external reporting system.

You can export:

- The current dataset or all data from the Dashboard header.
- Selected rows from the table bulk action bar.

CSV exports include metadata columns such as ID, dataset, workflow ID, URL, and timestamp. When scraped records contain structured object data, the Dashboard expands the dynamic fields into columns.

## Troubleshooting

Start with Activity Logs, then use the browser console when you need lower-level page or extension details.

### Reading the Activity Logs

Open the side panel and switch to Logs. Activity Logs are stored in `local:logs` and update as workflows run.

Use logs to answer:

- Did the workflow trigger?
- Which node failed?
- Did a selector resolve?
- Did native mode attach the debugger?
- Did the Save Data node receive data?

If a workflow fails repeatedly, clear the logs, run the workflow once, then read the newest entries from top to bottom.

### Common errors

#### Selector not found

This usually means the selector did not match any element before the timeout.

Try:

- Re-pick the element with the Element Picker.
- Prefer stable attributes such as `data-testid`, `name`, or `aria-label`.
- Add a Wait node before the action if the page loads content slowly.
- Confirm the selector in DevTools with `document.querySelector("...")`.
- Check whether the element is inside an iframe or shadow DOM.

#### Debugger detached

Native Mode uses the Chrome Debugger Protocol. If the debugger detaches, native clicks, native typing, keypresses, and JS evaluation may fail.

Try:

- Keep the target tab open and focused while native actions run.
- Disable other extensions or DevTools sessions that may attach to the same tab.
- Re-run the workflow after the page finishes loading.
- Toggle Bypass Bot Detection off for nodes that do not need native input.

#### CORS issues

CORS problems usually appear when a workflow or future integration tries to send data directly from the page context to another origin.

Try:

- Prefer extension/background-mediated requests for integrations.
- Use server endpoints that allow requests from the extension.
- Verify allowed methods and headers on the receiving API.
- For webhooks, test the endpoint with a small payload before sending scraped production data.

### Debugging with the Browser Console

Open DevTools with `F12` on the target page when a workflow interacts with the DOM. The Console can help you test selectors, inspect page state, and see page-level errors.

Useful checks:

```js
document.querySelector("#submit")
document.querySelectorAll(".product-card").length
window.location.href
```

For extension-level issues, inspect the extension background service worker from the browser extension management page. That is where native bridge messages, debugger attach/detach errors, and saved-data failures are most likely to appear.

When debugging, change one thing at a time: selector, timing, native mode, or node wiring. Small changes make it much easier to identify the real failure.
