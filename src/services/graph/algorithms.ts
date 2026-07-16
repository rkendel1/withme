/**
 * Graph Algorithms Service
 * 
 * Uses Graphology for in-memory graph algorithms including:
 * - Shortest path
 * - Connected components
 * - Cycles detection
 * - Centrality metrics
 * - Dependency analysis
 */

import Graph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import { connectedComponents as getConnectedComponentsAlgo } from 'graphology-components';
import {
  degree as degreeCentrality,
  betweenness as betweennessCentrality,
  closeness as closenessCentrality,
} from 'graphology-metrics/centrality';
import { bfsFromNode, dfsFromNode } from 'graphology-traversal';

import type {
  GraphNode,
  GraphEdge,
  PathResult,
  CycleResult,
  ImpactAnalysis,
  GraphStats,
} from '../../types/graph';

// ============================================================================
// Graph Builder
// ============================================================================

export interface GraphologyGraph {
  graph: Graph;
  nodeIdMap: Map<number, string>;
  reverseNodeIdMap: Map<string, number>;
}

/**
 * Build a Graphology graph from nodes and edges
 */
export function buildGraphologyGraph(
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphologyGraph {
  const graph = new Graph({ type: 'directed', multi: false });
  const nodeIdMap = new Map<number, string>();
  const reverseNodeIdMap = new Map<string, number>();

  // Add nodes
  for (const node of nodes) {
    const stringId = node.id.toString();
    nodeIdMap.set(node.id, stringId);
    reverseNodeIdMap.set(stringId, node.id);
    
    graph.addNode(stringId, {
      id: node.id,
      type: node.type,
      name: node.name,
      filePath: node.filePath,
      language: node.language,
      metadata: node.metadata,
    });
  }

  // Add edges
  for (const edge of edges) {
    const sourceId = nodeIdMap.get(edge.sourceNodeId);
    const targetId = nodeIdMap.get(edge.targetNodeId);
    
    if (sourceId && targetId && graph.hasNode(sourceId) && graph.hasNode(targetId)) {
      try {
        graph.addEdge(sourceId, targetId, {
          id: edge.id,
          type: edge.type,
          weight: edge.weight,
          metadata: edge.metadata,
        });
      } catch {
        // Edge already exists, skip
      }
    }
  }

  return { graph, nodeIdMap, reverseNodeIdMap };
}

// ============================================================================
// Path Finding
// ============================================================================

/**
 * Find the shortest path between two nodes
 */
export function findShortestPath(
  graphologyGraph: GraphologyGraph,
  sourceId: number,
  targetId: number,
  nodes: GraphNode[],
  edges: GraphEdge[]
): PathResult | null {
  const { graph, nodeIdMap, reverseNodeIdMap } = graphologyGraph;
  
  const sourceStringId = nodeIdMap.get(sourceId);
  const targetStringId = nodeIdMap.get(targetId);
  
  if (!sourceStringId || !targetStringId) return null;
  if (!graph.hasNode(sourceStringId) || !graph.hasNode(targetStringId)) return null;

  const path = bidirectional(graph, sourceStringId, targetStringId);
  
  if (!path) return null;

  const pathNodeIds = path.map(id => reverseNodeIdMap.get(id)!);
  const pathNodes = pathNodeIds.map(id => nodes.find(n => n.id === id)!).filter(Boolean);
  
  // Find edges along the path
  const pathEdges: GraphEdge[] = [];
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const edge = edges.find(
      e => e.sourceNodeId === pathNodeIds[i] && e.targetNodeId === pathNodeIds[i + 1]
    );
    if (edge) pathEdges.push(edge);
  }

  return {
    nodes: pathNodes,
    edges: pathEdges,
    length: path.length - 1,
  };
}

/**
 * Find all paths between two nodes (limited to avoid explosion)
 */
