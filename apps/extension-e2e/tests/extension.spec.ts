import { test, expect } from '../fixtures.js';

test.describe('FlowScript Extension E2E', () => {
  test('Popup page should load and display react logo and title', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Check main title
    const heading = page.locator('h1');
    await expect(heading).toHaveText('WXT + React');
    
    // Check interactive count button
    const counterBtn = page.locator('button');
    await expect(counterBtn).toContainText('count is 0');
    await counterBtn.click();
    await expect(counterBtn).toContainText('count is 1');
  });

  test('Side panel should load and show Flowscript heading and navigation tabs', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    
    // Verify main header
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Flowscript');
    
    // Verify tab buttons
    const workflowsTab = page.locator('button', { hasText: 'Workflows' });
    const logsTab = page.locator('button', { hasText: 'Logs' });
    const secretsTab = page.locator('button', { hasText: 'Secrets' });
    
    await expect(workflowsTab).toBeVisible();
    await expect(logsTab).toBeVisible();
    await expect(secretsTab).toBeVisible();
  });

  test('should execute click and type automation actions successfully', async ({ context, page, extensionId }) => {
    // 1. Open the popup page first (it has no storage auto-initialization side-effects)
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // 2. Programmatically seed the click and type workflow into extension storage
    const workflow = {
      id: 'e2e-click-type-workflow',
      name: 'E2E Click Type Test',
      nodes: [
        {
          id: 'trigger-1',
          type: 'triggerNode',
          subtype: 'pageload',
          data: {
            urlScope: {
              pattern: '^https:\\/\\/example\\.com\\/.*$',
              matchIframes: false
            }
          },
          position: { x: 0, y: 0 }
        },
        {
          id: 'type-1',
          type: 'actionNode',
          subtype: 'type',
          data: {
            selector: '#my-input',
            text: 'Hello World from E2E'
          },
          position: { x: 200, y: 0 }
        },
        {
          id: 'click-1',
          type: 'actionNode',
          subtype: 'click',
          data: {
            selector: '#my-button'
          },
          position: { x: 400, y: 0 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'type-1', sourceHandle: 'trigger', targetHandle: 'trigger-in' },
        { id: 'e2', source: 'type-1', target: 'click-1', sourceHandle: 'trigger-out', targetHandle: 'trigger-in' }
      ],
      updatedAt: Date.now()
    };

    await page.evaluate(async (wf) => {
      await chrome.storage.local.set({ 
        workflows: [wf],
        'local:workflows': [wf]
      });
    }, workflow);

    // 3. Open the sidepanel page (it will read our seeded workflow and not overwrite it)
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Give a short delay for the reactive listeners to register the seeded workflow
    await page.waitForTimeout(500);

    // 3. Create a target page and intercept network request to return our mock HTML page
    const targetPage = await context.newPage();
    targetPage.on('console', msg => console.log('PAGE_CONSOLE:', msg.text()));
    targetPage.on('pageerror', err => console.log('PAGE_ERROR:', err.message));

    await targetPage.route('https://example.com/', route => {
      route.fulfill({
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
          <head><title>E2E Test Page</title></head>
          <body>
            <input id="my-input" type="text" />
            <button id="my-button" onclick="document.getElementById('my-input').value = 'button clicked'">Click Me</button>
          </body>
          </html>
        `
      });
    });

    // 4. Navigate to the page. This should trigger the pageload workflow
    await targetPage.goto('https://example.com/');

    // 5. Assert that both type and click actions executed successfully
    // (typing focuses, then click changes the value to 'button clicked' via onclick)
    const input = targetPage.locator('#my-input');
    await expect(input).toHaveValue('button clicked', { timeout: 15000 });

    // Wait for the workflow execution to be marked as completed in storage
    await page.waitForFunction(async () => {
      const data = await chrome.storage.local.get('executionState');
      return data?.executionState?.status === 'completed';
    }, null, { timeout: 10000 });

    // Give a brief moment for the sidepanel components to sync and render
    await page.waitForTimeout(1000);

    // 6. Go to the sidepanel page and check the Activity Logs tab
    const logsTab = page.locator('button', { hasText: 'Logs' });
    await logsTab.click();

    // Verify workflow run log exists and succeeded
    const runHeader = page.locator('text=E2E Click Type Test');
    await expect(runHeader).toBeVisible();

    // Check if the first log line is visible. If not, perform targeted expansion.
    const firstLogLine = page.locator('text=Workflow execution started');
    if (!(await firstLogLine.isVisible())) {
      const generalHeader = page.locator('text=General');
      if (!(await generalHeader.isVisible())) {
        await runHeader.click();
      }
      await expect(generalHeader).toBeVisible();
      if (!(await firstLogLine.isVisible())) {
        await generalHeader.click();
      }
    }

    // Assert that the completion log appears (waits for storage sync if needed)
    const logLine = page.locator('text=Node click executed successfully.');
    await expect(logLine).toBeVisible({ timeout: 10000 });

    await targetPage.close();
  });
});

// 
