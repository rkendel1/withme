import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FolderGit2, Plus, Trash2, ExternalLink, Loader2, Upload, FolderOpen, Archive } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { ingestGitHubRepository, IngestionProgress, parseGitHubUrl } from '../services/github';
import { ingestGitLabRepository, parseGitLabUrl } from '../services/gitlab';
import { acquireRepository } from '../services/acquisition';
import { getAllRepositories, deleteRepository, getRepository, getFilesByRepository, getSymbolsByRepository } from '../db';
import type { Platform, AcquisitionProgress } from '../types';

/**
 * Detect platform from URL and parse repository info
 */
function detectPlatformAndParse(url: string): { platform: Platform; parsed: { owner?: string; repo?: string; projectPath?: string } } | null {
  // Try GitHub first
  const githubParsed = parseGitHubUrl(url);
  if (githubParsed) {
    return { platform: 'github', parsed: githubParsed };
  }

  // Try GitLab
  const gitlabParsed = parseGitLabUrl(url);
  if (gitlabParsed) {
    return { platform: 'gitlab', parsed: { projectPath: gitlabParsed.projectPath } };
  }

  return null;
}

export function RepositoryList() {
  const {
    repositories,
    selectedRepository,
    setRepositories,
    setSelectedRepository,
    addRepository,
    removeRepository,
    isIngesting,
    ingestionProgress,
    setIngesting,
    setIngestionProgress,
    setFiles,
    setSymbols,
    setActivePanel,
  } = useStore();

  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const hasProcessedUrlParams = useRef(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleAcquisitionComplete = useCallback(async (repoId: number) => {
    const repo = await getRepository(repoId);
    if (repo) {
      addRepository(repo);
      setSelectedRepository(repo);
      setRepoUrl('');

      // Load files and symbols
      const files = await getFilesByRepository(repoId);
      const symbols = await getSymbolsByRepository(repoId);
      setFiles(files);
      setSymbols(symbols);
      setActivePanel('files');
    }
  }, [addRepository, setSelectedRepository, setFiles, setSymbols, setActivePanel]);

  const handleIngest = useCallback(async (urlToIngest?: string) => {
    const targetUrl = urlToIngest || repoUrl.trim();
    if (!targetUrl) return;

    setError(null);
    setIngesting(true);
    setIngestionProgress(null);

    try {
      const progressCallback = (progress: IngestionProgress) => {
        setIngestionProgress(progress);
      };

      // Detect platform and ingest accordingly
      const detected = detectPlatformAndParse(targetUrl);
      let repoId: number;

      if (detected?.platform === 'gitlab') {
        repoId = await ingestGitLabRepository(targetUrl, undefined, progressCallback);
      } else {
        // Default to GitHub
        repoId = await ingestGitHubRepository(targetUrl, undefined, progressCallback);
      }

      await handleAcquisitionComplete(repoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest repository');
    } finally {
      setIngesting(false);
      setIngestionProgress(null);
    }
  }, [repoUrl, setIngesting, setIngestionProgress, handleAcquisitionComplete]);

  const handleFolderImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIngesting(true);
    setIngestionProgress(null);
    setShowImportOptions(false);

    try {
      const progressCallback = (progress: AcquisitionProgress) => {
        setIngestionProgress({
          phase: progress.phase === 'complete' ? 'complete' :
                 progress.phase === 'analyzing' ? 'analysis' :
                 progress.phase === 'storing' ? 'files' :
                 'metadata',
          current: progress.current,
          total: progress.total,
          message: progress.message,
        });
      };

      const result = await acquireRepository(
        { input: '', files: Array.from(files) },
        progressCallback
      );

      if (result.success && result.repositoryId) {
        await handleAcquisitionComplete(result.repositoryId);
      } else {
        setError(result.error || 'Failed to import folder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import folder');
    } finally {
      setIngesting(false);
      setIngestionProgress(null);
    }
  }, [setIngesting, setIngestionProgress, handleAcquisitionComplete]);

  const handleZipImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIngesting(true);
    setIngestionProgress(null);
    setShowImportOptions(false);

    try {
      const progressCallback = (progress: AcquisitionProgress) => {
        setIngestionProgress({
          phase: progress.phase === 'complete' ? 'complete' :
                 progress.phase === 'analyzing' ? 'analysis' :
                 progress.phase === 'storing' ? 'files' :
                 'metadata',
          current: progress.current,
          total: progress.total,
          message: progress.message,
        });
      };

      const result = await acquireRepository(
        { input: '', files: Array.from(files) },
        progressCallback
      );

      if (result.success && result.repositoryId) {
        await handleAcquisitionComplete(result.repositoryId);
      } else {
        setError(result.error || 'Failed to import ZIP archive');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import ZIP archive');
    } finally {
      setIngesting(false);
      setIngestionProgress(null);
    }
  }, [setIngesting, setIngestionProgress, handleAcquisitionComplete]);

  // Handle URL parameters for userscript integration (one-time on mount)
  useEffect(() => {
    // Only process URL params once
    if (hasProcessedUrlParams.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const ingestUrl = params.get('ingest');
    
    if (ingestUrl && !isIngesting) {
      hasProcessedUrlParams.current = true;
      
      // Clear the URL parameters to prevent re-triggering
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Trigger ingestion
      handleIngest(ingestUrl);
    }
  }, [handleIngest, isIngesting]);

  const handleSelectRepository = useCallback(async (repo: typeof repositories[0]) => {
    setSelectedRepository(repo);

    // Load files and symbols
    const files = await getFilesByRepository(repo.id);
    const symbols = await getSymbolsByRepository(repo.id);
    setFiles(files);
    setSymbols(symbols);
  }, [setSelectedRepository, setFiles, setSymbols]);

  const handleDeleteRepository = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this repository?')) return;

    await deleteRepository(id);
    removeRepository(id);

    // Refresh list
    const repos = await getAllRepositories();
    setRepositories(repos);
  }, [removeRepository, setRepositories]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isIngesting) {
      handleIngest();
    }
  }, [handleIngest, isIngesting]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FolderGit2 className="w-5 h-5" />
          Repositories
        </h2>

        <div className="flex gap-2">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="GitHub or GitLab URL"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isIngesting}
          />
          <button
            onClick={() => handleIngest()}
            disabled={isIngesting || !repoUrl.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isIngesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowImportOptions(!showImportOptions)}
              disabled={isIngesting}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
                         rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 
                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Import from folder or ZIP"
            >
              <Upload className="w-4 h-4" />
            </button>
            {showImportOptions && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg 
                              border border-gray-200 dark:border-gray-700 z-10">
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 
                             flex items-center gap-2 rounded-t-lg"
                >
                  <FolderOpen className="w-4 h-4" />
                  Import Folder
                </button>
                <button
                  onClick={() => zipInputRef.current?.click()}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 
                             flex items-center gap-2 rounded-b-lg"
                >
                  <Archive className="w-4 h-4" />
                  Import ZIP
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => handleFolderImport(e.target.files)}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => handleZipImport(e.target.files)}
        />

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {ingestionProgress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>{ingestionProgress.message}</span>
              <span>
                {ingestionProgress.current} / {ingestionProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(ingestionProgress.current / Math.max(ingestionProgress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {repositories.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FolderGit2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No repositories yet</p>
            <p className="text-sm mt-1">
              Add a repository via URL, or import a local folder or ZIP archive
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {repositories.map((repo) => (
              <li
                key={repo.id}
                onClick={() => handleSelectRepository(repo)}
                className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 
                           transition-colors ${
                             selectedRepository?.id === repo.id
                               ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                               : ''
                           }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{repo.fullName}</h3>
                    {repo.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {repo.language && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                          {repo.language}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(repo.ingestedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={(e) => handleDeleteRepository(repo.id, e)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
