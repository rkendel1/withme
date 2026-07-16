import type { GitHubRepository, GitHubTree, GitHubTreeItem } from '../types';
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
import { analyzeArchitecture } from './architecture';

const GITHUB_API = 'https://api.github.com';

export interface IngestionProgress {
  phase: 'metadata' | 'tree' | 'files' | 'analysis' | 'architecture' | 'complete';
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

  // Phase 5: Architecture Analysis
  onProgress?.({
    phase: 'architecture',
    current: 0,
    total: 1,
    message: 'Analyzing repository architecture...',
  });

  // Run architecture analysis - it loads files and dependencies from the database
  await analyzeArchitecture(repository);

  onProgress?.({
    phase: 'architecture',
    current: 1,
    total: 1,
    message: 'Architecture analysis complete!',
  });

  onProgress?.({
    phase: 'complete',
    current: totalFiles,
    total: totalFiles,
    message: 'Ingestion complete!',
  });

  return repository.id;
}
