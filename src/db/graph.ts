/**
 * Graph Database Operations
 * 
 * CRUD operations for the Repository Relationship Graph.
 */

import { query, execute } from './index';
import type {
  GraphNode,
  NewGraphNode,
  GraphEdge,
  NewGraphEdge,
  GraphLabel,
  NewGraphLabel,
  GraphMetrics,
  GraphSnapshot,
  NewGraphSnapshot,
  GraphLayout,
  NewGraphLayout,
  GraphAnnotation,
  NewGraphAnnotation,
  GraphStats,
  GraphNodeType,
  GraphEdgeType,
} from '../types/graph';

// ============================================================================
// Row Mappers
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseRow = Record<string, any>;

function mapGraphNode(row: DatabaseRow): GraphNode {
  return {
    id: row.id,
    uuid: row.uuid,
    repositoryId: row.repository_id,
    type: row.type as GraphNodeType,
    name: row.name,
    description: row.description,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    language: row.language,
    metadata: row.metadata || {},
    tags: row.tags || [],
    metrics: row.metrics || {},
    embedding: row.embedding,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapGraphEdge(row: DatabaseRow): GraphEdge {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    type: row.type as GraphEdgeType,
    weight: row.weight,
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at),
  };
}

function mapGraphLabel(row: DatabaseRow): GraphLabel {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    name: row.name,
    color: row.color,
    description: row.description,
    nodeCount: row.node_count || 0,
    createdAt: new Date(row.created_at),
  };
}

function mapGraphMetrics(row: DatabaseRow): GraphMetrics {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    nodeId: row.node_id,
    metricType: row.metric_type,
    value: row.value,
    computedAt: new Date(row.computed_at),
  };
}

function mapGraphSnapshot(row: DatabaseRow): GraphSnapshot {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    name: row.name,
    description: row.description,
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
    snapshotData: row.snapshot_data,
    createdAt: new Date(row.created_at),
  };
}

function mapGraphLayout(row: DatabaseRow): GraphLayout {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    name: row.name,
    layoutType: row.layout_type,
    nodePositions: row.node_positions || {},
    zoom: row.zoom,
    pan: row.pan || { x: 0, y: 0 },
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapGraphAnnotation(row: DatabaseRow): GraphAnnotation {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    nodeId: row.node_id,
    edgeId: row.edge_id,
    content: row.content,
    author: row.author,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// Graph Node Operations
// ============================================================================

export async function createGraphNode(node: NewGraphNode): Promise<GraphNode> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_nodes 
     (repository_id, type, name, description, file_path, start_line, end_line, 
      language, metadata, tags, metrics, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      node.repositoryId,
      node.type,
      node.name,
      node.description,
      node.filePath,
      node.startLine,
      node.endLine,
      node.language,
      JSON.stringify(node.metadata),
      node.tags,
      JSON.stringify(node.metrics),
      node.embedding,
    ]
  );
  return mapGraphNode(result[0]);
}

export async function createGraphNodes(nodes: NewGraphNode[]): Promise<GraphNode[]> {
  const results: GraphNode[] = [];
  for (const node of nodes) {
    results.push(await createGraphNode(node));
  }
  return results;
}

export async function getGraphNode(id: number): Promise<GraphNode | null> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_nodes WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapGraphNode(result[0]) : null;
}

export async function getGraphNodeByUuid(uuid: string): Promise<GraphNode | null> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_nodes WHERE uuid = $1',
    [uuid]
  );
  return result.length > 0 ? mapGraphNode(result[0]) : null;
}

export async function getGraphNodesByRepository(repositoryId: number): Promise<GraphNode[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_nodes WHERE repository_id = $1 ORDER BY type, name',
    [repositoryId]
  );
  return result.map(mapGraphNode);
}

export async function getGraphNodesByType(
  repositoryId: number,
  type: GraphNodeType
): Promise<GraphNode[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_nodes WHERE repository_id = $1 AND type = $2 ORDER BY name',
    [repositoryId, type]
  );
  return result.map(mapGraphNode);
}

export async function getGraphNodesByFilePath(
  repositoryId: number,
  filePath: string
): Promise<GraphNode[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_nodes WHERE repository_id = $1 AND file_path = $2 ORDER BY start_line',
    [repositoryId, filePath]
  );
  return result.map(mapGraphNode);
}

export async function searchGraphNodes(
  repositoryId: number,
  searchText: string
): Promise<GraphNode[]> {
  const result = await query<DatabaseRow>(
    `SELECT * FROM graph_nodes 
     WHERE repository_id = $1 
     AND (name ILIKE $2 OR description ILIKE $2)
     ORDER BY name
     LIMIT 100`,
    [repositoryId, `%${searchText}%`]
  );
  return result.map(mapGraphNode);
}

