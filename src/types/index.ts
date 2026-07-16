/** Repository metadata */
export interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  defaultBranch: string;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingestedAt: Date;
}

/** File in a repository */
export interface RepoFile {
  id: number;
  repositoryId: number;
  path: string;
  name: string;
  extension: string | null;
  language: string | null;
  size: number;
  content: string | null;
  sha: string | null;
  createdAt: Date;
}

/** Directory in a repository */
export interface Directory {
  id: number;
  repositoryId: number;
  path: string;
  name: string;
  parentPath: string | null;
}

/** Symbol extracted from code (function, class, variable, etc.) */
export interface Symbol {
  id: number;
  fileId: number;
  repositoryId: number;
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  signature: string | null;
  docstring: string | null;
}

export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'constant'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'import';

/** Import statement */
export interface Import {
  id: number;
  fileId: number;
  repositoryId: number;
  source: string;
  specifiers: string[];
  isDefault: boolean;
  line: number;
}

/** Dependency from package.json, requirements.txt, etc. */
export interface Dependency {
  id: number;
  repositoryId: number;
  name: string;
  version: string | null;
  type: 'production' | 'development' | 'peer' | 'optional';
  ecosystem: string;
}

/** Relationship between symbols */
export interface Relationship {
  id: number;
  repositoryId: number;
  sourceSymbolId: number;
  targetSymbolId: number;
  type: RelationshipType;
}

export type RelationshipType =
  | 'calls'
  | 'imports'
  | 'extends'
  | 'implements'
  | 'uses'
  | 'defines';

/** Document chunk for embeddings */
export interface Chunk {
  id: number;
  repositoryId: number;
  fileId: number | null;
  symbolId: number | null;
  content: string;
  startLine: number | null;
  endLine: number | null;
  embedding: number[] | null;
}

/** User settings */
export interface Settings {
  id: number;
  key: string;
  value: string;
  updatedAt: Date;
}

/** LLM provider configuration */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

/** Query result from the LLM */
export interface QueryResult {
  query: string;
  answer: string;
  sources: QuerySource[];
  sqlUsed?: string;
  timestamp: Date;
}

export interface QuerySource {
  type: 'file' | 'symbol' | 'chunk';
  path?: string;
  name?: string;
  snippet?: string;
  line?: number;
}

/** GitHub API types */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  download_url: string | null;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

/** GitLab API types */
export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  default_branch: string;
  visibility: string;
  created_at: string;
  last_activity_at: string;
}

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'blob' | 'tree';
  path: string;
  mode: string;
}

/** Collection for organizing repositories */
export interface Collection {
  id: number;
  name: string;
  description: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Relationship between collection and repository */
export interface CollectionRepository {
  collectionId: number;
  repositoryId: number;
  addedAt: Date;
}

/** Platform type for ingestion */
export type Platform = 'github' | 'gitlab';

// Re-export architecture types
export * from './architecture';

// Re-export graph types
export * from './graph';

// Re-export runtime types
export * from './runtime';

// Re-export acquisition types
export * from './acquisition';
