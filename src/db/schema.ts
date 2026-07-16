/** Database schema SQL for PGlite */
export const SCHEMA_SQL = `
-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  full_name TEXT UNIQUE NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  default_branch TEXT DEFAULT 'main',
  language TEXT,
  platform TEXT DEFAULT 'github',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection repositories junction table
CREATE TABLE IF NOT EXISTS collection_repositories (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, repository_id)
);

-- Directories table
CREATE TABLE IF NOT EXISTS directories (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_path TEXT,
  UNIQUE(repository_id, path)
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  extension TEXT,
  language TEXT,
  size INTEGER DEFAULT 0,
  content TEXT,
  sha TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repository_id, path)
);

-- Symbols table (functions, classes, etc.)
CREATE TABLE IF NOT EXISTS symbols (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  signature TEXT,
  docstring TEXT
);

-- Imports table
CREATE TABLE IF NOT EXISTS imports (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  specifiers TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  line INTEGER
);

-- Dependencies table
CREATE TABLE IF NOT EXISTS dependencies (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT,
  type TEXT DEFAULT 'production',
  ecosystem TEXT NOT NULL,
  UNIQUE(repository_id, name, ecosystem)
);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  target_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  type TEXT NOT NULL
);

-- Chunks table (for embeddings)
CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  embedding REAL[]
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query history table
CREATE TABLE IF NOT EXISTS query_history (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  answer TEXT,
  sources JSONB,
  sql_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_files_repository ON files(repository_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_symbols_repository ON symbols(repository_id);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_imports_repository ON imports(repository_id);
CREATE INDEX IF NOT EXISTS idx_imports_source ON imports(source);
CREATE INDEX IF NOT EXISTS idx_dependencies_repository ON dependencies(repository_id);
CREATE INDEX IF NOT EXISTS idx_chunks_repository ON chunks(repository_id);
CREATE INDEX IF NOT EXISTS idx_directories_repository ON directories(repository_id);
CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
CREATE INDEX IF NOT EXISTS idx_collection_repositories_collection ON collection_repositories(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_repositories_repository ON collection_repositories(repository_id);
`;

import { ARCHITECTURE_SCHEMA_SQL, ARCHITECTURE_MIGRATION } from './architectureSchema';
import { GRAPH_SCHEMA_SQL, GRAPH_MIGRATION } from './graphSchema';
import { RUNTIME_SCHEMA_SQL, RUNTIME_MIGRATION } from './runtimeSchema';

export const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: SCHEMA_SQL,
  },
  ARCHITECTURE_MIGRATION,
  GRAPH_MIGRATION,
  RUNTIME_MIGRATION,
];

// Combined schema for initial database setup
export const COMBINED_SCHEMA_SQL = SCHEMA_SQL + '\n' + ARCHITECTURE_SCHEMA_SQL + '\n' + GRAPH_SCHEMA_SQL + '\n' + RUNTIME_SCHEMA_SQL;
