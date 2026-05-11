import { NodeHandler } from '../registry';

export const handleWait: NodeHandler = async (config) => {
  const delay = config.delay ?? 2000;
  console.log(`[Flowscript] Waiting for ${delay}ms...`);
  await new Promise(resolve => setTimeout(resolve, delay));
  return { waited: true, delay };
};
