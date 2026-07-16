/**
 * Repository Acquisition Service
 * 
 * Main entry point for acquiring repositories from various sources.
 * Implements smart rate limit avoidance by preferring local sources.
 */

import type {
  ResolverInput,
  AcquisitionResult,
  AcquisitionProgressCallback,
  FolderSourceDetails,
  ZipSourceDetails,
} from '../../types/acquisition';
import { resolveSource } from './resolver';
import { ingestFolder } from './folderImport';
import { ingestZip } from './zipImport';
import { ingestGitHubRepository, IngestionProgress } from '../github';
import { ingestGitLabRepository } from '../gitlab';

// Re-export for convenience
export { resolveSource, isUrlInput } from './resolver';
export { ingestFolder, parseFolderImport } from './folderImport';
export { ingestZip, parseZipImport } from './zipImport';
export { sha256, createContentHash, detectChanges } from './contentHash';

/**
 * Acquire a repository from any supported source
 * 
 * Priority order:
 * 1. Local folder (fastest, no network)
 * 2. ZIP archive (fast, no API limits)
 * 3. GitHub API (rate-limited, metadata-only if possible)
 * 4. GitLab API (rate-limited, metadata-only if possible)
 */
export async function acquireRepository(
  input: ResolverInput,
  onProgress?: AcquisitionProgressCallback
): Promise<AcquisitionResult> {
  const resolved = resolveSource(input);
  
  if (!resolved) {
    return {
      success: false,
      repositoryId: null,
      error: 'Could not determine repository source. Provide a valid URL or select files.',
      strategy: 'url-metadata',
      stats: {
        totalFiles: 0,
        filesWithContent: 0,
        totalDirectories: 0,
        totalSizeBytes: 0,
        symbolsExtracted: 0,
        durationMs: 0,
        wasIncremental: false,
        filesSkipped: 0,
      },
    };
  }

  const startTime = Date.now();

  try {
    switch (resolved.strategy) {
      case 'folder-import': {
        const details = resolved.details as FolderSourceDetails;
        return await ingestFolder(
          details.files,
          { rootName: details.name },
          onProgress
        );
      }

      case 'zip-import': {
        const details = resolved.details as ZipSourceDetails;
        return await ingestZip(
          details.file,
          {},
          onProgress
        );
      }

      case 'github-api': {
        // Wrap GitHub ingestion to match our result format
        const progressAdapter = (progress: IngestionProgress) => {
          onProgress?.({
            phase: progress.phase === 'complete' ? 'complete' :
                   progress.phase === 'analysis' ? 'analyzing' :
                   progress.phase === 'architecture' ? 'analyzing' :
                   progress.phase === 'runtime' ? 'analyzing' :
                   progress.phase === 'files' ? 'storing' :
                   'preparing',
            current: progress.current,
            total: progress.total,
            message: progress.message,
          });
        };

        const repoId = await ingestGitHubRepository(
          input.input,
          input.token,
          progressAdapter
        );
        
        return {
          success: true,
          repositoryId: repoId,
          error: null,
          strategy: 'github-api',
          stats: {
            totalFiles: 0, // Stats not available from existing GitHub service
            filesWithContent: 0,
            totalDirectories: 0,
            totalSizeBytes: 0,
            symbolsExtracted: 0,
            durationMs: Date.now() - startTime,
            wasIncremental: false,
            filesSkipped: 0,
          },
        };
      }

      case 'gitlab-api': {
        // Wrap GitLab ingestion to match our result format
        const progressAdapter = (progress: IngestionProgress) => {
          onProgress?.({
            phase: progress.phase === 'complete' ? 'complete' :
                   progress.phase === 'analysis' ? 'analyzing' :
                   progress.phase === 'architecture' ? 'analyzing' :
                   progress.phase === 'runtime' ? 'analyzing' :
                   progress.phase === 'files' ? 'storing' :
                   'preparing',
            current: progress.current,
            total: progress.total,
            message: progress.message,
          });
        };

        const repoId = await ingestGitLabRepository(
          input.input,
          input.token,
          progressAdapter
        );

        return {
          success: true,
          repositoryId: repoId,
          error: null,
          strategy: 'gitlab-api',
          stats: {
            totalFiles: 0,
            filesWithContent: 0,
            totalDirectories: 0,
            totalSizeBytes: 0,
            symbolsExtracted: 0,
            durationMs: Date.now() - startTime,
            wasIncremental: false,
            filesSkipped: 0,
          },
        };
      }

      default:
        return {
          success: false,
          repositoryId: null,
          error: 'Unsupported acquisition strategy',
          strategy: 'url-metadata',
          stats: {
            totalFiles: 0,
            filesWithContent: 0,
            totalDirectories: 0,
            totalSizeBytes: 0,
            symbolsExtracted: 0,
            durationMs: Date.now() - startTime,
            wasIncremental: false,
            filesSkipped: 0,
          },
        };
    }
  } catch (error) {
    return {
      success: false,
      repositoryId: null,
      error: error instanceof Error ? error.message : 'Acquisition failed',
      strategy: resolved.strategy,
      stats: {
        totalFiles: 0,
        filesWithContent: 0,
        totalDirectories: 0,
        totalSizeBytes: 0,
        symbolsExtracted: 0,
        durationMs: Date.now() - startTime,
        wasIncremental: false,
        filesSkipped: 0,
      },
    };
  }
}