export function findAllPaths(
  graphologyGraph: GraphologyGraph,
  sourceId: number,
  targetId: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxPaths: number = 10,
  maxLength: number = 10
): PathResult[] {
  const { graph, nodeIdMap, reverseNodeIdMap } = graphologyGraph;
  
  const sourceStringId = nodeIdMap.get(sourceId);
  const targetStringId = nodeIdMap.get(targetId);
  
  if (!sourceStringId || !targetStringId) return [];

  const paths: PathResult[] = [];
  const visited = new Set<string>();
  
  function dfs(current: string, path: string[]): void {
    if (paths.length >= maxPaths || path.length > maxLength) return;
    
    if (current === targetStringId) {
      const pathNodeIds = path.map(id => reverseNodeIdMap.get(id)!);
      const pathNodes = pathNodeIds.map(id => nodes.find(n => n.id === id)!).filter(Boolean);
      
      const pathEdges: GraphEdge[] = [];
      for (let i = 0; i < pathNodeIds.length - 1; i++) {
        const edge = edges.find(
          e => e.sourceNodeId === pathNodeIds[i] && e.targetNodeId === pathNodeIds[i + 1]
        );
        if (edge) pathEdges.push(edge);
      }
      
      paths.push({
        nodes: pathNodes,
        edges: pathEdges,
        length: path.length - 1,
      });
      return;
    }
    
    visited.add(current);
    
    const neighbors = graph.outNeighbors(current);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      }
    }
    
    visited.delete(current);
  }
  
  dfs(sourceStringId, [sourceStringId]);
  return paths;
}

// ============================================================================
// Dependency Analysis
// ============================================================================

/**
 * Find all dependencies (what this node depends on)
 */
export function findDependencies(
  graphologyGraph: GraphologyGraph,
  nodeId: number,
  nodes: GraphNode[],
  transitive: boolean = true
): GraphNode[] {
  const { graph, nodeIdMap, reverseNodeIdMap } = graphologyGraph;
  const stringId = nodeIdMap.get(nodeId);
  
  if (!stringId || !graph.hasNode(stringId)) return [];

  const dependencies = new Set<number>();
  
  if (transitive) {
    bfsFromNode(graph, stringId, (node) => {
      const id = reverseNodeIdMap.get(node);
      if (id && id !== nodeId) {
        dependencies.add(id);
      }
    });
  } else {
    const neighbors = graph.outNeighbors(stringId);
    for (const neighbor of neighbors) {
      const id = reverseNodeIdMap.get(neighbor);
      if (id) dependencies.add(id);
    }
  }

  return Array.from(dependencies)
    .map(id => nodes.find(n => n.id === id)!)
    .filter(Boolean);
}

/**
 * Find all dependents (what depends on this node)
 */
