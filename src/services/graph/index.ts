/**
 * Graph Service
 * 
 * Main orchestrator for the Repository Relationship Graph.
 * Coordinates extraction, storage, and analysis.
 */

import type { Repository, RepoFile, Symbol, Import, Dependency } from '../../types';
import type {
  GraphNode,
  GraphEdge,
  NewGraphNode,
  NewGraphEdge,
  PathResult,
  CycleResult,
  ImpactAnalysis,
  GraphStats,
  CytoscapeElement,
  CytoscapeNodeData,
  CytoscapeEdgeData,
  GraphNodeType,
  GraphEdgeType,
} from '../../types/graph';

import {
  createGraphNode,
  createGraphEdge,
  getGraphNodesByRepository,
  getGraphEdgesByRepository,
  clearGraphData,
  getGraphStats,
  searchGraphNodes,
  getGraphNode,
  getOutgoingEdges,
  getIncomingEdges,
  saveGraphMetrics,
} from '../../db/graph';

import {
  buildGraphologyGraph,
  findShortestPath as graphologyShortestPath,
  findDependencies as graphologyDependencies,
  findDependents as graphologyDependents,
  findCycles as graphologyCycles,
  hasCycles as graphologyHasCycles,
  findEntrypoints as graphologyEntrypoints,
  findCallChain as graphologyCallChain,
  findConnectedComponents,
  computeCentralityMetrics,
  analyzeImpact as graphologyAnalyzeImpact,
  computeGraphStats as graphologyComputeStats,
  extractSubgraph,
  extractNeighborhood,
  type GraphologyGraph,
} from './algorithms';

import {
  extractCodeRelationships,
  extractInfrastructureRelationships,
  extractRuntimeRelationships,
  extractDocumentationRelationships,
  extractDependencyRelationships,
  type ExtractionResult,
} from './extractors';

// ============================================================================
// Progress Callback
// ============================================================================

export interface GraphBuildProgress {
  phase: 'starting' | 'code' | 'infrastructure' | 'runtime' | 'documentation' | 
         'dependencies' | 'nodes' | 'edges' | 'metrics' | 'complete';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: GraphBuildProgress) => void;

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Build the Repository Relationship Graph from repository data
 */
export async function buildGraph(
  repository: Repository,
  files: RepoFile[],
  symbols: Symbol[],
  imports: Import[],
  dependencies: Dependency[],
  onProgress?: ProgressCallback
): Promise<{ nodeCount: number; edgeCount: number }> {
  const repositoryId = repository.id;
  
  onProgress?.({
    phase: 'starting',
    current: 0,
    total: 9,
    message: 'Clearing existing graph data...',
  });
  
  // Clear existing graph data
  await clearGraphData(repositoryId);
  
  // Collect all extraction results
  const allNodes: Map<string, NewGraphNode> = new Map();
  const allEdges: Array<{ sourceRef: string; targetRef: string; edge: Omit<NewGraphEdge, 'sourceNodeId' | 'targetNodeId'> }> = [];
  
  // Phase 1: Extract code relationships
  onProgress?.({
    phase: 'code',
    current: 1,
    total: 9,
    message: 'Extracting code relationships...',
  });
  
  const codeResult = extractCodeRelationships(files, symbols, imports, repositoryId);
  mergeExtractionResult(codeResult, allNodes, allEdges, repositoryId);
  
  // Phase 2: Extract infrastructure relationships
  onProgress?.({
    phase: 'infrastructure',
    current: 2,
    total: 9,
    message: 'Extracting infrastructure relationships...',
  });
  
  const infraResult = extractInfrastructureRelationships(files, repositoryId);
  mergeExtractionResult(infraResult, allNodes, allEdges, repositoryId);
  
  // Phase 3: Extract runtime relationships
  onProgress?.({
    phase: 'runtime',
    current: 3,
    total: 9,
    message: 'Extracting runtime relationships...',
  });
  
  const runtimeResult = extractRuntimeRelationships(files, repositoryId);
  mergeExtractionResult(runtimeResult, allNodes, allEdges, repositoryId);
  
  // Phase 4: Extract documentation relationships
  onProgress?.({
    phase: 'documentation',
    current: 4,
    total: 9,
    message: 'Extracting documentation relationships...',
  });
  
  const docResult = extractDocumentationRelationships(files, repositoryId);
  mergeExtractionResult(docResult, allNodes, allEdges, repositoryId);
  
  // Phase 5: Extract dependency relationships
  onProgress?.({
    phase: 'dependencies',
    current: 5,
    total: 9,
    message: 'Extracting dependency relationships...',
  });
  
  const depResult = extractDependencyRelationships(dependencies, repositoryId);
  mergeExtractionResult(depResult, allNodes, allEdges, repositoryId);
  
  // Phase 6: Create nodes
  onProgress?.({
    phase: 'nodes',
    current: 6,
    total: 9,
    message: `Creating ${allNodes.size} graph nodes...`,
  });
  
  const nodeRefToId: Map<string, number> = new Map();
  
  for (const [ref, node] of allNodes) {
    const created = await createGraphNode(node);
    nodeRefToId.set(ref, created.id);
  }
  
  // Phase 7: Create edges
  onProgress?.({
    phase: 'edges',
    current: 7,
    total: 9,
    message: `Creating ${allEdges.length} graph edges...`,
  });
  
  let edgeCount = 0;
  for (const { sourceRef, targetRef, edge } of allEdges) {
    const sourceId = nodeRefToId.get(sourceRef);
    const targetId = nodeRefToId.get(targetRef);
    
    if (sourceId && targetId) {
      await createGraphEdge({
        ...edge,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
      });
      edgeCount++;
    }
  }
  
  // Phase 8: Compute metrics
  onProgress?.({
    phase: 'metrics',
    current: 8,
    total: 9,
    message: 'Computing graph metrics...',
  });
  
  await computeAndSaveMetrics(repositoryId);
  
  // Complete
  onProgress?.({
    phase: 'complete',
    current: 9,
    total: 9,
    message: 'Graph building complete!',
  });
  
  return {
    nodeCount: allNodes.size,
    edgeCount,
  };
}

