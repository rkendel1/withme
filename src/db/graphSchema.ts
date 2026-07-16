/**
 * Graph Database Schema
 * 
 * This schema defines the Repository Relationship Graph (RRG) tables.
 * The graph is the canonical representation of software structure.
 */

export const GRAPH_SCHEMA_SQL = `
-- ============================================================================
-- Graph Nodes Table
-- Every significant software artifact in the repository
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_nodes (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid(),
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  language TEXT,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  embedding REAL[] DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Graph Edges Table
-- Relationships between nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_edges (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_node_id INTEGER NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Graph Labels Table
-- User-defined labels for categorizing nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_labels (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8b5cf6',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Node Labels Junction Table
-- Many-to-many relationship between nodes and labels
-- ============================================================================
CREATE TABLE IF NOT EXISTS node_labels (
  node_id INTEGER NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES graph_labels(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (node_id, label_id)
);

-- ============================================================================
-- Graph Metrics Table
-- Computed graph metrics for nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_metrics (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value REAL NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(node_id, metric_type)
);

-- ============================================================================
-- Graph Snapshots Table
-- Saved states of the graph for versioning
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_snapshots (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  snapshot_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Graph Layouts Table
-- Persisted graph layouts for users
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_layouts (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_type TEXT NOT NULL,
  node_positions JSONB DEFAULT '{}',
  zoom REAL DEFAULT 1.0,
  pan JSONB DEFAULT '{"x": 0, "y": 0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Graph Annotations Table
-- User notes and comments on nodes/edges
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_annotations (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  node_id INTEGER REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_id INTEGER REFERENCES graph_edges(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (node_id IS NOT NULL OR edge_id IS NOT NULL)
);

-- ============================================================================
-- Graph Analysis Cache Table
-- Cached results of expensive graph computations
-- ============================================================================
CREATE TABLE IF NOT EXISTS graph_analysis_cache (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, analysis_type, input_hash)
);

-- ============================================================================
-- Indexes for better query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_graph_nodes_repository ON graph_nodes(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_name ON graph_nodes(name);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_file_path ON graph_nodes(file_path);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_language ON graph_nodes(language);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_uuid ON graph_nodes(uuid);

CREATE INDEX IF NOT EXISTS idx_graph_edges_repository ON graph_edges(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON graph_edges(type);

CREATE INDEX IF NOT EXISTS idx_graph_labels_repository ON graph_labels(repository_id);
CREATE INDEX IF NOT EXISTS idx_node_labels_node ON node_labels(node_id);
CREATE INDEX IF NOT EXISTS idx_node_labels_label ON node_labels(label_id);

CREATE INDEX IF NOT EXISTS idx_graph_metrics_repository ON graph_metrics(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_metrics_node ON graph_metrics(node_id);
CREATE INDEX IF NOT EXISTS idx_graph_metrics_type ON graph_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_graph_snapshots_repository ON graph_snapshots(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_layouts_repository ON graph_layouts(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_annotations_repository ON graph_annotations(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_annotations_node ON graph_annotations(node_id);
CREATE INDEX IF NOT EXISTS idx_graph_annotations_edge ON graph_annotations(edge_id);

CREATE INDEX IF NOT EXISTS idx_graph_analysis_cache_repository ON graph_analysis_cache(repository_id);
CREATE INDEX IF NOT EXISTS idx_graph_analysis_cache_type ON graph_analysis_cache(analysis_type);
`;

export const GRAPH_MIGRATION = {
  version: 3,
  name: 'graph_schema',
  sql: GRAPH_SCHEMA_SQL,
};
