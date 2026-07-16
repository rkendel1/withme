import type { GitLabProject, GitLabTreeItem } from '../types';
import {
  createRepository,
  createFile,
  createDirectory,
  createDependency,
  createSymbol,
  createImport,
} from '../db';

const GITLAB_API = 'https://gitlab.com/api/v4';

// File extensions to language mapping (shared with GitHub)
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
 * Parse a GitLab URL to extract the project path
 */
export function parseGitLabUrl(url: string): { host: string; projectPath: string } | null {
  // Handle various GitLab URL formats
  const patterns = [
    // Full URL: https://gitlab.com/group/project or https://gitlab.com/group/subgroup/project
    /^https?:\/\/([^/]+)\/(.+?)(?:\.git)?(?:\/-\/.*)?$/,
    // Path only: group/project or group/subgroup/project
    /^([^/]+\/[^/]+(?:\/[^/]+)*)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      if (match.length === 3) {
        // Full URL match
        return {
          host: match[1],
          projectPath: match[2].replace(/\/-\/.*$/, '').replace(/\.git$/, ''),
        };
      } else if (match.length === 2) {
        // Path only match
        return {
          host: 'gitlab.com',
          projectPath: match[1],
        };
      }
    }
  }

  return null;
}

/**
 * Get the GitLab API base URL
 */
function getApiBaseUrl(host: string): string {
  if (host === 'gitlab.com') {
    return GITLAB_API;
  }
  return `https://${host}/api/v4`;
}

/**
 * Fetch project metadata from GitLab
 */
async function fetchProjectMetadata(
  projectPath: string,
  host: string,
  token?: string
): Promise<GitLabProject> {
  const apiBase = getApiBaseUrl(host);
  const headers: Record<string, string> = {};
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
  }

  const encodedPath = encodeURIComponent(projectPath);
  const response = await fetch(`${apiBase}/projects/${encodedPath}`, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Project ${projectPath} not found`);
    }
    if (response.status === 401) {
      throw new Error('GitLab authentication required. Please add a GitLab token.');
    }
    throw new Error(`Failed to fetch project: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the project tree from GitLab
 */
async function fetchProjectTree(
  projectPath: string,
  branch: string,
  host: string,
  token?: string
): Promise<GitLabTreeItem[]> {
  const apiBase = getApiBaseUrl(host);
  const headers: Record<string, string> = {};
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
  }

  const encodedPath = encodeURIComponent(projectPath);
  const allItems: GitLabTreeItem[] = [];
  let page = 1;
  const perPage = 100;

  // Paginate through all tree items
  while (true) {
    const response = await fetch(
      `${apiBase}/projects/${encodedPath}/repository/tree?ref=${branch}&recursive=true&per_page=${perPage}&page=${page}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch project tree: ${response.statusText}`);
    }

    const items: GitLabTreeItem[] = await response.json();
    allItems.push(...items);

    // Check if there are more pages
    const totalPages = parseInt(response.headers.get('x-total-pages') || '1', 10);
    if (page >= totalPages) {
      break;
    }
    page++;
  }

  return allItems;
}

/**
 * Fetch file content from GitLab
 */
async function fetchFileContent(
  projectPath: string,
  filePath: string,
  branch: string,
  host: string,
  token?: string
): Promise<string | null> {
  const apiBase = getApiBaseUrl(host);
  const headers: Record<string, string> = {};
  if (token) {
    headers['PRIVATE-TOKEN'] = token;
  }

  try {
    const encodedPath = encodeURIComponent(projectPath);
    const encodedFilePath = encodeURIComponent(filePath);
    const response = await fetch(
      `${apiBase}/projects/${encodedPath}/repository/files/${encodedFilePath}/raw?ref=${branch}`,
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
          endLine: i + 1,
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
 */
function extractImports(
  content: string,
  fileId: number,
  repositoryId: number
): Array<Omit<import('../types').Import, 'id'>> {
  const imports: Array<Omit<import('../types').Import, 'id'>> = [];
  const lines = content.split('\n');

  const namedImportRegex = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
  const defaultImportRegex = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;
  const mixedImportRegex = /^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

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
 * Ingest a GitLab project into the local database
 */
export async function ingestGitLabRepository(
  urlOrPath: string,
  token?: string,
  onProgress?: ProgressCallback
): Promise<number> {
  const parsed = parseGitLabUrl(urlOrPath);
  if (!parsed) {
    throw new Error('Invalid GitLab URL or path. Use format: group/project or https://gitlab.com/group/project');
  }

  const { projectPath, host } = parsed;

  // Phase 1: Fetch project metadata
  onProgress?.({
    phase: 'metadata',
    current: 0,
    total: 1,
    message: `Fetching project metadata for ${projectPath}...`,
  });

  const glProject = await fetchProjectMetadata(projectPath, host, token);

  const repository = await createRepository({
    name: glProject.name,
    fullName: glProject.path_with_namespace,
    description: glProject.description,
    url: glProject.web_url,
    defaultBranch: glProject.default_branch,
    language: null, // GitLab doesn't provide a primary language in the same way
  });

  // Phase 2: Fetch project tree
  onProgress?.({
    phase: 'tree',
    current: 0,
    total: 1,
    message: 'Fetching project structure...',
  });

  const tree = await fetchProjectTree(projectPath, glProject.default_branch, host, token);
  const files = tree.filter((item) => item.type === 'blob');
  const directories = tree.filter((item) => item.type === 'tree');

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
      !SKIP_CONTENT_EXTENSIONS.has(extension);

    let content: string | null = null;
    if (shouldFetchContent) {
      content = await fetchFileContent(projectPath, file.path, glProject.default_branch, host, token);
      // Check content size after fetching
      if (content && content.length > MAX_FILE_SIZE) {
        content = null;
      }
    }

    const savedFile = await createFile({
      repositoryId: repository.id,
      path: file.path,
      name: getFileName(file.path),
      extension,
      language,
      size: content ? content.length : 0,
      content,
      sha: file.id,
    });

    // Phase 4: Analysis
    if (content) {
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