/**
 * Merge extraction results into the collection
 */
function mergeExtractionResult(
  result: ExtractionResult,
  allNodes: Map<string, NewGraphNode>,
  allEdges: Array<{ sourceRef: string; targetRef: string; edge: Omit<NewGraphEdge, 'sourceNodeId' | 'targetNodeId'> }>,
  repositoryId: number
): void {
  for (const { node, sourceRef } of result.nodes) {
    if (sourceRef && !allNodes.has(sourceRef)) {
      allNodes.set(sourceRef, node);
    }
  }
  
  for (const edge of result.edges) {
    allEdges.push({
      sourceRef: edge.sourceRef,
      targetRef: edge.targetRef,
      edge: {
        repositoryId,
        type: edge.type,
        weight: edge.weight,
        metadata: edge.metadata,
      },
    });
  }
}

/**
 * Compute and save centrality metrics
 */
async function computeAndSaveMetrics(repositoryId: number): Promise<void> {
  const nodes = await getGraphNodesByRepository(repositoryId);
  const edges = await getGraphEdgesByRepository(repositoryId);
  
  if (nodes.length === 0) return;
  
  const graphologyGraph = buildGraphologyGraph(nodes, edges);
  const centralityMetrics = computeCentralityMetrics(graphologyGraph);
  
  for (const [nodeId, metrics] of centralityMetrics) {
    await saveGraphMetrics(repositoryId, nodeId, 'degree_centrality', metrics.degree);
    if (metrics.betweenness > 0) {
      await saveGraphMetrics(repositoryId, nodeId, 'betweenness_centrality', metrics.betweenness);
    }
    if (metrics.closeness > 0) {
      await saveGraphMetrics(repositoryId, nodeId, 'closeness_centrality', metrics.closeness);
    }
  }
}

// ============================================================================
// Graph Query API
// ============================================================================

/**
 * Get the complete graph for a repository
 */
export async function getGraph(repositoryId: number): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  const nodes = await getGraphNodesByRepository(repositoryId);
  const edges = await getGraphEdgesByRepository(repositoryId);
  return { nodes, edges };
}

/**
 * Get graph statistics
 */
export async function getGraphStatistics(repositoryId: number): Promise<GraphStats> {
  const stats = await getGraphStats(repositoryId);
  
  // Compute connected components
  const nodes = await getGraphNodesByRepository(repositoryId);
  const edges = await getGraphEdgesByRepository(repositoryId);
  
  if (nodes.length > 0) {
    const graphologyGraph = buildGraphologyGraph(nodes, edges);
    const fullStats = graphologyComputeStats(graphologyGraph, nodes, edges);
    return {
      ...stats,
      connectedComponents: fullStats.connectedComponents,
    };
  }
  
  return stats;
}

/**
 * Search nodes by name or description
 */
export async function searchNodes(
  repositoryId: number,
  query: string
): Promise<GraphNode[]> {
  return searchGraphNodes(repositoryId, query);
}

/**
 * Get node details with relationships
 */
