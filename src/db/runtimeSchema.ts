/**
 * Runtime Profiles Database Schema
 * 
 * This schema stores runtime profiles detected from repositories,
 * execution session tracking, container lifecycle management,
 * and application process monitoring.
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
-- Runtime Containers Table
-- Tracks reusable execution containers
-- ============================================================================
CREATE TABLE IF NOT EXISTS runtime_containers (
  id TEXT PRIMARY KEY,
  runtime_image TEXT NOT NULL,
  runtime_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  resource_limits JSONB DEFAULT '{"cpuLimit": 1, "memoryLimit": 512}',
  metadata JSONB DEFAULT '{}'
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
  environment TEXT NOT NULL DEFAULT 'development',
  mode TEXT NOT NULL DEFAULT 'local',
  
  -- Device context
  device_type TEXT,
  provider TEXT,
  preview_type TEXT,
  
  -- Container info
  container_id TEXT REFERENCES runtime_containers(id) ON DELETE SET NULL,
  container_image TEXT,
  
  -- Execution details
  command TEXT,
  working_directory TEXT,
  
  -- Access
  url TEXT,
  preview_url TEXT,
  ports JSONB DEFAULT '[]',
  port_mapping JSONB DEFAULT '{}',
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  stopped_at TIMESTAMPTZ
);

-- ============================================================================
-- Execution Processes Table
-- Tracks application processes within sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_processes (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES execution_sessions(id) ON DELETE CASCADE,
  pid INTEGER,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  health TEXT NOT NULL DEFAULT 'unknown',
  restart_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Container Events Table
-- Runtime history and lifecycle events
-- ============================================================================
CREATE TABLE IF NOT EXISTS container_events (
  id SERIAL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES runtime_containers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
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

CREATE INDEX IF NOT EXISTS idx_runtime_containers_status ON runtime_containers(status);
CREATE INDEX IF NOT EXISTS idx_runtime_containers_runtime_image ON runtime_containers(runtime_image);

CREATE INDEX IF NOT EXISTS idx_execution_sessions_repository ON execution_sessions(repository_id);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_status ON execution_sessions(status);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_profile ON execution_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_execution_sessions_container ON execution_sessions(container_id);

CREATE INDEX IF NOT EXISTS idx_execution_processes_session ON execution_processes(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_processes_status ON execution_processes(status);

CREATE INDEX IF NOT EXISTS idx_container_events_container ON container_events(container_id);
CREATE INDEX IF NOT EXISTS idx_container_events_type ON container_events(event_type);
CREATE INDEX IF NOT EXISTS idx_container_events_timestamp ON container_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_execution_logs_session ON execution_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_execution_logs_level ON execution_logs(level);

-- ============================================================================
-- Migration: Add missing columns to execution_sessions for existing databases
-- These columns may not exist in older database versions
-- ============================================================================
DO $$
BEGIN
  -- Add device_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'device_type'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN device_type TEXT;
  END IF;

  -- Add provider column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'provider'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN provider TEXT;
  END IF;

  -- Add preview_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'preview_type'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN preview_type TEXT;
  END IF;

  -- Add command column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'command'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN command TEXT;
  END IF;

  -- Add working_directory column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'working_directory'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN working_directory TEXT;
  END IF;

  -- Add preview_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'preview_url'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN preview_url TEXT;
  END IF;

  -- Add port_mapping column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'execution_sessions' AND column_name = 'port_mapping'
  ) THEN
    ALTER TABLE execution_sessions ADD COLUMN port_mapping JSONB DEFAULT '{}';
  END IF;
END $$;
`;

export const RUNTIME_MIGRATION = {
  version: 4,
  name: 'runtime_schema',
  sql: RUNTIME_SCHEMA_SQL,
};
