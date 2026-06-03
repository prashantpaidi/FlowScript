export interface LinearNode {
  id: string;
  type: string;       // 'triggerNode' | 'actionNode' | 'conditionalNode' | etc.
  subtype: string;
  data: Record<string, any>;
  // Only present on ConditionalNodes:
  branchTrue?: LinearNode[];
  branchFalse?: LinearNode[];
}

export interface LinearWorkflow {
  id: string;
  name: string;
  linearNodes: LinearNode[];  // top-level linear chain
  updatedAt: number;
}
