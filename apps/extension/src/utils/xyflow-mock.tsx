import React from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { flattenLinearNodes, deriveEdgesFromNodes } from './deriveEdges';

export const Handle = ({ type, position, id, style, className }: any) => {
  return (
    <div 
      data-handleid={id} 
      data-porttype={type} 
      data-position={position}
      style={{ display: 'none', ...style }}
      className={`react-flow__handle ${className || ''}`}
    />
  );
};

export const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom',
};

export type NodeProps<T = any> = {
  id: string;
  data: T;
  [key: string]: any;
};

export type Node<T = any> = {
  id: string;
  type?: string;
  data: T;
  [key: string]: any;
};

export const ReactFlow = ({ children }: any) => <>{children}</>;
export const MiniMap = () => null;
export const Controls = () => null;
export const Background = () => null;
export const Panel = ({ children }: any) => <>{children}</>;

export const useReactFlow = () => ({
  fitView: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  screenToFlowPosition: (pos: any) => pos,
});

export const useNodes = () => {
  const linearNodes = useWorkflowStore((s) => s.linearNodes);
  return flattenLinearNodes(linearNodes);
};

export const useEdges = () => {
  const linearNodes = useWorkflowStore((s) => s.linearNodes);
  return deriveEdgesFromNodes(linearNodes);
};

export const addEdge = (connection: any, edges: any) => [...edges, connection];
export const applyNodeChanges = (changes: any, nodes: any) => nodes;
export const applyEdgeChanges = (changes: any, edges: any) => edges;
export const ReactFlowProvider = ({ children }: any) => <>{children}</>;
