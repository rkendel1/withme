/**
 * Repository Resolver
 * 
 * Resolves user input (URL, files, folders) into a specific acquisition strategy.
 */

import type {
  ResolverInput,
  ResolvedSource,
  GitHubSourceDetails,
  GitLabSourceDetails,
  FolderSourceDetails,
  ZipSourceDetails,
} from '../../types/acquisition';
import { parseGitHubUrl } from '../github';
import { parseGitLabUrl } from '../gitlab';

/**
 * Resolve the acquisition source from user input
 */
export function resolveSource(input: ResolverInput): ResolvedSource | null {
  // Check if files were provided (folder or ZIP import)
  if (input.files && input.files.length > 0) {
    const fileList = Array.isArray(input.files) ? input.files : Array.from(input.files);
    
    // Check if it's a ZIP file
    if (fileList.length === 1 && isZipFile(fileList[0])) {
      return {
        strategy: 'zip-import',
        source: 'zip-archive',
        details: {
          type: 'zip',
          name: getZipName(fileList[0]),
          file: fileList[0],
        } as ZipSourceDetails,
      };
    }
    
    // Otherwise, it's a folder import
    return {
      strategy: 'folder-import',
      source: 'local-folder',
      details: {
        type: 'folder',
        name: getFolderName(fileList),
        files: fileList,
      } as FolderSourceDetails,
    };
  }
  
  // Try to resolve as URL
  const urlInput = input.input.trim();
  if (!urlInput) return null;
  
  // Try GitHub
  const githubParsed = parseGitHubUrl(urlInput);
  if (githubParsed) {
    return {
      strategy: 'github-api',
      source: 'github',
      details: {
        type: 'github',
        owner: githubParsed.owner,
        repo: githubParsed.repo,
        url: `https://github.com/${githubParsed.owner}/${githubParsed.repo}`,
      } as GitHubSourceDetails,
    };
  }
  
  // Try GitLab
  const gitlabParsed = parseGitLabUrl(urlInput);
  if (gitlabParsed) {
    return {
      strategy: 'gitlab-api',
      source: 'gitlab',
      details: {
        type: 'gitlab',
        host: gitlabParsed.host,
        projectPath: gitlabParsed.projectPath,
        url: `https://${gitlabParsed.host}/${gitlabParsed.projectPath}`,
      } as GitLabSourceDetails,
    };
  }
  
  return null;
}

/**
 * Check if file is a ZIP archive
 */
function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.zip') || file.type === 'application/zip';
}

/**
 * Extract repository name from ZIP file
 */
function getZipName(file: File): string {
  const name = file.name;
  // Remove .zip extension
  const baseName = name.replace(/\.zip$/i, '');
  // Handle GitHub-style names: repo-main.zip, repo-master.zip
  return baseName.replace(/-(?:main|master|develop|dev)$/, '');
}

/**
 * Get folder name from file list
 */
function getFolderName(files: File[]): string {
  if (files.length === 0) return 'Unknown';
  
  // Try to find common root from webkitRelativePath
  const firstFile = files[0];
  // webkitRelativePath is non-standard but widely supported
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relativePath: string | undefined = (firstFile as any).webkitRelativePath;
  
  if (relativePath) {
    const parts = relativePath.split('/');
    if (parts.length > 1) {
      return parts[0];
    }
  }
  
  // Fall back to first file name
  return firstFile.name.split('.')[0] || 'Repository';
}

/**
 * Detect if input looks like a URL
 */
export function isUrlInput(input: string): boolean {
  const trimmed = input.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('github.com') ||
    trimmed.includes('gitlab.com') ||
    /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(trimmed) // owner/repo format
  );
}
