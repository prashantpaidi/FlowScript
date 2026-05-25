import React, { useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Panel,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import {
  TriggerNode,
  ActionNode,
  ScrapeNode,
  SaveDataNode,
  ConditionalNode,
  OutputNode,
  TransformNode,
  WebhookNode,
  DynamicFormNode,
  StaticTableNode,
} from '@flowscript/ui';
import { useWorkflowStore } from '../../../src/store/useWorkflowStore';
import { automationBridge } from '../../../src/services/AutomationBridge';

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  scrapeNode: ScrapeNode,
  conditionalNode: ConditionalNode,
  saveDataNode: SaveDataNode,
  outputNode: OutputNode,
  transformNode: TransformNode,
  webhookNode: WebhookNode,
  dynamicFormNode: DynamicFormNode,
  staticTableNode: StaticTableNode,
};

interface FlowCanvasProps {
  workflowId: string;
}

export function FlowCanvas({ workflowId }: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    executionState,
    updateNodeData,
    removeNode,
  } = useWorkflowStore();

  const handleStopWorkflow = async () => {
    if (!executionState?.workflowId) return;
    await automationBridge.stopWorkflow(executionState.workflowId);
  };

  const processedNodes = useMemo(() => {
    const isThisWorkflowExecuting = executionState && executionState.workflowId === workflowId && (executionState.status === 'running' || executionState.status === 'stopping');
    const currentNodeId = isThisWorkflowExecuting ? executionState.currentNodeId : null;

    return nodes.map(n => {
      if (n.id === currentNodeId) {
        return {
          ...n,
          style: {
            ...n.style,
            boxShadow: '0 0 0 4px #6366f1, 0 10px 15px -3px rgba(99, 102, 241, 0.4)',
            borderColor: '#6366f1',
            transform: 'scale(1.02)',
            transition: 'all 0.3s ease-in-out',
          }
        };
      }
      return n;
    });
  }, [nodes, executionState, workflowId]);

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newNodeId = crypto.randomUUID();
    let subtype = '';
    if (type === 'triggerNode') subtype = 'hotkey';
    else if (type === 'actionNode') subtype = 'click';
    else if (type === 'scrapeNode') subtype = 'scrape';
    else if (type === 'conditionalNode') subtype = 'elementExists';
    else if (type === 'saveDataNode') subtype = 'saveData';
    else if (type === 'transformNode') subtype = 'transform';
    else if (type === 'webhookNode') subtype = 'webhook';
    else if (type === 'dynamicFormNode') subtype = 'dynamicForm';
    else if (type === 'staticTableNode') subtype = 'staticTable';

    const newNode: Node = {
      id: newNodeId,
      type,
      position,
      data: {
        subtype,
      },
    };

    addNode(newNode);
  };

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={processedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap zoomable pannable />
        {executionState && executionState.workflowId === workflowId && (executionState.status === 'running' || executionState.status === 'stopping') && (
          <Panel position="top-center" className="z-50 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl rounded-xl p-3 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-gray-700">
                    {executionState.status === 'stopping' ? 'Stopping...' : 'Running'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold mt-0.5">
                    {executionState.loopProgress
                      ? `Processing Row ${executionState.loopProgress.index + 1} of ${executionState.loopProgress.total}`
                      : 'Executing nodes...'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleStopWorkflow}
                disabled={executionState.status === 'stopping'}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 border border-red-600 cursor-pointer"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z"/>
                </svg>
                Stop
              </button>
            </div>
          </Panel>
        )}
        <Panel position="top-right" className="bg-white/80 backdrop-blur p-1 px-2 rounded-md shadow-sm border border-gray-200 pointer-events-none">
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Workflow Builder</div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
