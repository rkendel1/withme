/**
 * Repository Cache Database Schema
 * 
 * Schema for tracking repository acquisition status, commit history,
 * and content hashing for incremental synchronization.
 */

export const ACQUISITION_SCHEMA_SQL = `
-- Repository cache table for tracking sync status and content
CREATE TABLE IF NOT EXISTS repository_cache (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
  
  -- Last known commit SHA for incremental sync
  last_commit_sha TEXT,
  
  -- Sync status tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'fresh',
  sync_error TEXT,
  
  -- Acquisition metadata
  acquisition_source TEXT NOT NULL,
  has_full_content BOOLEAN DEFAULT FALSE,
  cached_file_count INTEGER DEFAULT 0,
  cached_size_bytes BIGINT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content hash table for deduplication and change detection
CREATE TABLE IF NOT EXISTS content_hashes (
  id SERIAL PRIMARY KEY,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  
  -- File identification
  file_path TEXT NOT NULL,
  
  -- Content hashes
  sha256 TEXT NOT NULL,
  git_blob_sha TEXT,
  
  -- File metadata
  size_bytes INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(repository_id, file_path)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_repository_cache_repository ON repository_cache(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_cache_sync_status ON repository_cache(sync_status);
CREATE INDEX IF NOT EXISTS idx_content_hashes_repository ON content_hashes(repository_id);
CREATE INDEX IF NOT EXISTS idx_content_hashes_sha256 ON content_hashes(sha256);
CREATE INDEX IF NOT EXISTS idx_content_hashes_path ON content_hashes(file_path);
`;

export const ACQUISITION_MIGRATION = {
  version: 5,
  name: 'repository_acquisition',
  sql: ACQUISITION_SCHEMA_SQL,
};
