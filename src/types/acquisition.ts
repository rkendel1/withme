/**
 * Repository Acquisition Types
 * 
 * Types for the local-first repository acquisition pipeline that eliminates
 * GitHub API rate limits by supporting multiple acquisition strategies.
 */

// ============================================================================
// Acquisition Strategy Types
// ============================================================================

/** Available acquisition strategies */
export type AcquisitionStrategy =
  | 'github-api'        // GitHub API (metadata only, rate-limited)
  | 'gitlab-api'        // GitLab API (metadata only)
  | 'folder-import'     // Drag & drop local directory
  | 'zip-import'        // ZIP archive import
  | 'url-metadata';     // URL-based metadata fetch only

/** Source type for repository acquisition */
export type AcquisitionSource =
  | 'github'
  | 'gitlab'
  | 'local-folder'
  | 'zip-archive'
  | 'manual';

// ============================================================================
// Repository Cache Types
// ============================================================================

/** Synchronization status for a repository */
export type SyncStatus =
  | 'fresh'           // Repository is up-to-date
  | 'stale'           // Repository needs sync
  | 'syncing'         // Currently synchronizing
  | 'error'           // Sync error occurred
  | 'offline';        // No network, using cached data

/** Cache entry for a repository */
export interface RepositoryCache {
  id: number;
  repositoryId: number;
  
  /** Last known commit SHA (for incremental sync) */
  lastCommitSha: string | null;
  
  /** Last sync timestamp */
  lastSyncedAt: Date;
  
  /** Current sync status */
  syncStatus: SyncStatus;
  
  /** Error message if sync failed */
  syncError: string | null;
  
  /** Acquisition source used */
  acquisitionSource: AcquisitionSource;
  
  /** Whether full content is available locally */
  hasFullContent: boolean;
  
  /** Number of files cached */
  cachedFileCount: number;
  
  /** Total size of cached content in bytes */
  cachedSizeBytes: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/** Data for creating a repository cache entry */
export type CreateRepositoryCacheData = Omit<RepositoryCache, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Content Addressing Types
// ============================================================================

/** Content hash for deduplication and change detection */
export interface ContentHash {
  /** File path */
  path: string;
  
  /** SHA-256 hash of file content */
  sha256: string;
  
  /** Git blob SHA if from git repository */
  gitBlobSha: string | null;
  
  /** File size in bytes */
  sizeBytes: number;
}

/** File change detection result */
export interface FileChangeResult {
  /** Files that are new */
  added: string[];
  
  /** Files that were modified */
  modified: string[];
  
  /** Files that were deleted */
  deleted: string[];
  
  /** Files that are unchanged */
  unchanged: string[];
}

// ============================================================================
// Import Types
// ============================================================================

/** A file entry for import */
export interface ImportFileEntry {
  /** Relative path within repository */
  path: string;
  
  /** File name */
  name: string;
  
  /** File content */
  content: string | null;
  
  /** File size in bytes */
  size: number;
  
  /** Whether this is a directory */
  isDirectory: boolean;
}

/** Result of parsing a folder or archive */
export interface ImportParseResult {
  /** Detected repository name */
  name: string;
  
  /** All file entries */
  files: ImportFileEntry[];
  
  /** All directory paths */
  directories: string[];
  
  /** Total size in bytes */
  totalSize: number;
  
  /** Primary language detected */
  primaryLanguage: string | null;
}

/** Folder import options */
export interface FolderImportOptions {
  /** Root directory name (for display) */
  rootName: string;
  
  /** Patterns to exclude (glob patterns) */
  excludePatterns?: string[];
  
  /** Maximum file size to include content */
  maxFileSize?: number;
  
  /** Skip binary files */
  skipBinaryFiles?: boolean;
}

/** ZIP import options */
export interface ZipImportOptions {
  /** Expected root folder in archive */
  rootFolder?: string;
  
  /** Patterns to exclude (glob patterns) */
  excludePatterns?: string[];
  
