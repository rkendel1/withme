import type { GitLabProject, GitLabTreeItem } from '../types';
import {
  createRepository,
  createFile,
  createDirectory,
  createDependency,
  createSymbol,
  createImport,
} from '../db';
import {
  SKIP_CONTENT_EXTENSIONS,
  MAX_FILE_SIZE,
  getExtension,
  getFileName,
  getParentPath,
  getLanguage,
  extractSymbols,
  extractImports,
  extractDependencies,
} from './shared';

const GITLAB_API = 'https://gitlab.com/api/v4';

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