export async function getNodeDetails(nodeId: number): Promise<{
  node: GraphNode | null;
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
}> {
  const node = await getGraphNode(nodeId);
  const incoming = await getIncomingEdges(nodeId);
  const outgoing = await getOutgoingEdges(nodeId);
  
  return { node, incoming, outgoing };
}

// ============================================================================
// Graph Algorithm API
// ============================================================================

let cachedGraphologyGraph: GraphologyGraph | null = null;
let cachedRepositoryId: number | null = null;
let cachedNodes: GraphNode[] = [];
let cachedEdges: GraphEdge[] = [];

/**
 * Get or build the cached Graphology graph
 */
async function getGraphologyGraph(repositoryId: number): Promise<{
  graphologyGraph: GraphologyGraph;
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  if (cachedRepositoryId === repositoryId && cachedGraphologyGraph) {
    return {
      graphologyGraph: cachedGraphologyGraph,
      nodes: cachedNodes,
      edges: cachedEdges,
    };
  }
  
  const nodes = await getGraphNodesByRepository(repositoryId);
  const edges = await getGraphEdgesByRepository(repositoryId);
  const graphologyGraph = buildGraphologyGraph(nodes, edges);
  
  cachedGraphologyGraph = graphologyGraph;
  cachedRepositoryId = repositoryId;
  cachedNodes = nodes;
  cachedEdges = edges;
  
  return { graphologyGraph, nodes, edges };
}

/**
 * Invalidate the cached graph (call after modifications)
 */
export function invalidateGraphCache(): void {
  cachedGraphologyGraph = null;
  cachedRepositoryId = null;
  cachedNodes = [];
  cachedEdges = [];
}

/**
 * Find shortest path between two nodes
 */
export async function findShortestPath(
  repositoryId: number,
  sourceNodeId: number,
  targetNodeId: number
): Promise<PathResult | null> {
  const { graphologyGraph, nodes, edges } = await getGraphologyGraph(repositoryId);
  return graphologyShortestPath(graphologyGraph, sourceNodeId, targetNodeId, nodes, edges);
}

/**
 * Find dependencies of a node
 */
export async function findDependencies(
  repositoryId: number,
  nodeId: number,
  transitive: boolean = true
): Promise<GraphNode[]> {
  const { graphologyGraph, nodes } = await getGraphologyGraph(repositoryId);
  return graphologyDependencies(graphologyGraph, nodeId, nodes, transitive);
}

/**
 * Find dependents of a node
 */
export async function findDependents(
  repositoryId: number,
  nodeId: number,
  transitive: boolean = true
): Promise<GraphNode[]> {
  const { graphologyGraph, nodes } = await getGraphologyGraph(repositoryId);
  return graphologyDependents(graphologyGraph, nodeId, nodes, transitive);
}

/**
 * Find cycles in the graph
 */
export async function findCycles(repositoryId: number): Promise<CycleResult[]> {
  const { graphologyGraph, nodes, edges } = await getGraphologyGraph(repositoryId);
  return graphologyCycles(graphologyGraph, nodes, edges);
}

/**
 * Check if graph has cycles
 */
export async function hasCycles(repositoryId: number): Promise<boolean> {
  const { graphologyGraph } = await getGraphologyGraph(repositoryId);
  return graphologyHasCycles(graphologyGraph);
}

/**
 * Find entry points (nodes with no incoming edges)
 */
export async function findEntrypoints(repositoryId: number): Promise<GraphNode[]> {
  const { graphologyGraph, nodes } = await getGraphologyGraph(repositoryId);
  return graphologyEntrypoints(graphologyGraph, nodes);
}

/**
 * Find call chain from a node
 */
export async function findCallChain(
  repositoryId: number,
  nodeId: number,
  maxDepth: number = 10
): Promise<PathResult> {
  const { graphologyGraph, nodes, edges } = await getGraphologyGraph(repositoryId);
  return graphologyCallChain(graphologyGraph, nodeId, nodes, edges, maxDepth);
}

/**
 * Analyze impact of changing a node
 */
export async function analyzeImpact(
  repositoryId: number,
  nodeId: number
): Promise<ImpactAnalysis> {
  const { graphologyGraph, nodes, edges } = await getGraphologyGraph(repositoryId);
  return graphologyAnalyzeImpact(graphologyGraph, nodeId, nodes, edges);
}

/**
 * Get connected components
 */
export async function getConnectedComponents(repositoryId: number): Promise<GraphNode[][]> {
  const { graphologyGraph, nodes } = await getGraphologyGraph(repositoryId);
  return findConnectedComponents(graphologyGraph, nodes);
}

/**
 * Get subgraph filtered by node types
 */