  /** Maximum file size to include content */
  maxFileSize?: number;
}

// ============================================================================
// Acquisition Progress Types
// ============================================================================

/** Phases of acquisition */
export type AcquisitionPhase =
  | 'preparing'       // Preparing to acquire
  | 'reading'         // Reading files from source
  | 'parsing'         // Parsing file contents
  | 'storing'         // Storing in database
  | 'analyzing'       // Running analysis (symbols, architecture)
  | 'complete'        // Acquisition complete
  | 'error';          // Error occurred

/** Progress callback data for acquisition */
export interface AcquisitionProgress {
  /** Current phase */
  phase: AcquisitionPhase;
  
  /** Current progress count */
  current: number;
  
  /** Total expected count */
  total: number;
  
  /** Human-readable message */
  message: string;
  
  /** Current file being processed (if applicable) */
  currentFile?: string;
}

/** Callback type for progress updates */
export type AcquisitionProgressCallback = (progress: AcquisitionProgress) => void;

// ============================================================================
// Acquisition Result Types
// ============================================================================

/** Result of a repository acquisition */
export interface AcquisitionResult {
  /** Whether acquisition was successful */
  success: boolean;
  
  /** Repository ID in database */
  repositoryId: number | null;
  
  /** Error message if failed */
  error: string | null;
  
  /** Acquisition strategy used */
  strategy: AcquisitionStrategy;
  
  /** Statistics about the acquisition */
  stats: AcquisitionStats;
}

/** Statistics from an acquisition */
export interface AcquisitionStats {
  /** Total files processed */
  totalFiles: number;
  
  /** Files with content */
  filesWithContent: number;
  
  /** Total directories */
  totalDirectories: number;
  
  /** Total size in bytes */
  totalSizeBytes: number;
  
  /** Symbols extracted */
  symbolsExtracted: number;
  
  /** Time taken in milliseconds */
  durationMs: number;
  
  /** Whether incremental (only changed files processed) */
  wasIncremental: boolean;
  
  /** Files skipped due to unchanged content */
  filesSkipped: number;
}

// ============================================================================
// Repository Resolver Types
// ============================================================================

/** Input for resolving a repository source */
export interface ResolverInput {
  /** URL or path provided by user */
  input: string;
  
  /** Optional files (for folder/ZIP import) */
  files?: FileList | File[];
  
  /** Authentication token (if needed) */
  token?: string;
}

/** Resolved repository source */
export interface ResolvedSource {
  /** Strategy to use for acquisition */
  strategy: AcquisitionStrategy;
  
  /** Source type */
  source: AcquisitionSource;
  
  /** Parsed details based on strategy */
  details: ResolvedSourceDetails;
}

/** Details for different source types */
export type ResolvedSourceDetails =
  | GitHubSourceDetails
  | GitLabSourceDetails
  | FolderSourceDetails
  | ZipSourceDetails;

/** GitHub source details */
export interface GitHubSourceDetails {
  type: 'github';
  owner: string;
  repo: string;
  url: string;
}

/** GitLab source details */
export interface GitLabSourceDetails {
  type: 'gitlab';
  host: string;
  projectPath: string;
  url: string;
}

/** Folder source details */
export interface FolderSourceDetails {
  type: 'folder';
  name: string;
  files: File[];
}

/** ZIP source details */
export interface ZipSourceDetails {
  type: 'zip';
  name: string;
  file: File;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default exclude patterns for folder/ZIP import
 * These patterns are applied during import to skip common non-essential files
 * and directories. Users can override these by providing custom excludePatterns
 * in FolderImportOptions or ZipImportOptions.
 * 
 * Patterns support:
 * - '**' for recursive directory matching
 * - '*' prefix for extension matching
 * - Exact file/folder name matching
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.svn/**',
  '__pycache__/**',
  '*.pyc',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  'dist/**',
  'build/**',
  'target/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
  '.cache/**',
  '*.min.js',
  '*.min.css',
  '*.map',
];

/** Default maximum file size for content (100KB) */
export const DEFAULT_MAX_FILE_SIZE = 100 * 1024;

/** Binary file extensions to skip content */
export const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp', 'bmp', 'tiff',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'webm', 'flv',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'lock', 'sum',
  'wasm',
]);