export async function updateGraphNode(
  id: number,
  updates: Partial<NewGraphNode>
): Promise<GraphNode> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metadata));
  }
  if (updates.tags !== undefined) {
    setClauses.push(`tags = $${paramIndex++}`);
    values.push(updates.tags);
  }
  if (updates.metrics !== undefined) {
    setClauses.push(`metrics = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metrics));
  }
  if (updates.embedding !== undefined) {
    setClauses.push(`embedding = $${paramIndex++}`);
    values.push(updates.embedding);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<DatabaseRow>(
    `UPDATE graph_nodes SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return mapGraphNode(result[0]);
}

export async function deleteGraphNode(id: number): Promise<void> {
  await execute('DELETE FROM graph_nodes WHERE id = $1', [id]);
}

export async function deleteGraphNodesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM graph_nodes WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Graph Edge Operations
// ============================================================================

export async function createGraphEdge(edge: NewGraphEdge): Promise<GraphEdge> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_edges 
     (repository_id, source_node_id, target_node_id, type, weight, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      edge.repositoryId,
      edge.sourceNodeId,
      edge.targetNodeId,
      edge.type,
      edge.weight,
      JSON.stringify(edge.metadata),
    ]
  );
  return mapGraphEdge(result[0]);
}

export async function createGraphEdges(edges: NewGraphEdge[]): Promise<GraphEdge[]> {
  const results: GraphEdge[] = [];
  for (const edge of edges) {
    results.push(await createGraphEdge(edge));
  }
  return results;
}

export async function getGraphEdge(id: number): Promise<GraphEdge | null> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_edges WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapGraphEdge(result[0]) : null;
}

export async function getGraphEdgesByRepository(repositoryId: number): Promise<GraphEdge[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_edges WHERE repository_id = $1',
    [repositoryId]
  );
  return result.map(mapGraphEdge);
}

export async function getGraphEdgesByType(
  repositoryId: number,
  type: GraphEdgeType
): Promise<GraphEdge[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_edges WHERE repository_id = $1 AND type = $2',
    [repositoryId, type]
  );
  return result.map(mapGraphEdge);
}

export async function getOutgoingEdges(nodeId: number): Promise<GraphEdge[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_edges WHERE source_node_id = $1',
    [nodeId]
  );
  return result.map(mapGraphEdge);
}

export async function getIncomingEdges(nodeId: number): Promise<GraphEdge[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_edges WHERE target_node_id = $1',
    [nodeId]
  );
  return result.map(mapGraphEdge);
}

export async function getEdgesBetween(
  sourceNodeId: number,
  targetNodeId: number
): Promise<GraphEdge[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_edges WHERE source_node_id = $1 AND target_node_id = $2',
    [sourceNodeId, targetNodeId]
  );
  return result.map(mapGraphEdge);
}

export async function updateGraphEdge(
  id: number,
  updates: Partial<NewGraphEdge>
): Promise<GraphEdge> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.weight !== undefined) {
    setClauses.push(`weight = $${paramIndex++}`);
    values.push(updates.weight);
  }
  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metadata));
  }

  values.push(id);

  const result = await query<DatabaseRow>(
    `UPDATE graph_edges SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return mapGraphEdge(result[0]);
}

export async function deleteGraphEdge(id: number): Promise<void> {
  await execute('DELETE FROM graph_edges WHERE id = $1', [id]);
}

export async function deleteGraphEdgesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM graph_edges WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Graph Label Operations
// ============================================================================

export async function createGraphLabel(label: NewGraphLabel): Promise<GraphLabel> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_labels (repository_id, name, color, description)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (repository_id, name) DO UPDATE SET color = $3, description = $4
     RETURNING *`,
    [label.repositoryId, label.name, label.color, label.description]
  );
  return mapGraphLabel(result[0]);
}

export async function getGraphLabelsByRepository(repositoryId: number): Promise<GraphLabel[]> {
  const result = await query<DatabaseRow>(
    `SELECT l.*, COUNT(nl.node_id) as node_count
     FROM graph_labels l
     LEFT JOIN node_labels nl ON l.id = nl.label_id
     WHERE l.repository_id = $1
     GROUP BY l.id
     ORDER BY l.name`,
    [repositoryId]
  );
  return result.map(mapGraphLabel);
}

