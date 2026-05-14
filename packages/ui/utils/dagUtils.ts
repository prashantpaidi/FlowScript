import { Node, Edge } from '@xyflow/react';

/**
 * Traverses the graph backwards from a given node to find all ancestor nodes.
 * @param nodes All nodes in the graph
 * @param edges All edges in the graph
 * @param currentNodeId The ID of the node to start from
 * @returns Array of upstream nodes
 */
export function getUpstreamNodes(nodes: Node[], edges: Edge[], currentNodeId: string): Node[] {
  const upstream = new Set<Node>();
  const visited = new Set<string>();
  const queue = [currentNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Find all edges that point to the current node
    const incomingEdges = edges.filter(e => e.target === currentId);
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode) {
        upstream.add(sourceNode);
        queue.push(sourceNode.id);
      }
    }
  }

  return Array.from(upstream);
}
