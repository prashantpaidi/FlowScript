export type PortType = 'trigger' | 'data' | 'control';

export interface WorkflowNode {
  id: string;
  type: string;
  subtype: string;
  alias?: string;
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

export type NodeSubtype = 'click' | 'highlight' | 'pressKey' | 'type' | 'scrape' | 'saveData' | 'elementExists' | 'jsExpression' | 'transform' | 'clipboard' | 'webhook' | 'dynamicForm' | 'staticTable';

export interface WebhookNodeData {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: string;
  body?: string;
  responseType?: 'json' | 'text';
}

export interface MappingRow {
  id: string;
  label: string;
  include: string[];
  exclude: string[];
  value: string;
  isNative: boolean;
}

export interface DynamicFormNodeData {
  mappings: MappingRow[];
}

export interface UrlScope {
  pattern: string; // If empty, allow all websites
  matchIframes?: boolean; // false by default
}

export interface TableData {
  columns: string[];
  rows: Record<string, any>[];
  alias: string;
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

export type ColumnType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  options?: string[];
}

export interface TableSchema {
  id: string;
  name: string;
  columns: ColumnDefinition[];
  updatedAt: number;
}

export interface TableRow {
  id?: number;
  tableId: string;
  timestamp: number;
  data: Record<string, any>;
}