export function findDependents(
  graphologyGraph: GraphologyGraph,
  nodeId: number,
  nodes: GraphNode[],
  transitive: boolean = true
): GraphNode[] {
  const { graph, nodeIdMap, reverseNodeIdMap } = graphologyGraph;
  const stringId = nodeIdMap.get(nodeId);
  
  if (!stringId || !graph.hasNode(stringId)) return [];

  const dependents = new Set<number>();
  
  // Create reverse graph for backward traversal
  const reverseGraph = new Graph({ type: 'directed' });
  graph.forEachNode((node, attrs) => {
    reverseGraph.addNode(node, attrs);
  });
  graph.forEachEdge((_edge, attrs, source, target) => {
    reverseGraph.addEdge(target, source, attrs);
  });
  
  if (transitive) {
    bfsFromNode(reverseGraph, stringId, (node) => {
      const id = reverseNodeIdMap.get(node);
      if (id && id !== nodeId) {
        dependents.add(id);
      }
    });
  } else {
    const neighbors = reverseGraph.outNeighbors(stringId);
    for (const neighbor of neighbors) {
      const id = reverseNodeIdMap.get(neighbor);
      if (id) dependents.add(id);
    }
  }

  return Array.from(dependents)
    .map(id => nodes.find(n => n.id === id)!)
    .filter(Boolean);
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Find all cycles in the graph
 */
export function findCycles(
  graphologyGraph: GraphologyGraph,
  nodes: GraphNode[],
  edges: GraphEdge[]
): CycleResult[] {
  const { graph, reverseNodeIdMap } = graphologyGraph;
  const cycles: CycleResult[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.outNeighbors(node);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cyclePath = path.slice(cycleStart);
        cyclePath.push(neighbor); // Close the cycle

        const cycleNodeIds = cyclePath.map(id => reverseNodeIdMap.get(id)!);
        const cycleNodes = cycleNodeIds
          .map(id => nodes.find(n => n.id === id)!)
          .filter(Boolean);

        const cycleEdges: GraphEdge[] = [];
        for (let i = 0; i < cycleNodeIds.length - 1; i++) {
          const edge = edges.find(
            e => e.sourceNodeId === cycleNodeIds[i] && e.targetNodeId === cycleNodeIds[i + 1]
          );
          if (edge) cycleEdges.push(edge);
        }

        cycles.push({
          nodes: cycleNodes,
          edges: cycleEdges,
        });
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  graph.forEachNode((node) => {
    if (!visited.has(node)) {
      dfs(node);
    }
  });

  return cycles;
}

/**
 * Check if the graph has any cycles
 */
export function hasCycles(graphologyGraph: GraphologyGraph): boolean {
  const { graph } = graphologyGraph;
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.outNeighbors(node);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  let hasCycle = false;
  graph.forEachNode((node) => {
    if (!visited.has(node) && dfs(node)) {
      hasCycle = true;
    }
  });

  return hasCycle;
}

// ============================================================================
// Entry Points and Call Chains
// ============================================================================

/**
 * Find entry points (nodes with no incoming edges)
 */
export function findEntrypoints(
  graphologyGraph: GraphologyGraph,
  nodes: GraphNode[]
): GraphNode[] {
  const { graph, reverseNodeIdMap } = graphologyGraph;
  const entryPoints: GraphNode[] = [];

  graph.forEachNode((node) => {
    if (graph.inDegree(node) === 0) {
      const id = reverseNodeIdMap.get(node);
      if (id) {
        const graphNode = nodes.find(n => n.id === id);
        if (graphNode) entryPoints.push(graphNode);
      }
    }
  });

  return entryPoints;
}

/**
 * Find leaf nodes (nodes with no outgoing edges)
 */
export function findLeafNodes(
  graphologyGraph: GraphologyGraph,
  nodes: GraphNode[]
): GraphNode[] {
  const { graph, reverseNodeIdMap } = graphologyGraph;
  const leafNodes: GraphNode[] = [];

  graph.forEachNode((node) => {
    if (graph.outDegree(node) === 0) {
      const id = reverseNodeIdMap.get(node);
      if (id) {
        const graphNode = nodes.find(n => n.id === id);
        if (graphNode) leafNodes.push(graphNode);
      }
    }
  });

  return leafNodes;
}

/**
 * Find call chain from a node
 */
export function findCallChain(
  graphologyGraph: GraphologyGraph,
  nodeId: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxDepth: number = 10
): PathResult {
  const { graph, nodeIdMap, reverseNodeIdMap } = graphologyGraph;
  const stringId = nodeIdMap.get(nodeId);
  
  if (!stringId || !graph.hasNode(stringId)) {
    return { nodes: [], edges: [], length: 0 };
  }

  const chainNodeIds: number[] = [];
  const visited = new Set<string>();
  
  dfsFromNode(graph, stringId, (node, _, depth) => {
    if (depth > maxDepth) return true; // Stop traversal
    
    if (!visited.has(node)) {
      visited.add(node);
      const id = reverseNodeIdMap.get(node);
      if (id) chainNodeIds.push(id);
    }
    return false;
  });

  const chainNodes = chainNodeIds
    .map(id => nodes.find(n => n.id === id)!)
    .filter(Boolean);

  const chainEdges = edges.filter(
    e => chainNodeIds.includes(e.sourceNodeId) && chainNodeIds.includes(e.targetNodeId)
  );

  return {
    nodes: chainNodes,
    edges: chainEdges,
    length: chainNodes.length,
  };
}

// ============================================================================
// Connected Components
// ============================================================================

/**
 * Find connected components in the graph
 */
export function findConnectedComponents(
  graphologyGraph: GraphologyGraph,
  nodes: GraphNode[]
): GraphNode[][] {
  const { graph, reverseNodeIdMap } = graphologyGraph;
  const components = getConnectedComponentsAlgo(graph);
  
  return components.map((component: string[]) => 
    component
      .map((nodeId: string) => {
        const id = reverseNodeIdMap.get(nodeId);
        return id ? nodes.find(n => n.id === id) : undefined;
      })
      .filter((n): n is GraphNode => n !== undefined)
  );
}

// ============================================================================
// Centrality Metrics
// ============================================================================

/**
 * Compute centrality metrics for all nodes
 */
export function computeCentralityMetrics(
  graphologyGraph: GraphologyGraph
): Map<number, { degree: number; betweenness: number; closeness: number }> {
  const { graph, reverseNodeIdMap } = graphologyGraph;
  const metrics = new Map<number, { degree: number; betweenness: number; closeness: number }>();

  // Degree centrality
  const degree = degreeCentrality(graph);
  
  // Betweenness centrality (can be expensive for large graphs)
  let betweenness: Record<string, number> = {};
  try {
    if (graph.order < 1000) { // Only compute for smaller graphs
      betweenness = betweennessCentrality(graph);
    }
  } catch {
    // Graph might not support betweenness calculation
  }
  
  // Closeness centrality
  let closeness: Record<string, number> = {};
  try {
    if (graph.order < 1000) {
      closeness = closenessCentrality(graph);
    }
  } catch {
    // Graph might not support closeness calculation
  }

  graph.forEachNode((node) => {
    const id = reverseNodeIdMap.get(node);
    if (id) {
      metrics.set(id, {
        degree: degree[node] || 0,
        betweenness: betweenness[node] || 0,
        closeness: closeness[node] || 0,
      });
    }
  });

  return metrics;
}

// ============================================================================
// Impact Analysis
// ============================================================================

/**
 * Analyze the impact of changing a node
 */
export function analyzeImpact(
  graphologyGraph: GraphologyGraph,
  nodeId: number,
  nodes: GraphNode[],
  _edges: GraphEdge[]
): ImpactAnalysis {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) {
    return {
      directDependencies: [],
      transitiveDependencies: [],
      affectedServices: [],
      potentialBreakingChanges: [],
      blastRadius: 0,
      suggestedTests: [],
    };
  }

  // Find direct dependencies
  const directDependents = findDependents(graphologyGraph, nodeId, nodes, false);
  
  // Find transitive dependencies
  const transitiveDependents = findDependents(graphologyGraph, nodeId, nodes, true);
  
  // Find affected services (nodes of service-like types)
  const serviceTypes = ['external_service', 'api_endpoint', 'container', 'deployment'];
  const affectedServices = transitiveDependents.filter(n => serviceTypes.includes(n.type));
  
  // Compute blast radius
  const blastRadius = transitiveDependents.length;
  
  // Identify potential breaking changes
  const potentialBreakingChanges: ImpactAnalysis['potentialBreakingChanges'] = [];
  
  for (const dependent of directDependents) {
    // Public interfaces/classes changing could break consumers
    if (['interface', 'class', 'function'].includes(node.type)) {
      potentialBreakingChanges.push({
        node: dependent,
        reason: `Depends directly on ${node.type} '${node.name}'`,
        severity: dependent.type === 'test' ? 'low' : 'high',
      });
    }
    
    // API endpoint changes affect all consumers
    if (node.type === 'api_endpoint') {
      potentialBreakingChanges.push({
        node: dependent,
        reason: `Consumes API endpoint '${node.name}'`,
        severity: 'critical',
      });
    }
  }
  
  // Suggest tests
  const suggestedTests: string[] = [];
  
  // Find test nodes that depend on the changed node
  const testDependents = transitiveDependents.filter(n => n.type === 'test');
  for (const test of testDependents) {
    suggestedTests.push(`Run test: ${test.name}`);
  }
  
  // If no specific tests found, suggest integration tests for affected services
  if (suggestedTests.length === 0 && affectedServices.length > 0) {
    for (const service of affectedServices) {
      suggestedTests.push(`Run integration tests for service: ${service.name}`);
    }
  }
  
  return {
    directDependencies: directDependents,
    transitiveDependencies: transitiveDependents,
    affectedServices,
    potentialBreakingChanges,
    blastRadius,
    suggestedTests,
  };
}

// ============================================================================
// Graph Statistics
// ============================================================================

/**
 * Compute comprehensive graph statistics
 */
export function computeGraphStats(
  graphologyGraph: GraphologyGraph,
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphStats {
  const { graph } = graphologyGraph;
  
  // Count nodes by type
  const nodeTypeDistribution: Record<string, number> = {};
  for (const node of nodes) {
    nodeTypeDistribution[node.type] = (nodeTypeDistribution[node.type] || 0) + 1;
  }
  
  // Count edges by type
  const edgeTypeDistribution: Record<string, number> = {};
  for (const edge of edges) {
    edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] || 0) + 1;
  }
  
  // Connected components
  const components = getConnectedComponentsAlgo(graph);
  
  // Compute density
  const nodeCount = graph.order;
  const edgeCount = graph.size;
  const maxEdges = (nodeCount * (nodeCount - 1)); // Directed graph
  const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
  
  // Average degree
  let totalDegree = 0;
  graph.forEachNode((node) => {
    totalDegree += graph.degree(node);
  });
  const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
  
  return {
    nodeCount,
    edgeCount,
    nodeTypeDistribution: nodeTypeDistribution as GraphStats['nodeTypeDistribution'],
    edgeTypeDistribution: edgeTypeDistribution as GraphStats['edgeTypeDistribution'],
    connectedComponents: components.length,
    averageDegree,
    density,
  };
}

