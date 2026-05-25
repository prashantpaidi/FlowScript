import React from 'react';

interface WorkflowContextType {
  updateNodeData: (nodeId: string, newData: any) => void;
  removeNode: (nodeId: string) => void;
}

export const WorkflowContext = React.createContext<WorkflowContextType | null>(null);

export const useWorkflowActions = () => {
  const context = React.useContext(WorkflowContext);
  if (!context) {
    return {
      updateNodeData: () => {},
      removeNode: () => {},
    };
  }
  return context;
};
