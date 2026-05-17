---
title: Variable System
description: "Use placeholders, node outputs, trigger data, secrets, and transform nodes to build dynamic workflows."
---

Variables make workflows data-driven. They let one node reuse values produced by another node, include runtime metadata like the current URL, and build dynamic text, selectors, dataset names, or API payloads.

## Template syntax

Flowscript variables use double-curly placeholders:

```text
{{ $sys.url }}
{{ $trigger.url }}
{{ $node.Scraper.price }}
```

Whitespace inside the braces is allowed. These two placeholders are equivalent:

```text
{{$sys.url}}
{{ $sys.url }}
```

Placeholders can appear inside longer strings:

```text
Order captured from {{$sys.url}} at {{$sys.datetime}}
```

If Flowscript cannot find a value, it leaves the original placeholder in place. This makes missing variables easier to spot while testing.

## Variable scoping

Variable names are scoped by their prefix. The three runtime scopes currently resolved by the workflow engine are `$sys`, `$trigger`, and `$node`.

### System variables: `$sys`

System variables come from the workflow runtime.

| Variable | Value |
| --- | --- |
| `$sys.date` | Local date string. |
| `$sys.time` | Local time string. |
| `$sys.datetime` | ISO datetime string. |
| `$sys.now` | Unix timestamp in milliseconds. |
| `$sys.uuid` | New random UUID. |
| `$sys.url` | Current page URL. |
| `$sys.browser` | Browser name when available. |
| `$sys.platform` | Current platform string. |

Examples:

```text
run-{{$sys.uuid}}
Captured on {{$sys.date}} from {{$sys.url}}
```

Use `$sys.uuid` for unique dataset names, record IDs, or outbound request IDs. Use `$sys.url` when saved data needs to preserve where it came from.

### Trigger variables: `$trigger`

Trigger variables come from the event that started the workflow. For example, a page-load trigger may include URL-like event data, and hotkey-triggered flows can include trigger metadata passed by the runtime.

Examples:

```text
{{$trigger.url}}
{{$trigger.triggeredAt}}
```

Use `$trigger` when you need the start-of-flow context. Use `$sys` when you need the current runtime environment at the moment a node executes.

### Node variables: `$node`

Node variables let downstream nodes read upstream node outputs.

The basic shape is:

```text
{{$node.NodeAlias.outputKey}}
```

For reliable node variables, give important nodes a short alias in the node header. For example, if a Scrape node has the alias `Scraper` and outputs a field named `price`, later nodes can use:

```text
{{$node.Scraper.price}}
```

Scrape and transform outputs can also be accessed through their full output object:

```text
{{$node.Scraper.data}}
{{$node.CleanPrice.result}}
```

Flowscript also supports explicit `.data` access when a node output contains nested data:

```text
{{$node.Scraper.data.price}}
```

The variable picker only shows upstream nodes that can feed the current node. If a value does not appear in the picker, check that the producing node is connected before the consuming node and has a clear alias or output key.

## Secrets management

Secrets are for sensitive values such as API keys, tokens, usernames, or private endpoint credentials. Store secrets in the Secrets tab instead of hard-coding them into workflow fields.

The intended template form is:

```text
{{$secrets.API_KEY}}
```

Current runtime note: `$secrets` placeholders are not resolved by the variable resolver in this checkout yet. The docs and UI mention secrets as a supported product concept, but workflow execution currently resolves `$sys`, `$trigger`, and `$node`. Treat `{{$secrets.API_KEY}}` as the planned secure access pattern until the resolver is wired to the secrets store.

When secrets are enabled end to end:

- Use descriptive names such as `OPENAI_API_KEY`, `ZAPIER_WEBHOOK_URL`, or `CRM_TOKEN`.
- Avoid placing secrets in exported workflow manifests.
- Prefer secrets in headers or request settings instead of directly inside visible text fields.
- Rotate a secret if it was pasted into a workflow by mistake.

## Data transformation

Use the Transform node when data needs cleanup before it is typed, saved, compared, or sent elsewhere.

The Transform node evaluates a JavaScript expression. It receives:

| Name | Meaning |
| --- | --- |
| `input` | The configured input value, or all upstream inputs when no explicit input is configured. |
| `inputs` | All incoming values from connected upstream nodes. |

The expression should return the transformed value. Flowscript stores that value as `result`, `data`, and under the configured output key.

### Clean strings

Remove whitespace around scraped text:

```js
inputs.price.trim()
```

Normalize repeated whitespace:

```js
inputs.title.replace(/\s+/g, " ").trim()
```

Remove currency symbols:

```js
inputs.price.replace(/[$,]/g, "")
```

### Format numbers

Convert a scraped price to a number:

```js
Number(inputs.price.replace(/[$,]/g, ""))
```

Round a value to two decimal places:

```js
Number(input).toFixed(2)
```

Build a structured object for saving:

```js
({
  price: Number(inputs.price.replace(/[$,]/g, "")),
  capturedAt: Date.now(),
  source: inputs.url
})
```

## Practical patterns

### Dynamic typing

Use a scrape node to capture a value, then use it in a Type node:

```text
Current price: {{$node.Scraper.price}}
```

### Dynamic dataset names

Use system variables in Save Data dataset names:

```text
orders-{{$sys.date}}
```

For file-system-safe or analytics-friendly names, prefer a Transform node that formats the date exactly how you want.

### Passing cleaned data downstream

1. Scrape a value with alias `Scraper`.
2. Add a Transform node with alias `CleanPrice`.
3. Use an expression such as:

```js
Number(inputs.price.replace(/[$,]/g, ""))
```

4. In later nodes, reference:

```text
{{$node.CleanPrice.result}}
```
