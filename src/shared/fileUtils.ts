import { WorkflowManifest, validateManifest } from './schema';

/**
 * Sanitizes a filename by removing or replacing invalid characters.
 * @param name The filename to sanitize
 * @returns A safe filename or 'workflow' if the result is empty
 */
function sanitizeFilename(name: string): string {
  // Trim whitespace and trailing dots
  let sanitized = name.trim().replace(/\.+$/g, '');

  // Replace or remove invalid filesystem characters: / \ : * ? " < > | and newlines
  sanitized = sanitized.replace(/[/\\:*?"<>|\n\r]/g, '_');

  // Return fallback if empty after sanitization
  return sanitized || 'workflow';
}

/**
 * Triggers a browser download of a .flowscript file (JSON manifest).
 * @param workflow The workflow manifest to export.
 */
export function exportWorkflow(workflow: WorkflowManifest) {
  const json = JSON.stringify(workflow, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(workflow.name)}.flowscript`;

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a file picker, reads the file content, validates the schema,
 * and returns the validated manifest.
 * @returns A promise resolving to the validated WorkflowManifest.
 */
export async function importWorkflow(): Promise<WorkflowManifest> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.flowscript,application/json';

    const handleChange = async (e: Event) => {
      // Clean up listeners
      input.onchange = null;
      input.removeEventListener('cancel', handleCancel);

      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const validated = validateManifest(json);
        resolve(validated);
      } catch (err: any) {
        console.error('Import failed:', err);
        reject(new Error(err.issues?.[0]?.message || err.message || 'Invalid workflow file'));
      }
    };

    const handleCancel = () => {
      // Clean up listeners
      input.onchange = null;
      input.removeEventListener('cancel', handleCancel);

      reject(new Error('No file selected'));
    };

    input.onchange = handleChange;
    input.addEventListener('cancel', handleCancel);

    input.click();
  });
}