import { ExecutionContext } from '../environment';

export async function handleWait(config: Record<string, any>, _inputs: Record<string, any>, context: ExecutionContext) {
  const ms = config.delayMs ?? config.delay ?? 1000;
  console.log(`[Flowscript] Waiting for ${ms}ms...`);
  await new Promise(r => setTimeout(r, ms));
  return {
    data: { success: true },
    nextNodeId: context.getNextNodeId ? context.getNextNodeId() : undefined
  };
}
