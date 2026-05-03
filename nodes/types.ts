export type PortType = 'trigger' | 'data' | 'control';

export interface WorkflowNode {
  id: string;
  type: string;
  subtype: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  measured?: { width: number; height: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: PortType;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  updatedAt: number;
}

export type NodeSubtype = 'click' | 'highlight' | 'pressKey' | 'type' | 'scrape' | 'saveData' | 'elementExists' | 'jsExpression';

export interface UrlScope {
  pattern: string; // If empty, allow all websites
  matchIframes?: boolean; // false by default
}

export interface ActionNodeData {
  [key: string]: any;
  subtype?: NodeSubtype | string;
  selector?: string;
  scope?: string;
  regex?: string;
  expr?: string;
  color?: string;
  isNative?: boolean;
  delayMs?: number;
  keys?: string[];
  urlScope?: UrlScope;
  onUpdate?: (newData: any) => void;
  onRemove?: () => void;
}