import dagre from '@dagrejs/dagre';

interface LayoutNode {
  id: string;
  position?: { x: number; y: number };
  measured?: { width?: number; height?: number };
}

interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * Calculates optimal X/Y coordinates for a set of nodes using Dagre.
 * @param nodes Array of nodes
 * @param edges Array of edges connecting the nodes
 * @param direction Direction of the layout (default: 'TB' for top-to-bottom)
 */
export function autoLayout<T extends LayoutNode>(nodes: T[], edges: LayoutEdge[], direction = 'TB'): T[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: node.measured?.width ?? 250, 
      height: node.measured?.height ?? 80 
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      // Shift node position to top-left corner to match React Flow's coordinate system
      position: {
        x: nodeWithPosition.x - (node.measured?.width ?? 250) / 2,
        y: nodeWithPosition.y - (node.measured?.height ?? 80) / 2,
      },
    };
  });
}
