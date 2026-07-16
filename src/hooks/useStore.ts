import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Repository, LLMConfig, QueryResult, RepoFile, Symbol } from '../types';
import type { IngestionProgress } from '../services/github';
import { STORAGE_KEYS } from '../constants';

interface AppState {
  // Database state
  isDbInitialized: boolean;
  setDbInitialized: (initialized: boolean) => void;

  // Repositories
  repositories: Repository[];
  selectedRepository: Repository | null;
  setRepositories: (repos: Repository[]) => void;
  setSelectedRepository: (repo: Repository | null) => void;
  addRepository: (repo: Repository) => void;
  removeRepository: (id: number) => void;

  // Ingestion
  isIngesting: boolean;
  ingestionProgress: IngestionProgress | null;
  setIngesting: (ingesting: boolean) => void;
  setIngestionProgress: (progress: IngestionProgress | null) => void;

  // Files
  files: RepoFile[];
  selectedFile: RepoFile | null;
  setFiles: (files: RepoFile[]) => void;
  setSelectedFile: (file: RepoFile | null) => void;

  // Symbols
  symbols: Symbol[];
  setSymbols: (symbols: Symbol[]) => void;

  // Query
  isQuerying: boolean;
  queryHistory: QueryResult[];
  setQuerying: (querying: boolean) => void;
  addQueryResult: (result: QueryResult) => void;
  clearQueryHistory: () => void;

  // LLM Config
  llmConfig: LLMConfig | null;
  setLLMConfig: (config: LLMConfig | null) => void;

  // UI State
  activePanel: 'repositories' | 'files' | 'symbols' | 'query' | 'settings';
  setActivePanel: (panel: AppState['activePanel']) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Database state
      isDbInitialized: false,
      setDbInitialized: (initialized) => set({ isDbInitialized: initialized }),

      // Repositories
      repositories: [],
      selectedRepository: null,
      setRepositories: (repositories) => set({ repositories }),
      setSelectedRepository: (selectedRepository) => set({ selectedRepository }),
      addRepository: (repo) =>
        set((state) => ({
          repositories: [repo, ...state.repositories.filter((r) => r.id !== repo.id)],
        })),
      removeRepository: (id) =>
        set((state) => ({
          repositories: state.repositories.filter((r) => r.id !== id),
          selectedRepository:
            state.selectedRepository?.id === id ? null : state.selectedRepository,
        })),

      // Ingestion
      isIngesting: false,
      ingestionProgress: null,
      setIngesting: (isIngesting) => set({ isIngesting }),
      setIngestionProgress: (ingestionProgress) => set({ ingestionProgress }),

      // Files
      files: [],
      selectedFile: null,
      setFiles: (files) => set({ files }),
      setSelectedFile: (selectedFile) => set({ selectedFile }),

      // Symbols
      symbols: [],
      setSymbols: (symbols) => set({ symbols }),

      // Query
      isQuerying: false,
      queryHistory: [],
      setQuerying: (isQuerying) => set({ isQuerying }),
      addQueryResult: (result) =>
        set((state) => ({
          queryHistory: [result, ...state.queryHistory].slice(0, 50),
        })),
      clearQueryHistory: () => set({ queryHistory: [] }),

      // LLM Config
      llmConfig: null,
      setLLMConfig: (llmConfig) => set({ llmConfig }),

      // UI State
      activePanel: 'repositories',
      setActivePanel: (activePanel) => set({ activePanel }),
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    }),
    {
      name: STORAGE_KEYS.ZUSTAND_STORE,
      partialize: (state) => ({
        llmConfig: state.llmConfig,
        activePanel: state.activePanel,
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
);
