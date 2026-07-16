/**
 * Content Hasher
 * 
 * Provides SHA-256 content hashing for file deduplication and change detection.
 */

import type { ContentHash, FileChangeResult } from '../../types/acquisition';

/**
 * Calculate SHA-256 hash of a string
 */
export async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate SHA-256 hash of an ArrayBuffer
 */
export async function sha256Buffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a content hash for a file
 */
export async function createContentHash(
  path: string,
  content: string | null,
  sizeBytes: number,
  gitBlobSha?: string | null
): Promise<ContentHash> {
  const hash = content ? await sha256(content) : await sha256('');
  return {
    path,
    sha256: hash,
    gitBlobSha: gitBlobSha || null,
    sizeBytes,
  };
}

/**
 * Detect changes between current files and cached hashes
 */
export function detectChanges(
  currentHashes: Map<string, ContentHash>,
  cachedHashes: Map<string, ContentHash>
): FileChangeResult {
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const unchanged: string[] = [];

  // Check current files against cache
  for (const [path, currentHash] of currentHashes) {
    const cachedHash = cachedHashes.get(path);
    
    if (!cachedHash) {
      // New file
      added.push(path);
    } else if (cachedHash.sha256 !== currentHash.sha256) {
      // Modified file
      modified.push(path);
    } else {
      // Unchanged
      unchanged.push(path);
    }
  }

  // Check for deleted files
  for (const path of cachedHashes.keys()) {
    if (!currentHashes.has(path)) {
      deleted.push(path);
    }
  }

  return { added, modified, deleted, unchanged };
}

/**
 * Check if content needs to be processed
 * @param currentHash - The current content hash
 * @param cachedHash - The cached content hash (if exists)
 * @returns true if content needs processing, false if unchanged
 */
export function shouldProcessFile(
  currentHash: ContentHash,
  cachedHash: ContentHash | undefined
): boolean {
  if (!cachedHash) return true;
  return currentHash.sha256 !== cachedHash.sha256;
}
