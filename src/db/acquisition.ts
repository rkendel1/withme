/**
 * Repository Acquisition Database Operations
 * 
 * CRUD operations for repository cache and content hash management.
 */

import { query, execute } from './index';
import type {
  RepositoryCache,
  CreateRepositoryCacheData,
  ContentHash,
  SyncStatus,
} from '../types/acquisition';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseRow = Record<string, any>;

// ============================================================================
// Repository Cache Operations
// ============================================================================

/**
 * Create or update a repository cache entry
 */
export async function upsertRepositoryCache(
  data: CreateRepositoryCacheData
): Promise<RepositoryCache> {
  const result = await query(
    `INSERT INTO repository_cache (
      repository_id, last_commit_sha, last_synced_at, sync_status, sync_error,
      acquisition_source, has_full_content, cached_file_count, cached_size_bytes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (repository_id) DO UPDATE SET
      last_commit_sha = EXCLUDED.last_commit_sha,
      last_synced_at = EXCLUDED.last_synced_at,
      sync_status = EXCLUDED.sync_status,
      sync_error = EXCLUDED.sync_error,
      acquisition_source = EXCLUDED.acquisition_source,
      has_full_content = EXCLUDED.has_full_content,
      cached_file_count = EXCLUDED.cached_file_count,
      cached_size_bytes = EXCLUDED.cached_size_bytes,
      updated_at = NOW()
    RETURNING *`,
    [
      data.repositoryId,
      data.lastCommitSha,
      data.lastSyncedAt,
      data.syncStatus,
      data.syncError,
      data.acquisitionSource,
      data.hasFullContent,
      data.cachedFileCount,
      data.cachedSizeBytes,
    ]
  );
  return mapRepositoryCache(result[0]);
}

/**
 * Get repository cache by repository ID
 */
export async function getRepositoryCache(
  repositoryId: number
): Promise<RepositoryCache | null> {
  const result = await query(
    'SELECT * FROM repository_cache WHERE repository_id = $1',
    [repositoryId]
  );
  return result.length > 0 ? mapRepositoryCache(result[0]) : null;
}

/**
 * Update sync status for a repository
 */
export async function updateSyncStatus(
  repositoryId: number,
  status: SyncStatus,
  error?: string | null
): Promise<void> {
  await execute(
    `UPDATE repository_cache 
     SET sync_status = $2, sync_error = $3, updated_at = NOW()
     WHERE repository_id = $1`,
    [repositoryId, status, error || null]
  );
}

/**
 * Update last commit SHA after sync
 */
export async function updateLastCommitSha(
  repositoryId: number,
  commitSha: string
): Promise<void> {
  await execute(
    `UPDATE repository_cache 
     SET last_commit_sha = $2, last_synced_at = NOW(), sync_status = 'fresh', sync_error = NULL, updated_at = NOW()
     WHERE repository_id = $1`,
    [repositoryId, commitSha]
  );
}

/**
 * Get all repositories that need sync
 */
export async function getStaleRepositories(): Promise<RepositoryCache[]> {
  const result = await query(
    `SELECT * FROM repository_cache WHERE sync_status IN ('stale', 'error')`
  );
  return result.map(mapRepositoryCache);
}

/**
 * Delete repository cache
 */