export async function getFilteredGraph(
  repositoryId: number,
  nodeTypes: GraphNodeType[]
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { nodes, edges } = await getGraphologyGraph(repositoryId);
  return extractSubgraph(nodes, edges, nodeTypes);
}

/**
 * Get neighborhood of a node
 */
export async function getNeighborhood(
  repositoryId: number,
  nodeId: number,
  hops: number = 2
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const { graphologyGraph, nodes, edges } = await getGraphologyGraph(repositoryId);
  return extractNeighborhood(graphologyGraph, nodeId, nodes, edges, hops);
}

// ============================================================================
// Cytoscape Conversion
// ============================================================================

/**
 * Get node color based on type
 */
function getNodeColor(type: GraphNodeType): string {
  const colors: Record<GraphNodeType, string> = {
    repository: '#6366f1',
    directory: '#8b5cf6',
    package: '#a855f7',
    module: '#d946ef',
    file: '#ec4899',
    namespace: '#f43f5e',
    class: '#ef4444',
    interface: '#f97316',
    trait: '#fb923c',
    function: '#eab308',
    method: '#84cc16',
    variable: '#22c55e',
    configuration: '#14b8a6',
    environment_variable: '#06b6d4',
    api_endpoint: '#0ea5e9',
    route: '#3b82f6',
    database: '#6366f1',
    table: '#8b5cf6',
    queue: '#a855f7',
    worker: '#d946ef',
    cron: '#ec4899',
    container: '#f43f5e',
    deployment: '#ef4444',
    external_service: '#f97316',
    documentation: '#84cc16',
    test: '#22c55e',
    issue: '#14b8a6',
    pull_request: '#06b6d4',
  };
  return colors[type] || '#6b7280';
}

/**
 * Get edge color based on type
 */
function getEdgeColor(type: GraphEdgeType): string {
  const colors: Record<GraphEdgeType, string> = {
    imports: '#3b82f6',
    exports: '#22c55e',
    calls: '#f97316',
    references: '#8b5cf6',
    implements: '#ec4899',
    extends: '#ef4444',
    depends_on: '#6366f1',
    owns: '#14b8a6',
    contains: '#6b7280',
    uses: '#eab308',
    reads: '#06b6d4',
    writes: '#f43f5e',
    publishes: '#d946ef',
    subscribes: '#a855f7',
    connects_to: '#0ea5e9',
    authenticates: '#84cc16',
    configures: '#fb923c',
    deploys: '#f97316',
    tests: '#22c55e',
    generates: '#8b5cf6',
    documents: '#6366f1',
    related_to: '#9ca3af',
  };
  return colors[type] || '#9ca3af';
}

/**
 * Convert graph nodes and edges to Cytoscape elements
 */
export function toCytoscapeElements(
  nodes: GraphNode[],
  edges: GraphEdge[]
): CytoscapeElement[] {
  const elements: CytoscapeElement[] = [];
  
  // Add nodes
  for (const node of nodes) {
    const nodeData: CytoscapeNodeData = {
      id: node.id.toString(),
      label: node.name,
      type: node.type,
      filePath: node.filePath || undefined,
      description: node.description || undefined,
      metrics: node.metrics,
      metadata: node.metadata,
    };
    
    elements.push({
      data: nodeData,
      group: 'nodes',
    });
  }
  
  // Add edges
  for (const edge of edges) {
    const edgeData: CytoscapeEdgeData = {
      id: `e${edge.id}`,
      source: edge.sourceNodeId.toString(),
      target: edge.targetNodeId.toString(),
      type: edge.type,
      weight: edge.weight,
      label: edge.type,
    };
    
    elements.push({
      data: edgeData,
      group: 'edges',
    });
  }
  
  return elements;
}

/**
 * Get Cytoscape stylesheet
 */
export function getCytoscapeStylesheet(): cytoscape.Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': (ele: cytoscape.NodeSingular) => getNodeColor(ele.data('type')),
        'label': 'data(label)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': '10px',
        'text-margin-y': 5,
        'width': 30,
        'height': 30,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#000',
      },
    },
    {
      selector: 'edge',
      style: {
        'width': (ele: cytoscape.EdgeSingular) => Math.max(1, ele.data('weight') * 2),
        'line-color': (ele: cytoscape.EdgeSingular) => getEdgeColor(ele.data('type')),
        'target-arrow-color': (ele: cytoscape.EdgeSingular) => getEdgeColor(ele.data('type')),
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.7,
      },
    },
    {
      selector: 'edge:selected',
      style: {
        'width': 4,
        'opacity': 1,
      },
    },
  ];
}

// ============================================================================
// Re-exports
// ============================================================================

export type { GraphologyGraph } from './algorithms';
export { buildGraphologyGraph } from './algorithms';
