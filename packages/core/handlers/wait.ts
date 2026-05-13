import { ExecutionContext } from '../environment';

export async function handleWait(config: Record<string, any>, _inputs: Record<string, any>, _context: ExecutionContext) {
  const ms = config.delayMs ?? 1000;
  console.log(`[Flowscript] Waiting for ${ms}ms...`);
  await new Promise(r => setTimeout(r, ms));
  return { success: true };
}
