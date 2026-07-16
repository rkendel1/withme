/**
 * ZIP Import Service
 * 
 * Handles importing repositories from ZIP archives, supporting:
 * - GitHub repository downloads
 * - GitLab exports
 * - Any ZIP archive with source code
 */

import type {
  ImportFileEntry,
  ImportParseResult,
  ZipImportOptions,
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
 * Simple ZIP parser using native browser capabilities
 * Uses the Compression Streams API for basic ZIP handling
 */
async function parseZipFile(file: File): Promise<Map<string, ArrayBuffer>> {
  const entries = new Map<string, ArrayBuffer>();
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  
  // ZIP file structure constants
  const LOCAL_FILE_HEADER_SIG = 0x04034b50;
  const CENTRAL_DIR_SIG = 0x02014b50;
  
  let offset = 0;
  
  while (offset < buffer.byteLength - 4) {
    const sig = view.getUint32(offset, true);
    
    if (sig === CENTRAL_DIR_SIG) {
      // Reached central directory, stop
      break;
    }
    
    if (sig !== LOCAL_FILE_HEADER_SIG) {
      // Not a local file header, skip byte
      offset++;
      continue;
    }
    
    // Parse local file header
    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    // uncompressedSize available at offset + 22 but not used
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);
    
    const fileNameStart = offset + 30;
    const fileNameBytes = new Uint8Array(buffer, fileNameStart, fileNameLength);
    const fileName = new TextDecoder().decode(fileNameBytes);
    
    const dataStart = fileNameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;
    
    // Skip directories (end with /)
    if (!fileName.endsWith('/') && compressedSize > 0) {
      const compressedData = buffer.slice(dataStart, dataEnd);
      
      if (compressionMethod === 0) {
        // Stored (no compression)
        entries.set(fileName, compressedData);
      } else if (compressionMethod === 8) {
        // Deflate compression - use DecompressionStream
        try {
          const stream = new Response(compressedData).body;
          if (stream) {
            const decompressed = await new Response(
              stream.pipeThrough(new DecompressionStream('deflate-raw'))
            ).arrayBuffer();
            entries.set(fileName, decompressed);
          }
        } catch {
          // If decompression fails, skip this file
          console.warn(`Failed to decompress: ${fileName}`);
        }
      }
    }
    
    // Move to next entry
    offset = dataEnd;
    
    // Handle data descriptor if present (bit 3 of flags)
    if (flags & 0x08) {
      // Data descriptor follows compressed data
      // Check for optional signature
      if (offset < buffer.byteLength - 4 && view.getUint32(offset, true) === 0x08074b50) {
        offset += 4; // Skip signature
      }
      offset += 12; // Skip crc + sizes
    }
  }
  
  return entries;
}

/**
 * Parse a ZIP archive
 */
export async function parseZipImport(
  file: File,
  options: ZipImportOptions
): Promise<ImportParseResult> {
  const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
  const maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;

  const entries: ImportFileEntry[] = [];
  const directories = new Set<string>();
  let totalSize = 0;
  const languageCounts: Record<string, number> = {};

  // Parse ZIP file
  const zipEntries = await parseZipFile(file);
  
  // Detect root folder (GitHub ZIPs have repo-branch as root)
  let rootFolder = options.rootFolder || '';
  if (!rootFolder && zipEntries.size > 0) {
    const firstPath = zipEntries.keys().next().value;
    if (firstPath) {
      const parts = firstPath.split('/');
      if (parts.length > 1) {
        rootFolder = parts[0];
      }
    }
  }

  for (const [fullPath, data] of zipEntries) {
    // Remove root folder to get repository-relative path
    let repoPath = fullPath;
    if (rootFolder && fullPath.startsWith(rootFolder + '/')) {
      repoPath = fullPath.slice(rootFolder.length + 1);
    }

    // Skip if empty path after stripping root
    if (!repoPath) continue;

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
    const size = data.byteLength;

    // Count languages for primary language detection
    if (language) {
      languageCounts[language] = (languageCounts[language] || 0) + 1;
    }

    // Determine if we should read content as text
    const shouldReadContent =
      size <= maxFileSize &&
      (!extension || !BINARY_EXTENSIONS.has(extension)) &&
      (!extension || !SKIP_CONTENT_EXTENSIONS.has(extension));

    let content: string | null = null;
    if (shouldReadContent) {
      try {
        content = new TextDecoder().decode(data);
        // Check if content looks like binary (has many non-printable chars)
        // Use a loop with early exit for efficiency
        const threshold = content.length * 0.1;
        let nonPrintableCount = 0;
        for (let i = 0; i < content.length; i++) {
          const code = content.charCodeAt(i);
          if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
            nonPrintableCount++;
            if (nonPrintableCount > threshold) {
              content = null; // Too many non-printable chars, likely binary
              break;
            }
          }
        }
      } catch {
        content = null;
      }
    }

    entries.push({
      path: repoPath,
      name: getFileName(repoPath),
      content,
      size,
      isDirectory: false,
    });

    totalSize += size;
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

  // Get name from file or root folder
  const name = rootFolder || file.name.replace(/\.zip$/i, '');

  return {
    name,
    files: entries,
    directories: Array.from(directories),
    totalSize,
    primaryLanguage,
  };
}

/**
 * Import a ZIP archive into the database
 */
export async function ingestZip(
  file: File,
  options: ZipImportOptions,
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
    // Phase 1: Parse ZIP
    onProgress?.({
      phase: 'preparing',
      current: 0,
      total: 1,
      message: `Reading ${file.name}...`,
    });

    const parseResult = await parseZipImport(file, options);
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
      fullName: `archive/${parseResult.name}`,
      description: `Imported from ZIP archive: ${file.name}`,
      url: `file:///${file.name}`,
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
      acquisitionSource: 'zip-archive',
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
      strategy: 'zip-import',
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
      strategy: 'zip-import',
      stats,
    };
  }
}