export async function deleteRepositoryCache(repositoryId: number): Promise<void> {
  await execute('DELETE FROM repository_cache WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Content Hash Operations
// ============================================================================

/**
 * Upsert a content hash
 */
export async function upsertContentHash(
  repositoryId: number,
  hash: ContentHash
): Promise<void> {
  await execute(
    `INSERT INTO content_hashes (repository_id, file_path, sha256, git_blob_sha, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repository_id, file_path) DO UPDATE SET
       sha256 = EXCLUDED.sha256,
       git_blob_sha = EXCLUDED.git_blob_sha,
       size_bytes = EXCLUDED.size_bytes,
       updated_at = NOW()`,
    [repositoryId, hash.path, hash.sha256, hash.gitBlobSha, hash.sizeBytes]
  );
}

/**
 * Bulk upsert content hashes
 * Uses Promise.all for concurrent processing in batches
 */
export async function upsertContentHashes(
  repositoryId: number,
  hashes: ContentHash[]
): Promise<void> {
  // Process in batches of 50 for balanced performance
  const batchSize = 50;
  for (let i = 0; i < hashes.length; i += batchSize) {
    const batch = hashes.slice(i, i + batchSize);
    await Promise.all(batch.map(hash => upsertContentHash(repositoryId, hash)));
  }
}

/**
 * Get content hash for a file
 */
export async function getContentHash(
  repositoryId: number,
  filePath: string
): Promise<ContentHash | null> {
  const result = await query(
    'SELECT * FROM content_hashes WHERE repository_id = $1 AND file_path = $2',
    [repositoryId, filePath]
  );
  return result.length > 0 ? mapContentHash(result[0]) : null;
}

/**
 * Get all content hashes for a repository
 */
export async function getContentHashes(
  repositoryId: number
): Promise<ContentHash[]> {
  const result = await query(
    'SELECT * FROM content_hashes WHERE repository_id = $1',
    [repositoryId]
  );
  return result.map(mapContentHash);
}

/**
 * Get content hash map for quick lookup (path -> hash)
 */
export async function getContentHashMap(
  repositoryId: number
): Promise<Map<string, ContentHash>> {
  const hashes = await getContentHashes(repositoryId);
  const map = new Map<string, ContentHash>();
  for (const hash of hashes) {
    map.set(hash.path, hash);
  }
  return map;
}

/**
 * Delete content hashes for removed files
 */
export async function deleteContentHashes(
  repositoryId: number,
  filePaths: string[]
): Promise<void> {
  if (filePaths.length === 0) return;
  
  // Build parameterized query for array of paths
  const placeholders = filePaths.map((_, i) => `$${i + 2}`).join(', ');
  await execute(
    `DELETE FROM content_hashes WHERE repository_id = $1 AND file_path IN (${placeholders})`,
    [repositoryId, ...filePaths]
  );
}

/**
 * Delete all content hashes for a repository
 */
export async function deleteAllContentHashes(repositoryId: number): Promise<void> {
  await execute('DELETE FROM content_hashes WHERE repository_id = $1', [repositoryId]);
}

/**
 * Count files with same content hash (for deduplication stats)
 */
export async function countDuplicateContent(
  repositoryId: number
): Promise<{ hash: string; count: number }[]> {
  const result = await query(
    `SELECT sha256 as hash, COUNT(*) as count 
     FROM content_hashes 
     WHERE repository_id = $1 
     GROUP BY sha256 
     HAVING COUNT(*) > 1
     ORDER BY count DESC`,
    [repositoryId]
  );
  return result.map((row: DatabaseRow) => ({
    hash: row.hash as string,
    count: parseInt(row.count as string, 10),
  }));
}

// ============================================================================
// Mappers
// ============================================================================

function mapRepositoryCache(row: DatabaseRow): RepositoryCache {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    lastCommitSha: row.last_commit_sha as string | null,
    lastSyncedAt: new Date(row.last_synced_at as string),
    syncStatus: row.sync_status as SyncStatus,
    syncError: row.sync_error as string | null,
    acquisitionSource: row.acquisition_source as RepositoryCache['acquisitionSource'],
    hasFullContent: row.has_full_content as boolean,
    cachedFileCount: row.cached_file_count as number,
    cachedSizeBytes: row.cached_size_bytes as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapContentHash(row: DatabaseRow): ContentHash {
  return {
    path: row.file_path as string,
    sha256: row.sha256 as string,
    gitBlobSha: row.git_blob_sha as string | null,
    sizeBytes: row.size_bytes as number,
  };
}