// ============================================================================
// Subgraph Extraction
// ============================================================================

/**
 * Extract a subgraph containing only specified node types
 */
export function extractSubgraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  nodeTypes: string[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const filteredNodes = nodes.filter(n => nodeTypes.includes(n.type));
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  
  const filteredEdges = edges.filter(
    e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
  );
  
  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

/**
 * Extract neighborhood of a node within N hops
 */
export function extractNeighborhood(
  graphologyGraph: GraphologyGraph,
  nodeId: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  hops: number = 2
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { graph, nodeIdMap, reverseNodeIdMap } = graphologyGraph;
  const stringId = nodeIdMap.get(nodeId);
  
  if (!stringId || !graph.hasNode(stringId)) {
    return { nodes: [], edges: [] };
  }

  const neighborIds = new Set<number>();
  const visited = new Set<string>();
  const queue: Array<{ node: string; depth: number }> = [{ node: stringId, depth: 0 }];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    
    if (visited.has(node) || depth > hops) continue;
    visited.add(node);
    
    const id = reverseNodeIdMap.get(node);
    if (id) neighborIds.add(id);
    
    if (depth < hops) {
      // Add both in and out neighbors
      const outNeighbors = graph.outNeighbors(node);
      const inNeighbors = graph.inNeighbors(node);
      
      for (const neighbor of [...outNeighbors, ...inNeighbors]) {
        queue.push({ node: neighbor, depth: depth + 1 });
      }
    }
  }

  const neighborNodes = nodes.filter(n => neighborIds.has(n.id));
  const neighborEdges = edges.filter(
    e => neighborIds.has(e.sourceNodeId) && neighborIds.has(e.targetNodeId)
  );

  return {
    nodes: neighborNodes,
    edges: neighborEdges,
  };
}
