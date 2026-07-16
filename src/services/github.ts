import type { GitHubRepository, GitHubTree, GitHubTreeItem } from '../types';
import {
  createRepository,
  createFile,
  createDirectory,
  createDependency,
  createSymbol,
  createImport,
} from '../db';

const GITHUB_API = 'https://api.github.com';

// File extensions to language mapping
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  h: 'C',
  hpp: 'C++',
  cs: 'C#',
  php: 'PHP',
  md: 'Markdown',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Shell',
};

// Extensions to skip content download (binary or large files)
const SKIP_CONTENT_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp',
  'woff', 'woff2', 'ttf', 'eot',
  'pdf', 'zip', 'tar', 'gz',
  'mp3', 'mp4', 'wav', 'avi',
  'exe', 'dll', 'so', 'dylib',
  'lock', 'sum',
]);

// Max file size to download content (100KB)
const MAX_FILE_SIZE = 100 * 1024;

export interface IngestionProgress {
  phase: 'metadata' | 'tree' | 'files' | 'analysis' | 'complete';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: IngestionProgress) => void;

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^/]+)\/([^/]+)/,
    /^([^/]+)\/([^/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }

  return null;
}

/**
 * Fetch repository metadata from GitHub
 */
async function fetchRepoMetadata(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepository> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please add a GitHub token.');
    }
    throw new Error(`Failed to fetch repository: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the repository tree from GitHub
 */
async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<GitHubTree> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch repository tree: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Get file extension from path
 */
function getExtension(path: string): string | null {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return null;
  return path.slice(lastDot + 1).toLowerCase();
}

/**
 * Get file name from path
 */
function getFileName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

/**
 * Get parent directory path
 */
function getParentPath(path: string): string | null {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? null : path.slice(0, lastSlash);
}

/**
 * Determine language from extension
 */
function getLanguage(extension: string | null): string | null {
  if (!extension) return null;
  return EXTENSION_TO_LANGUAGE[extension] || null;
}

/**
 * Extract symbols from TypeScript/JavaScript content
 */
function extractSymbols(
  content: string,
  fileId: number,
  repositoryId: number
): Array<Omit<import('../types').Symbol, 'id'>> {
  const symbols: Array<Omit<import('../types').Symbol, 'id'>> = [];
  const lines = content.split('\n');

  // Simple regex-based extraction (Tree-sitter would be more accurate)
  const patterns = [
    { kind: 'function' as const, regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
    { kind: 'class' as const, regex: /^(?:export\s+)?class\s+(\w+)/ },
    { kind: 'interface' as const, regex: /^(?:export\s+)?interface\s+(\w+)/ },
    { kind: 'type' as const, regex: /^(?:export\s+)?type\s+(\w+)/ },
    { kind: 'constant' as const, regex: /^(?:export\s+)?const\s+(\w+)\s*=/ },
    { kind: 'enum' as const, regex: /^(?:export\s+)?enum\s+(\w+)/ },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const { kind, regex } of patterns) {
      const match = line.match(regex);
      if (match) {
        symbols.push({
          fileId,
          repositoryId,
          name: match[1],
          kind,
          startLine: i + 1,
          endLine: i + 1, // Would need proper parsing for accurate end line
          signature: line,
          docstring: null,
        });
        break;
      }
    }
  }

  return symbols;
}

/**
 * Extract imports from TypeScript/JavaScript content
 * 
 * Note: This simple regex-based extraction handles common import patterns:
 * - Named imports: import { foo, bar } from 'module'
 * - Default imports: import foo from 'module'
 * - Mixed imports: import foo, { bar } from 'module'
 * 
 * Patterns NOT currently handled:
 * - Side-effect imports: import './styles.css'
 * - Namespace imports: import * as foo from 'module'
 * - Dynamic imports: import('module')
 * 
 * For more accurate parsing, consider using a proper AST parser like Tree-sitter.
 */
function extractImports(
  content: string,
  fileId: number,
  repositoryId: number
): Array<Omit<import('../types').Import, 'id'>> {
  const imports: Array<Omit<import('../types').Import, 'id'>> = [];
  const lines = content.split('\n');

  // Pattern for named imports: import { foo, bar } from 'module'
  const namedImportRegex = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
  // Pattern for default imports: import foo from 'module'
  const defaultImportRegex = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;
  // Pattern for mixed imports: import foo, { bar } from 'module'
  const mixedImportRegex = /^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Try mixed imports first (most specific)
    const mixedMatch = line.match(mixedImportRegex);
    if (mixedMatch) {
      const defaultImport = mixedMatch[1];
      const namedImports = mixedMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
      const source = mixedMatch[3];

      imports.push({
        fileId,
        repositoryId,
        source,
        specifiers: [defaultImport, ...namedImports],
        isDefault: true,
        line: i + 1,
      });
      continue;
    }

    // Try named imports
    const namedMatch = line.match(namedImportRegex);
    if (namedMatch) {
      const namedImports = namedMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
      const source = namedMatch[2];

      imports.push({
        fileId,
        repositoryId,
        source,
        specifiers: namedImports,
        isDefault: false,
        line: i + 1,
      });
      continue;
    }

    // Try default imports
    const defaultMatch = line.match(defaultImportRegex);
    if (defaultMatch) {
      imports.push({
        fileId,
        repositoryId,
        source: defaultMatch[2],
        specifiers: [defaultMatch[1]],
        isDefault: true,
        line: i + 1,
      });
    }
  }

  return imports;
}

/**
 * Extract dependencies from package.json
 */
function extractDependencies(
  content: string,
  repositoryId: number
): Array<Omit<import('../types').Dependency, 'id'>> {
  try {
    const pkg = JSON.parse(content);
    const dependencies: Array<Omit<import('../types').Dependency, 'id'>> = [];

    const addDeps = (deps: Record<string, string> | undefined, type: 'production' | 'development' | 'peer' | 'optional') => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        dependencies.push({
          repositoryId,
          name,
          version,
          type,
          ecosystem: 'npm',
        });
      }
    };

    addDeps(pkg.dependencies, 'production');
    addDeps(pkg.devDependencies, 'development');
    addDeps(pkg.peerDependencies, 'peer');

    return dependencies;
  } catch {
    return [];
  }
}

/**
 * Ingest a GitHub repository into the local database
 */
export async function ingestGitHubRepository(
  urlOrPath: string,
  token?: string,
  onProgress?: ProgressCallback
): Promise<number> {
  const parsed = parseGitHubUrl(urlOrPath);
  if (!parsed) {
    throw new Error('Invalid GitHub URL or path. Use format: owner/repo or https://github.com/owner/repo');
  }

  const { owner, repo } = parsed;

  // Phase 1: Fetch repository metadata
  onProgress?.({
    phase: 'metadata',
    current: 0,
    total: 1,
    message: `Fetching repository metadata for ${owner}/${repo}...`,
  });

  const ghRepo = await fetchRepoMetadata(owner, repo, token);

  const repository = await createRepository({
    name: ghRepo.name,
    fullName: ghRepo.full_name,
    description: ghRepo.description,
    url: ghRepo.html_url,
    defaultBranch: ghRepo.default_branch,
    language: ghRepo.language,
  });

  // Phase 2: Fetch repository tree
  onProgress?.({
    phase: 'tree',
    current: 0,
    total: 1,
    message: 'Fetching repository structure...',
  });

  const tree = await fetchRepoTree(owner, repo, ghRepo.default_branch, token);
  const files = tree.tree.filter((item): item is GitHubTreeItem & { type: 'blob' } => item.type === 'blob');
  const directories = tree.tree.filter((item): item is GitHubTreeItem & { type: 'tree' } => item.type === 'tree');

  // Create directories
  for (const dir of directories) {
    await createDirectory({
      repositoryId: repository.id,
      path: dir.path,
      name: getFileName(dir.path),
      parentPath: getParentPath(dir.path),
    });
  }

  // Phase 3: Process files
  const totalFiles = files.length;
  let processedFiles = 0;

  for (const file of files) {
    processedFiles++;
    onProgress?.({
      phase: 'files',
      current: processedFiles,
      total: totalFiles,
      message: `Processing ${file.path}`,
    });

    const extension = getExtension(file.path);
    const language = getLanguage(extension);
    const shouldFetchContent =
      extension &&
      !SKIP_CONTENT_EXTENSIONS.has(extension) &&
      (file.size || 0) < MAX_FILE_SIZE;

    let content: string | null = null;
    if (shouldFetchContent) {
      content = await fetchFileContent(owner, repo, file.path, token);
    }

    const savedFile = await createFile({
      repositoryId: repository.id,
      path: file.path,
      name: getFileName(file.path),
      extension,
      language,
      size: file.size || 0,
      content,
      sha: file.sha,
    });

    // Phase 4: Analysis
    if (content) {
      // Extract symbols and imports for TypeScript/JavaScript files
      if (extension && ['ts', 'tsx', 'js', 'jsx'].includes(extension)) {
        const symbols = extractSymbols(content, savedFile.id, repository.id);
        for (const symbol of symbols) {
          await createSymbol(symbol);
        }

        const imports = extractImports(content, savedFile.id, repository.id);
        for (const imp of imports) {
          await createImport(imp);
        }
      }

      // Extract dependencies from package.json
      if (file.path === 'package.json') {
        const dependencies = extractDependencies(content, repository.id);
        for (const dep of dependencies) {
          await createDependency(dep);
        }
      }
    }
  }

  onProgress?.({
    phase: 'complete',
    current: totalFiles,
    total: totalFiles,
    message: 'Ingestion complete!',
  });

  return repository.id;
}
