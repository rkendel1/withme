/** Storage keys used throughout the application */
export const STORAGE_KEYS = {
  /** Key for LLM configuration in localStorage */
  LLM_CONFIG: 'repolens_llm_config',
  /** Key for Zustand persisted state */
  ZUSTAND_STORE: 'repolens-storage',
  /** Key for PGlite database */
  DATABASE: 'idb://repolens',
} as const;
