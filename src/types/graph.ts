/**
 * Repository Relationship Graph Types
 * 
 * The Repository Relationship Graph (RRG) is the canonical representation
 * of software structure. Every significant software artifact is represented
 * as a node, and relationships between artifacts are represented as edges.
 */

// ============================================================================
// Node Types
// ============================================================================

export type GraphNodeType =
  | 'repository'
  | 'directory'
  | 'package'
  | 'module'
  | 'file'
  | 'namespace'
  | 'class'
  | 'interface'
  | 'trait'
  | 'function'
  | 'method'
  | 'variable'
  | 'configuration'
  | 'environment_variable'
  | 'api_endpoint'
  | 'route'
  | 'database'
  | 'table'
  | 'queue'
  | 'worker'
  | 'cron'
  | 'container'
  | 'deployment'
  | 'external_service'
  | 'documentation'
  | 'test'
  | 'issue'
  | 'pull_request';

// ============================================================================
// Relationship Types
// ============================================================================

export type GraphEdgeType =
  | 'imports'
  | 'exports'
  | 'calls'
  | 'references'
  | 'implements'
  | 'extends'
  | 'depends_on'
  | 'owns'
  | 'contains'
  | 'uses'
  | 'reads'
  | 'writes'
  | 'publishes'
  | 'subscribes'
  | 'connects_to'
  | 'authenticates'
  | 'configures'
  | 'deploys'
  | 'tests'
  | 'generates'
  | 'documents'
  | 'related_to';

// ============================================================================
// Graph Node
// ============================================================================

export interface GraphNode {
  id: number;
  uuid: string;
  repositoryId: number;
  type: GraphNodeType;
  name: string;
  description: string | null;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  language: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  metrics: Record<string, number>;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewGraphNode = Omit<GraphNode, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Graph Edge
// ============================================================================

export interface GraphEdge {
  id: number;
  repositoryId: number;
  sourceNodeId: number;
  targetNodeId: number;
  type: GraphEdgeType;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type NewGraphEdge = Omit<GraphEdge, 'id' | 'createdAt'>;

// ============================================================================
// Graph Label
// ============================================================================

export interface GraphLabel {
  id: number;
  repositoryId: number;
  name: string;
  color: string;
  description: string | null;
  nodeCount: number;
  createdAt: Date;
}

export type NewGraphLabel = Omit<GraphLabel, 'id' | 'nodeCount' | 'createdAt'>;

// ============================================================================
// Node Label Assignment
// ============================================================================

export interface NodeLabel {
  nodeId: number;
  labelId: number;
  assignedAt: Date;
}

// ============================================================================
// Graph Metrics
// ============================================================================

export interface GraphMetrics {
  id: number;
  repositoryId: number;
  nodeId: number;
  metricType: string;
  value: number;
  computedAt: Date;
}

export type MetricType =
  | 'degree_centrality'
  | 'betweenness_centrality'
  | 'closeness_centrality'
  | 'pagerank'
  | 'in_degree'
  | 'out_degree'
  | 'complexity'
  | 'coupling'
  | 'cohesion';

// ============================================================================
// Graph Snapshot
// ============================================================================

export interface GraphSnapshot {
  id: number;
  repositoryId: number;
  name: string;
  description: string | null;
  nodeCount: number;
  edgeCount: number;
  snapshotData: string; // JSON serialized graph
  createdAt: Date;
}

export type NewGraphSnapshot = Omit<GraphSnapshot, 'id' | 'createdAt'>;

// ============================================================================
// Graph Layout
// ============================================================================

export type LayoutType =
  | 'force_directed'
  | 'hierarchical'
  | 'architecture'
  | 'dependency'
  | 'service_map'
  | 'circular'
  | 'grid';

export interface GraphLayout {
  id: number;
  repositoryId: number;
  name: string;
  layoutType: LayoutType;
  nodePositions: Record<number, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
  createdAt: Date;
  updatedAt: Date;
}

export type NewGraphLayout = Omit<GraphLayout, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Graph Annotation
// ============================================================================

export interface GraphAnnotation {
  id: number;
  repositoryId: number;
  nodeId: number | null;
  edgeId: number | null;
  content: string;
  author: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewGraphAnnotation = Omit<GraphAnnotation, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Graph Query Types
// ============================================================================

export interface PathResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

export interface CycleResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ImpactAnalysis {
  directDependencies: GraphNode[];
  transitiveDependencies: GraphNode[];
  affectedServices: GraphNode[];
  potentialBreakingChanges: {
    node: GraphNode;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  blastRadius: number;
  suggestedTests: string[];
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  nodeTypeDistribution: Record<GraphNodeType, number>;
  edgeTypeDistribution: Record<GraphEdgeType, number>;
  connectedComponents: number;
  averageDegree: number;
  density: number;
}

// ============================================================================
// Graph View Configuration
// ============================================================================

export interface GraphViewConfig {
  layout: LayoutType;
  showLabels: boolean;
  nodeTypes: GraphNodeType[];
  edgeTypes: GraphEdgeType[];
  highlightedNodeId: number | null;
  selectedNodeIds: Set<number>;
  expandedNodeIds: Set<number>;
  pinnedNodeIds: Set<number>;
  filterText: string;
  showMetrics: boolean;
  colorScheme: 'type' | 'layer' | 'complexity' | 'centrality';
}

export const DEFAULT_GRAPH_VIEW_CONFIG: GraphViewConfig = {
  layout: 'force_directed',
  showLabels: true,
  nodeTypes: [],
  edgeTypes: [],
  highlightedNodeId: null,
  selectedNodeIds: new Set(),
  expandedNodeIds: new Set(),
  pinnedNodeIds: new Set(),
  filterText: '',
  showMetrics: false,
  colorScheme: 'type',
};

// ============================================================================
// Graph API Response Types
// ============================================================================

export interface GraphQueryResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  executionTime: number;
}

// ============================================================================
// Cytoscape Element Types
// ============================================================================

export interface CytoscapeNodeData {
  id: string;
  label: string;
  type: GraphNodeType;
  filePath?: string;
  description?: string;
  metrics?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  weight: number;
  label?: string;
}

export type CytoscapeElement =
  | { data: CytoscapeNodeData; group: 'nodes' }
  | { data: CytoscapeEdgeData; group: 'edges' };
