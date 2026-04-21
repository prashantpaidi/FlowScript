import { WorkflowManifest, validateManifest } from './schema';

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
  link.download = `${workflow.name || 'workflow'}.flowscript`;
  
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
    
    input.onchange = async (e: Event) => {
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
        reject(new Error(err.errors?.[0]?.message || err.message || 'Invalid workflow file'));
      }
    };
    
    input.onerror = (err) => reject(err);
    input.click();
  });
}
