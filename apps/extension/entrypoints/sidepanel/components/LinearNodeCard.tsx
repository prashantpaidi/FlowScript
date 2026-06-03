import React from 'react';
import { 
  Play, MousePointer, Keyboard, Clock, Search, Database, 
  GitBranch, Globe, Code, Clipboard, Table, FileText, X 
} from 'lucide-react';
import { useWorkflowStore } from '../../../src/store/useWorkflowStore';
import { LinearNode } from '../../../src/types/linear';
import {
  TriggerNode,
  ActionNode,
  ScrapeNode,
  SaveDataNode,
  ConditionalNode,
  TransformNode,
  WebhookNode,
  DynamicFormNode,
  StaticTableNode,
} from '@flowscript/ui';

const NODE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  scrapeNode: ScrapeNode,
  conditionalNode: ConditionalNode,
  saveDataNode: SaveDataNode,
  transformNode: TransformNode,
  webhookNode: WebhookNode,
  dynamicFormNode: DynamicFormNode,
  staticTableNode: StaticTableNode,
};

function getSubtypeInfo(subtype: string) {
  switch (subtype) {
    // Triggers
    case 'hotkey':
      return { icon: Keyboard, label: 'Hotkey Trigger' };
    case 'pageload':
      return { icon: Globe, label: 'Page Load Trigger' };
    // Actions
    case 'click':
      return { icon: MousePointer, label: 'Click Element' };
    case 'type':
      return { icon: Keyboard, label: 'Type Text' };
    case 'pressKey':
      return { icon: Keyboard, label: 'Press Key' };
    case 'wait':
      return { icon: Clock, label: 'Wait Delay' };
    case 'scrape':
      return { icon: Search, label: 'Scrape Data' };
    case 'saveData':
      return { icon: Database, label: 'Save Data' };
    case 'elementExists':
      return { icon: GitBranch, label: 'Check Element Exists' };
    case 'jsExpression':
      return { icon: Code, label: 'Check JS Expression' };
    case 'transform':
      return { icon: Code, label: 'Transform JS' };
    case 'webhook':
      return { icon: Globe, label: 'Webhook HTTP Request' };
    case 'clipboard':
      return { icon: Clipboard, label: 'Clipboard Action' };
    case 'staticTable':
      return { icon: Table, label: 'Static Table Data' };
    case 'dynamicForm':
      return { icon: FileText, label: 'Dynamic Form Mappings' };
    default:
      return { icon: Play, label: subtype.charAt(0).toUpperCase() + subtype.slice(1) };
  }
}

export function LinearNodeCard({ node }: { node: LinearNode }) {
  const { removeNode, executionState } = useWorkflowStore();
  const Component = NODE_COMPONENTS[node.type] || ActionNode;

  const isCurrent = executionState?.currentNodeId === node.id;
  const { icon: Icon, label } = getSubtypeInfo(node.subtype);

  return (
    <div 
      className={`w-[320px] bg-white border border-slate-200 rounded-2xl shadow-sm transition-all relative flex flex-col overflow-hidden ${
        isCurrent 
          ? 'ring-2 ring-indigo-500 border-transparent shadow-lg scale-[1.02] z-10' 
          : 'hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Unified Custom Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl select-none">
        <div className="flex items-center gap-2.5 text-slate-700 font-extrabold text-xs tracking-tight">
          <Icon size={15} className="text-indigo-500 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <button 
          onClick={() => removeNode(node.id)}
          className="text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg p-1.5 transition-all cursor-pointer"
          title="Remove Node"
        >
          <X size={14} />
        </button>
      </div>

      {/* Render the original UI config form inside a styled wrapper */}
      <div className="linear-node-card-content p-1 bg-white">
        <Component id={node.id} data={node.data} />
      </div>
    </div>
  );
}
