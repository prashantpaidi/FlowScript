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

  // Precompute maps for O(1) lookups
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const incomingEdgesMap = new Map<string, Edge[]>();
  
  for (const edge of edges) {
    if (!incomingEdgesMap.has(edge.target)) {
      incomingEdgesMap.set(edge.target, []);
    }
    incomingEdgesMap.get(edge.target)!.push(edge);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const incomingEdges = incomingEdgesMap.get(currentId) || [];
    for (const edge of incomingEdges) {
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode) {
        upstream.add(sourceNode);
        queue.push(sourceNode.id);
      }
    }
  }

  return Array.from(upstream);
}