export async function addNodeLabel(nodeId: number, labelId: number): Promise<void> {
  await execute(
    `INSERT INTO node_labels (node_id, label_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [nodeId, labelId]
  );
}

export async function removeNodeLabel(nodeId: number, labelId: number): Promise<void> {
  await execute(
    'DELETE FROM node_labels WHERE node_id = $1 AND label_id = $2',
    [nodeId, labelId]
  );
}

export async function getNodeLabels(nodeId: number): Promise<GraphLabel[]> {
  const result = await query<DatabaseRow>(
    `SELECT l.*, 1 as node_count
     FROM graph_labels l
     JOIN node_labels nl ON l.id = nl.label_id
     WHERE nl.node_id = $1`,
    [nodeId]
  );
  return result.map(mapGraphLabel);
}

export async function getNodesByLabel(labelId: number): Promise<GraphNode[]> {
  const result = await query<DatabaseRow>(
    `SELECT n.*
     FROM graph_nodes n
     JOIN node_labels nl ON n.id = nl.node_id
     WHERE nl.label_id = $1`,
    [labelId]
  );
  return result.map(mapGraphNode);
}

// ============================================================================
// Graph Metrics Operations
// ============================================================================

export async function saveGraphMetrics(
  repositoryId: number,
  nodeId: number,
  metricType: string,
  value: number
): Promise<GraphMetrics> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_metrics (repository_id, node_id, metric_type, value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (node_id, metric_type) DO UPDATE SET value = $4, computed_at = NOW()
     RETURNING *`,
    [repositoryId, nodeId, metricType, value]
  );
  return mapGraphMetrics(result[0]);
}

export async function getGraphMetricsByNode(nodeId: number): Promise<GraphMetrics[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_metrics WHERE node_id = $1',
    [nodeId]
  );
  return result.map(mapGraphMetrics);
}

export async function getGraphMetricsByRepository(repositoryId: number): Promise<GraphMetrics[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_metrics WHERE repository_id = $1',
    [repositoryId]
  );
  return result.map(mapGraphMetrics);
}

// ============================================================================
// Graph Snapshot Operations
// ============================================================================

export async function createGraphSnapshot(snapshot: NewGraphSnapshot): Promise<GraphSnapshot> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_snapshots 
     (repository_id, name, description, node_count, edge_count, snapshot_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      snapshot.repositoryId,
      snapshot.name,
      snapshot.description,
      snapshot.nodeCount,
      snapshot.edgeCount,
      snapshot.snapshotData,
    ]
  );
  return mapGraphSnapshot(result[0]);
}

export async function getGraphSnapshots(repositoryId: number): Promise<GraphSnapshot[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_snapshots WHERE repository_id = $1 ORDER BY created_at DESC',
    [repositoryId]
  );
  return result.map(mapGraphSnapshot);
}

export async function getGraphSnapshot(id: number): Promise<GraphSnapshot | null> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_snapshots WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapGraphSnapshot(result[0]) : null;
}

export async function deleteGraphSnapshot(id: number): Promise<void> {
  await execute('DELETE FROM graph_snapshots WHERE id = $1', [id]);
}

// ============================================================================
// Graph Layout Operations
// ============================================================================

export async function saveGraphLayout(layout: NewGraphLayout): Promise<GraphLayout> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_layouts 
     (repository_id, name, layout_type, node_positions, zoom, pan)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repository_id, name) DO UPDATE 
     SET layout_type = $3, node_positions = $4, zoom = $5, pan = $6, updated_at = NOW()
     RETURNING *`,
    [
      layout.repositoryId,
      layout.name,
      layout.layoutType,
      JSON.stringify(layout.nodePositions),
      layout.zoom,
      JSON.stringify(layout.pan),
    ]
  );
  return mapGraphLayout(result[0]);
}

export async function getGraphLayouts(repositoryId: number): Promise<GraphLayout[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_layouts WHERE repository_id = $1 ORDER BY updated_at DESC',
    [repositoryId]
  );
  return result.map(mapGraphLayout);
}

export async function getGraphLayout(id: number): Promise<GraphLayout | null> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_layouts WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapGraphLayout(result[0]) : null;
}

export async function getGraphLayoutByName(
  repositoryId: number,
  name: string
): Promise<GraphLayout | null> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_layouts WHERE repository_id = $1 AND name = $2',
    [repositoryId, name]
  );
  return result.length > 0 ? mapGraphLayout(result[0]) : null;
}

export async function deleteGraphLayout(id: number): Promise<void> {
  await execute('DELETE FROM graph_layouts WHERE id = $1', [id]);
}

// ============================================================================
// Graph Annotation Operations
// ============================================================================

export async function createGraphAnnotation(
  annotation: NewGraphAnnotation
): Promise<GraphAnnotation> {
  const result = await query<DatabaseRow>(
    `INSERT INTO graph_annotations 
     (repository_id, node_id, edge_id, content, author)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      annotation.repositoryId,
      annotation.nodeId,
      annotation.edgeId,
      annotation.content,
      annotation.author,
    ]
  );
  return mapGraphAnnotation(result[0]);
}

export async function getGraphAnnotationsByNode(nodeId: number): Promise<GraphAnnotation[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_annotations WHERE node_id = $1 ORDER BY created_at',
    [nodeId]
  );
  return result.map(mapGraphAnnotation);
}

