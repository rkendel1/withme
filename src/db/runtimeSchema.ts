/**
 * Runtime Profiles Database Schema
 * 
 * This schema stores runtime profiles detected from repositories
 * and execution session tracking.
 */

export const RUNTIME_SCHEMA_SQL = `
-- ============================================================================
-- Runtime Profiles Table
-- Stores detected runtime configuration for repositories
-- ============================================================================
CREATE TABLE IF NOT EXISTS runtime_profiles (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  
  -- Runtime detection
  runtime TEXT NOT NULL,
  version TEXT,
  
  -- Package management
  package_manager TEXT NOT NULL,
  lock_file TEXT,
  
  -- Framework
  framework TEXT,
  
  -- Commands
  install_command TEXT NOT NULL,
  start_command TEXT NOT NULL,
  build_command TEXT,
  test_command TEXT,
  
  -- Network
  ports INTEGER[] DEFAULT '{}',
  
  -- Environment
  environment_variables JSONB DEFAULT '{}',
  
  -- Detection metadata
  confidence REAL DEFAULT 1.0,
  detected_from TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(repository_id)
);

-- ============================================================================
-- Execution Sessions Table
-- Tracks active and past execution sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_sessions (
  id TEXT PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES runtime_profiles(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'idle',
  status_message TEXT,
  
  -- Environment
  environment TEXT NOT NULL DEFAULT 'default',
  mode TEXT NOT NULL DEFAULT 'local',
  
  -- Container info
  container_id TEXT,
  container_image TEXT,
  
  -- Access
  url TEXT,
  ports JSONB DEFAULT '[]',
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_at TIMESTAMPTZ
);

-- ============================================================================
-- Execution Logs Table
-- Stores logs from execution sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_logs (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES execution_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system'
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_runtime_profiles_repository ON runtime_profiles(repository_id);
CREATE INDEX IF NOT EXISTS idx_runtime_profiles_runtime ON runtime_profiles(runtime);

CREATE INDEX IF NOT EXISTS idx_execution_sessions_repository ON execution_sessions(repository_id);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_status ON execution_sessions(status);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_profile ON execution_sessions(profile_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_session ON execution_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_execution_logs_level ON execution_logs(level);
`;

export const RUNTIME_MIGRATION = {
  version: 4,
  name: 'runtime_schema',
  sql: RUNTIME_SCHEMA_SQL,
};
