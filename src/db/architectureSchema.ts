/**
 * Architecture Database Schema
 * 
 * These tables store the Repository Digital Twin - a structured graph
 * representation of the software architecture.
 */

export const ARCHITECTURE_SCHEMA_SQL = `
-- ============================================================================
-- Architecture Nodes Table
-- Represents all software concepts in the Digital Twin
-- ============================================================================
CREATE TABLE IF NOT EXISTS architecture_nodes (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  parent_node_id INTEGER REFERENCES architecture_nodes(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Architecture Edges Table
-- Represents relationships between architecture nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS architecture_edges (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_node_id INTEGER NOT NULL REFERENCES architecture_nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER NOT NULL REFERENCES architecture_nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Services Table
-- Detected services (REST APIs, GraphQL, Workers, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  entry_point TEXT,
  port INTEGER,
  description TEXT,
  technologies TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Layers Table
-- Architectural layers (Presentation, API, Domain, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS layers (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  layer_order INTEGER DEFAULT 0,
  patterns TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Modules Table
-- Detected modules and packages
-- ============================================================================
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  is_entry_point BOOLEAN DEFAULT FALSE,
  exports TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, path)
);

-- ============================================================================
-- Entry Points Table
-- Application entry points (main functions, routes, handlers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS entry_points (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  function_name TEXT,
  http_method TEXT,
  route_path TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- API Endpoints Table
-- HTTP endpoints exposed by the service
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_endpoints (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  handler_file TEXT NOT NULL,
  handler_function TEXT,
  parameters JSONB DEFAULT '[]',
  response_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Technologies Table
-- Detected technologies, frameworks, and tools
-- ============================================================================
CREATE TABLE IF NOT EXISTS technologies (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT,
  confidence REAL DEFAULT 1.0,
  detected_in TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name, category)
);

-- ============================================================================
-- Datastores Table
-- Databases and storage systems used
-- ============================================================================
CREATE TABLE IF NOT EXISTS datastores (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  connection_string TEXT,
  used_in TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Queues Table
-- Message queues and pub/sub systems
-- ============================================================================
CREATE TABLE IF NOT EXISTS queues (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  producers TEXT[] DEFAULT '{}',
  consumers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Execution Paths Table
-- Request/data flow paths through the system
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_paths (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  steps JSONB DEFAULT '[]',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Runtime Components Table
-- Docker containers, Kubernetes pods, etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS runtime_components (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  image TEXT,
  ports INTEGER[] DEFAULT '{}',
  environment JSONB DEFAULT '{}',
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, name)
);

-- ============================================================================
-- Configuration Table
-- Environment variables, secrets, and config
-- ============================================================================
CREATE TABLE IF NOT EXISTS configuration (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  default_value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, key, source)
);

-- ============================================================================
-- Architecture Summaries Table
-- Cached architecture analysis results
-- ============================================================================
CREATE TABLE IF NOT EXISTS architecture_summaries (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id)
);

-- ============================================================================
-- Indexes for better query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_architecture_nodes_repository ON architecture_nodes(repository_id);
CREATE INDEX IF NOT EXISTS idx_architecture_nodes_type ON architecture_nodes(type);
CREATE INDEX IF NOT EXISTS idx_architecture_nodes_parent ON architecture_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_architecture_nodes_file ON architecture_nodes(file_path);

CREATE INDEX IF NOT EXISTS idx_architecture_edges_repository ON architecture_edges(repository_id);
CREATE INDEX IF NOT EXISTS idx_architecture_edges_source ON architecture_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_architecture_edges_target ON architecture_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_architecture_edges_type ON architecture_edges(type);

CREATE INDEX IF NOT EXISTS idx_services_repository ON services(repository_id);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(type);

CREATE INDEX IF NOT EXISTS idx_layers_repository ON layers(repository_id);
CREATE INDEX IF NOT EXISTS idx_layers_type ON layers(type);

CREATE INDEX IF NOT EXISTS idx_modules_repository ON modules(repository_id);
CREATE INDEX IF NOT EXISTS idx_modules_path ON modules(path);

CREATE INDEX IF NOT EXISTS idx_entry_points_repository ON entry_points(repository_id);
CREATE INDEX IF NOT EXISTS idx_entry_points_type ON entry_points(type);
CREATE INDEX IF NOT EXISTS idx_entry_points_file ON entry_points(file_path);

CREATE INDEX IF NOT EXISTS idx_api_endpoints_repository ON api_endpoints(repository_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_service ON api_endpoints(service_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_path ON api_endpoints(path);

CREATE INDEX IF NOT EXISTS idx_technologies_repository ON technologies(repository_id);
CREATE INDEX IF NOT EXISTS idx_technologies_category ON technologies(category);

CREATE INDEX IF NOT EXISTS idx_datastores_repository ON datastores(repository_id);
CREATE INDEX IF NOT EXISTS idx_datastores_type ON datastores(type);

CREATE INDEX IF NOT EXISTS idx_queues_repository ON queues(repository_id);
CREATE INDEX IF NOT EXISTS idx_queues_type ON queues(type);

CREATE INDEX IF NOT EXISTS idx_execution_paths_repository ON execution_paths(repository_id);

CREATE INDEX IF NOT EXISTS idx_runtime_components_repository ON runtime_components(repository_id);

CREATE INDEX IF NOT EXISTS idx_configuration_repository ON configuration(repository_id);
CREATE INDEX IF NOT EXISTS idx_configuration_type ON configuration(type);
`;

export const ARCHITECTURE_MIGRATION = {
  version: 2,
  name: 'architecture_schema',
  sql: ARCHITECTURE_SCHEMA_SQL,
};