export async function getGraphAnnotationsByEdge(edgeId: number): Promise<GraphAnnotation[]> {
  const result = await query<DatabaseRow>(
    'SELECT * FROM graph_annotations WHERE edge_id = $1 ORDER BY created_at',
    [edgeId]
  );
  return result.map(mapGraphAnnotation);
}

export async function updateGraphAnnotation(
  id: number,
  content: string
): Promise<GraphAnnotation> {
  const result = await query<DatabaseRow>(
    'UPDATE graph_annotations SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [content, id]
  );
  return mapGraphAnnotation(result[0]);
}

export async function deleteGraphAnnotation(id: number): Promise<void> {
  await execute('DELETE FROM graph_annotations WHERE id = $1', [id]);
}

// ============================================================================
// Graph Statistics
// ============================================================================

export async function getGraphStats(repositoryId: number): Promise<GraphStats> {
  const [nodeCount] = await query<DatabaseRow>(
    'SELECT COUNT(*) as count FROM graph_nodes WHERE repository_id = $1',
    [repositoryId]
  );
  
  const [edgeCount] = await query<DatabaseRow>(
    'SELECT COUNT(*) as count FROM graph_edges WHERE repository_id = $1',
    [repositoryId]
  );
  
  const nodeTypeResult = await query<DatabaseRow>(
    'SELECT type, COUNT(*) as count FROM graph_nodes WHERE repository_id = $1 GROUP BY type',
    [repositoryId]
  );
  
  const edgeTypeResult = await query<DatabaseRow>(
    'SELECT type, COUNT(*) as count FROM graph_edges WHERE repository_id = $1 GROUP BY type',
    [repositoryId]
  );
  
  const nodeTypeDistribution: Record<string, number> = {};
  for (const row of nodeTypeResult) {
    nodeTypeDistribution[row.type] = parseInt(row.count);
  }
  
  const edgeTypeDistribution: Record<string, number> = {};
  for (const row of edgeTypeResult) {
    edgeTypeDistribution[row.type] = parseInt(row.count);
  }
  
  const nodes = parseInt(nodeCount?.count || '0');
  const edges = parseInt(edgeCount?.count || '0');
  const averageDegree = nodes > 0 ? (2 * edges) / nodes : 0;
  const maxEdges = (nodes * (nodes - 1)) / 2;
  const density = maxEdges > 0 ? edges / maxEdges : 0;
  
  return {
    nodeCount: nodes,
    edgeCount: edges,
    nodeTypeDistribution: nodeTypeDistribution as Record<GraphNodeType, number>,
    edgeTypeDistribution: edgeTypeDistribution as Record<GraphEdgeType, number>,
    connectedComponents: 0, // Will be computed by graph algorithms
    averageDegree,
    density,
  };
}

// ============================================================================
// Clear Graph Data
// ============================================================================

export async function clearGraphData(repositoryId: number): Promise<void> {
  // Delete in correct order to handle foreign key constraints
  await execute('DELETE FROM graph_annotations WHERE repository_id = $1', [repositoryId]);
  await execute('DELETE FROM graph_metrics WHERE repository_id = $1', [repositoryId]);
  await execute('DELETE FROM graph_edges WHERE repository_id = $1', [repositoryId]);
  await execute('DELETE FROM node_labels WHERE node_id IN (SELECT id FROM graph_nodes WHERE repository_id = $1)', [repositoryId]);
  await execute('DELETE FROM graph_nodes WHERE repository_id = $1', [repositoryId]);
  await execute('DELETE FROM graph_labels WHERE repository_id = $1', [repositoryId]);
  await execute('DELETE FROM graph_analysis_cache WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Graph Analysis Cache
// ============================================================================

export async function getCachedAnalysis<T>(
  repositoryId: number,
  analysisType: string,
  inputHash: string
): Promise<T | null> {
  const result = await query<DatabaseRow>(
    `SELECT result FROM graph_analysis_cache 
     WHERE repository_id = $1 AND analysis_type = $2 AND input_hash = $3
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [repositoryId, analysisType, inputHash]
  );
  if (result.length === 0) return null;
  return result[0].result as T;
}

export async function setCachedAnalysis<T>(
  repositoryId: number,
  analysisType: string,
  inputHash: string,
  result: T,
  ttlSeconds?: number
): Promise<void> {
  const expiresAt = ttlSeconds
    ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
    : null;
  
  await execute(
    `INSERT INTO graph_analysis_cache 
     (repository_id, analysis_type, input_hash, result, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repository_id, analysis_type, input_hash) 
     DO UPDATE SET result = $4, expires_at = $5, created_at = NOW()`,
    [repositoryId, analysisType, inputHash, JSON.stringify(result), expiresAt]
  );
}

export async function clearAnalysisCache(repositoryId: number): Promise<void> {
  await execute('DELETE FROM graph_analysis_cache WHERE repository_id = $1', [repositoryId]);
}
