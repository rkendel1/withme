/**
 * Folder Import Service
 * 
 * Handles importing repositories from local folders via drag & drop
 * or file picker using the File System Access API.
 */

import type {
  ImportFileEntry,
  ImportParseResult,
  FolderImportOptions,
  AcquisitionProgressCallback,
  AcquisitionResult,
  AcquisitionStats,
} from '../../types/acquisition';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_MAX_FILE_SIZE,
  BINARY_EXTENSIONS,
} from '../../types/acquisition';
import {
  createRepository,
  createFile,
  createDirectory,
  createDependency,
  createSymbol,
  createImport,
  getFilesByRepository,
  getDependenciesByRepository,
} from '../../db';
import { upsertRepositoryCache, upsertContentHashes } from '../../db/acquisition';
import { upsertRuntimeProfile } from '../../db/runtime';
import {
  getExtension,
  getFileName,
  getParentPath,
  getLanguage,
  extractSymbols,
  extractImports,
  extractDependencies,
  SKIP_CONTENT_EXTENSIONS,
} from '../shared';
import { analyzeArchitecture } from '../architecture';
import { detectRuntimeProfile } from '../runtime/runtimeDetector';
import { createContentHash } from './contentHash';

/**
 * Match a path against glob-like patterns
 */
function matchesPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple glob matching
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      if (path.startsWith(prefix + '/') || path === prefix) {
        return true;
      }
    } else if (pattern.startsWith('*.')) {
      const ext = pattern.slice(2);
      if (path.endsWith('.' + ext)) {
        return true;
      }
    } else if (path === pattern || path.includes('/' + pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse files from a folder import
 */
export async function parseFolderImport(
  files: File[],
  options: FolderImportOptions
): Promise<ImportParseResult> {
  const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
  const maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
  const skipBinary = options.skipBinaryFiles !== false;

  const entries: ImportFileEntry[] = [];
  const directories = new Set<string>();
  let totalSize = 0;
  const languageCounts: Record<string, number> = {};

  for (const file of files) {
    // webkitRelativePath is non-standard but widely supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relativePath: string = (file as any).webkitRelativePath || file.name;
    
    // Remove root folder from path to get repository-relative path
    const pathParts = relativePath.split('/');
    const repoPath = pathParts.length > 1 ? pathParts.slice(1).join('/') : relativePath;
    
    // Skip excluded patterns
    if (matchesPattern(repoPath, excludePatterns)) {
      continue;
    }

    // Track directories
    const parentPath = getParentPath(repoPath);
    if (parentPath) {
      const pathAccumulator: string[] = [];
      for (const part of parentPath.split('/')) {
        pathAccumulator.push(part);
        directories.add(pathAccumulator.join('/'));
      }
    }

    const extension = getExtension(repoPath);
    const language = getLanguage(extension);
    
    // Count languages for primary language detection
    if (language) {
      languageCounts[language] = (languageCounts[language] || 0) + 1;
    }

    // Determine if we should read content
    const shouldReadContent =
      file.size <= maxFileSize &&
      (!skipBinary || !extension || !BINARY_EXTENSIONS.has(extension)) &&
      (!extension || !SKIP_CONTENT_EXTENSIONS.has(extension));

    let content: string | null = null;
    if (shouldReadContent) {
      try {
        content = await file.text();
      } catch {
        // Skip files that can't be read as text
        content = null;
      }
    }

    entries.push({
      path: repoPath,
      name: getFileName(repoPath),
      content,
      size: file.size,
      isDirectory: false,
    });

    totalSize += file.size;
  }

  // Determine primary language
  let primaryLanguage: string | null = null;
  let maxCount = 0;
  for (const [lang, count] of Object.entries(languageCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryLanguage = lang;
    }
  }

  return {
    name: options.rootName,
    files: entries,
    directories: Array.from(directories),
    totalSize,
    primaryLanguage,
  };
}

/**
 * Import a folder into the database
 */
export async function ingestFolder(
  files: File[],
  options: FolderImportOptions,
  onProgress?: AcquisitionProgressCallback
): Promise<AcquisitionResult> {
  const startTime = Date.now();
  const stats: AcquisitionStats = {
    totalFiles: 0,
    filesWithContent: 0,
    totalDirectories: 0,
    totalSizeBytes: 0,
    symbolsExtracted: 0,
    durationMs: 0,
    wasIncremental: false,
    filesSkipped: 0,
  };

  try {
    // Phase 1: Parse folder
    onProgress?.({
      phase: 'preparing',
      current: 0,
      total: 1,
      message: `Preparing to import ${options.rootName}...`,
    });

    const parseResult = await parseFolderImport(files, options);
    stats.totalFiles = parseResult.files.length;
    stats.totalDirectories = parseResult.directories.length;
    stats.totalSizeBytes = parseResult.totalSize;

    // Phase 2: Create repository
    onProgress?.({
      phase: 'storing',
      current: 0,
      total: 1,
      message: 'Creating repository record...',
    });

    const repository = await createRepository({
      name: parseResult.name,
      fullName: `local/${parseResult.name}`,
      description: `Imported from local folder`,
      url: `file:///${parseResult.name}`,
      defaultBranch: 'main',
      language: parseResult.primaryLanguage,
    });

    // Create repository cache entry
    await upsertRepositoryCache({
      repositoryId: repository.id,
      lastCommitSha: null,
      lastSyncedAt: new Date(),
      syncStatus: 'fresh',
      syncError: null,
      acquisitionSource: 'local-folder',
      hasFullContent: true,
      cachedFileCount: parseResult.files.length,
      cachedSizeBytes: parseResult.totalSize,
    });

    // Phase 3: Create directories
    onProgress?.({
      phase: 'storing',
      current: 0,
      total: parseResult.directories.length,
      message: 'Creating directory structure...',
    });

    for (const dirPath of parseResult.directories) {
      await createDirectory({
        repositoryId: repository.id,
        path: dirPath,
        name: getFileName(dirPath),
        parentPath: getParentPath(dirPath),
      });
    }

    // Phase 4: Process files
    const contentHashes = [];
    let processedFiles = 0;

    for (const entry of parseResult.files) {
      processedFiles++;
      onProgress?.({
        phase: 'storing',
        current: processedFiles,
        total: parseResult.files.length,
        message: `Processing ${entry.path}`,
        currentFile: entry.path,
      });

      const extension = getExtension(entry.path);
      const language = getLanguage(extension);

      // Create content hash
      const hash = await createContentHash(
        entry.path,
        entry.content,
        entry.size
      );
      contentHashes.push(hash);

      // Save file
      const savedFile = await createFile({
        repositoryId: repository.id,
        path: entry.path,
        name: entry.name,
        extension,
        language,
        size: entry.size,
        content: entry.content,
        sha: hash.sha256,
      });

      if (entry.content) {
        stats.filesWithContent++;

        // Extract symbols and imports for TypeScript/JavaScript
        if (extension && ['ts', 'tsx', 'js', 'jsx'].includes(extension)) {
          const symbols = extractSymbols(entry.content, savedFile.id, repository.id);
          for (const symbol of symbols) {
            await createSymbol(symbol);
            stats.symbolsExtracted++;
          }

          const imports = extractImports(entry.content, savedFile.id, repository.id);
          for (const imp of imports) {
            await createImport(imp);
          }
        }

        // Extract dependencies from package.json
        if (entry.path === 'package.json') {
          const dependencies = extractDependencies(entry.content, repository.id);
          for (const dep of dependencies) {
            await createDependency(dep);
          }
        }
      }
    }

    // Save content hashes
    await upsertContentHashes(repository.id, contentHashes);

    // Phase 5: Architecture analysis
    onProgress?.({
      phase: 'analyzing',
      current: 0,
      total: 1,
      message: 'Analyzing repository architecture...',
    });

    await analyzeArchitecture(repository);

    // Phase 6: Runtime detection
    onProgress?.({
      phase: 'analyzing',
      current: 1,
      total: 2,
      message: 'Detecting runtime environment...',
    });

    const repoFiles = await getFilesByRepository(repository.id);
    const repoDependencies = await getDependenciesByRepository(repository.id);
    const runtimeDetection = detectRuntimeProfile(repoFiles, repoDependencies);

    await upsertRuntimeProfile({
      repositoryId: repository.id,
      runtime: runtimeDetection.runtime,
      version: runtimeDetection.version,
      packageManager: runtimeDetection.packageManager,
      lockFile: runtimeDetection.lockFile,
      framework: runtimeDetection.framework,
      installCommand: runtimeDetection.installCommand,
      startCommand: runtimeDetection.startCommand,
      buildCommand: runtimeDetection.buildCommand,
      testCommand: runtimeDetection.testCommand,
      ports: runtimeDetection.ports,
      environmentVariables: runtimeDetection.environmentVariables,
      confidence: runtimeDetection.confidence,
      detectedFrom: runtimeDetection.detectedFrom,
    });

    // Complete
    stats.durationMs = Date.now() - startTime;

    onProgress?.({
      phase: 'complete',
      current: stats.totalFiles,
      total: stats.totalFiles,
      message: 'Import complete!',
    });

    return {
      success: true,
      repositoryId: repository.id,
      error: null,
      strategy: 'folder-import',
      stats,
    };
  } catch (error) {
    stats.durationMs = Date.now() - startTime;

    onProgress?.({
      phase: 'error',
      current: 0,
      total: 0,
      message: error instanceof Error ? error.message : 'Import failed',
    });

    return {
      success: false,
      repositoryId: null,
      error: error instanceof Error ? error.message : 'Import failed',
      strategy: 'folder-import',
      stats,
    };
  }
}
