import React from 'react';
import { useWorkflowStore } from '../../../src/store/useWorkflowStore';
import { LinearNodeCard } from './LinearNodeCard';
import { AddNodeButton } from './AddNodeButton';
import { useZoomPan } from '../../../src/hooks/useZoomPan';
import { deriveEdgesFromNodes, flattenLinearNodes } from '../../../src/utils/deriveEdges';
import { automationBridge } from '../../../src/services/AutomationBridge';
import { StopCircle } from 'lucide-react';

interface LinearEditorProps {
  workflowId: string;
}

const ConnectorLine = () => (
  <div className="h-6 border-l-2 border-slate-300 flex-shrink-0"></div>
);

export function LinearEditor({ workflowId }: LinearEditorProps) {
  const { linearNodes, executionState } = useWorkflowStore();
  const { scale, translate, containerRef, reset } = useZoomPan();

  const handleStopWorkflow = async () => {
    if (!executionState?.workflowId) return;
    await automationBridge.stopWorkflow(executionState.workflowId);
  };

  const isThisWorkflowExecuting = executionState && 
    executionState.workflowId === workflowId && 
    (executionState.status === 'running' || executionState.status === 'stopping');

  // Recursive render function for a list of linear nodes
  const renderNodeList = (nodes: any[]) => {
    if (nodes.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col items-center w-full">
        {nodes.map((node, index) => {
          const isConditional = node.type === 'conditionalNode' || 
            node.subtype === 'elementExists' || 
            node.subtype === 'jsExpression';

          const lastTrueNodeId = node.branchTrue && node.branchTrue.length > 0
            ? node.branchTrue[node.branchTrue.length - 1].id
            : node.id;

          const lastFalseNodeId = node.branchFalse && node.branchFalse.length > 0
            ? node.branchFalse[node.branchFalse.length - 1].id
            : node.id;

          return (
            <React.Fragment key={node.id}>
              {index > 0 && <ConnectorLine />}
              <LinearNodeCard node={node} />
              
              {isConditional && (
                <>
                  <ConnectorLine />
                  <div className="w-full max-w-4xl bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center">
                    <div className="flex gap-12 w-full justify-center">
                      {/* True Branch */}
                      <div className="flex flex-col items-center flex-1 min-w-[320px]">
                        <span className="text-[10px] font-extrabold text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full mb-4 shadow-sm select-none">
                          TRUE BRANCH
                        </span>
                        <ConnectorLine />
                        {node.branchTrue && node.branchTrue.length > 0 ? (
                          <>
                            {renderNodeList(node.branchTrue)}
                            <ConnectorLine />
                          </>
                        ) : null}
                        <AddNodeButton afterId={lastTrueNodeId} branch="true" />
                      </div>

                      {/* Divider line */}
                      <div className="w-px bg-slate-200 self-stretch"></div>

                      {/* False Branch */}
                      <div className="flex flex-col items-center flex-1 min-w-[320px]">
                        <span className="text-[10px] font-extrabold text-red-500 bg-red-50 border border-red-200 px-3 py-1 rounded-full mb-4 shadow-sm select-none">
                          FALSE BRANCH
                        </span>
                        <ConnectorLine />
                        {node.branchFalse && node.branchFalse.length > 0 ? (
                          <>
                            {renderNodeList(node.branchFalse)}
                            <ConnectorLine />
                          </>
                        ) : null}
                        <AddNodeButton afterId={lastFalseNodeId} branch="false" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Connector line down to the add button */}
              <ConnectorLine />
              <AddNodeButton afterId={node.id} />
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className="flex-1 h-full relative overflow-hidden bg-slate-50 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Zoom / Pan Zoom Wrapper */}
      <div 
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'top center',
          transition: 'transform 0.05s ease-out',
        }}
        className="absolute top-0 left-0 right-0 min-h-full p-12 flex flex-col items-center"
      >
        <div className="flex flex-col items-center w-full max-w-2xl">
          {/* Prepend Add Button at the very top */}
          <AddNodeButton afterId={null} />
          
          {linearNodes.length > 0 && (
            <>
              <ConnectorLine />
              {renderNodeList(linearNodes)}
            </>
          )}
        </div>
      </div>

      {/* Execution Indicator Overlay */}
      {isThisWorkflowExecuting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-600"></span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">
                  {executionState.status === 'stopping' ? 'Stopping Execution...' : 'Workflow Running'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {executionState.loopProgress
                    ? `Processing Row ${executionState.loopProgress.index + 1} of ${executionState.loopProgress.total}`
                    : 'Executing nodes...'}
                </span>
              </div>
            </div>
            <button
              onClick={handleStopWorkflow}
              disabled={executionState.status === 'stopping'}
              className="bg-red-500 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 border border-red-600 cursor-pointer"
            >
              <StopCircle size={14} />
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Floating Controls */}
      <div className="absolute bottom-4 right-4 bg-white border border-slate-200 p-2 rounded-xl shadow-lg flex gap-2 pointer-events-auto">
        <button 
          onClick={reset}
          className="text-[10px] font-extrabold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-100 transition-all cursor-pointer"
        >
          Reset View
        </button>
        <div className="text-[10px] font-semibold text-slate-400 flex items-center px-2 select-none border-l border-slate-100 uppercase tracking-widest">
          Zoom: {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
