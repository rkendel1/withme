import { PGlite } from '@electric-sql/pglite';
import { SCHEMA_SQL } from './schema';
import { STORAGE_KEYS } from '../constants';
import type {
  Repository,
  RepoFile,
  Directory,
  Symbol,
  Import,
  Dependency,
  Chunk,
  QueryResult,
  Collection,
  CollectionRepository,
} from '../types';

let db: PGlite | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseRow = Record<string, any>;

/**
 * Initialize the PGlite database with IndexedDB persistence
 */
export async function initDatabase(): Promise<PGlite> {
  if (db) return db;

  db = new PGlite(STORAGE_KEYS.DATABASE);
  await db.exec(SCHEMA_SQL);

  return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): PGlite {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Execute a raw SQL query
 */
export async function query<T = DatabaseRow>(sql: string, params?: unknown[]): Promise<T[]> {
  const database = getDatabase();
  const result = await database.query(sql, params);
  return result.rows as T[];
}

/**
 * Execute SQL that doesn't return results
 */
export async function execute(sql: string, params?: unknown[]): Promise<void> {
  const database = getDatabase();
  await database.query(sql, params);
}

// Repository operations
export async function createRepository(
  repo: Omit<Repository, 'id' | 'createdAt' | 'updatedAt' | 'ingestedAt'>
): Promise<Repository> {
  const result = await query(
    `INSERT INTO repositories (name, full_name, description, url, default_branch, language)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (full_name) DO UPDATE SET
       description = EXCLUDED.description,
       url = EXCLUDED.url,
       default_branch = EXCLUDED.default_branch,
       language = EXCLUDED.language,
       updated_at = NOW(),
       ingested_at = NOW()
     RETURNING *`,
    [repo.name, repo.fullName, repo.description, repo.url, repo.defaultBranch, repo.language]
  );
  return mapRepository(result[0]);
}

export async function getRepository(id: number): Promise<Repository | null> {
  const result = await query(
    'SELECT * FROM repositories WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapRepository(result[0]) : null;
}

export async function getRepositoryByFullName(
  fullName: string
): Promise<Repository | null> {
  const result = await query(
    'SELECT * FROM repositories WHERE full_name = $1',
    [fullName]
  );
  return result.length > 0 ? mapRepository(result[0]) : null;
}

export async function getAllRepositories(): Promise<Repository[]> {
  const result = await query(
    'SELECT * FROM repositories ORDER BY ingested_at DESC'
  );
  return result.map(mapRepository);
}

export async function deleteRepository(id: number): Promise<void> {
  await execute('DELETE FROM repositories WHERE id = $1', [id]);
}

// File operations
export async function createFile(
  file: Omit<RepoFile, 'id' | 'createdAt'>
): Promise<RepoFile> {
  const result = await query(
    `INSERT INTO files (repository_id, path, name, extension, language, size, content, sha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (repository_id, path) DO UPDATE SET
       name = EXCLUDED.name,
       extension = EXCLUDED.extension,
       language = EXCLUDED.language,
       size = EXCLUDED.size,
       content = EXCLUDED.content,
       sha = EXCLUDED.sha
     RETURNING *`,
    [
      file.repositoryId,
      file.path,
      file.name,
      file.extension,
      file.language,
      file.size,
      file.content,
      file.sha,
    ]
  );
  return mapFile(result[0]);
}

export async function getFilesByRepository(repositoryId: number): Promise<RepoFile[]> {
  const result = await query(
    'SELECT * FROM files WHERE repository_id = $1 ORDER BY path',
    [repositoryId]
  );
  return result.map(mapFile);
}

export async function getFileByPath(
  repositoryId: number,
  path: string
): Promise<RepoFile | null> {
  const result = await query(
    'SELECT * FROM files WHERE repository_id = $1 AND path = $2',
    [repositoryId, path]
  );
  return result.length > 0 ? mapFile(result[0]) : null;
}

export async function searchFiles(
  repositoryId: number,
  searchTerm: string
): Promise<RepoFile[]> {
  const result = await query(
    `SELECT * FROM files 
     WHERE repository_id = $1 AND (path ILIKE $2 OR name ILIKE $2 OR content ILIKE $2)
     ORDER BY path LIMIT 50`,
    [repositoryId, `%${searchTerm}%`]
  );
  return result.map(mapFile);
}

// Directory operations
export async function createDirectory(
  dir: Omit<Directory, 'id'>
): Promise<Directory> {
  // Try to insert, on conflict query existing
  const result = await query(
    `INSERT INTO directories (repository_id, path, name, parent_path)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (repository_id, path) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [dir.repositoryId, dir.path, dir.name, dir.parentPath]
  );
  return mapDirectory(result[0]);
}

export async function getDirectoriesByRepository(
  repositoryId: number
): Promise<Directory[]> {
  const result = await query(
    'SELECT * FROM directories WHERE repository_id = $1 ORDER BY path',
    [repositoryId]
  );
  return result.map(mapDirectory);
}

// Symbol operations
export async function createSymbol(
  symbol: Omit<Symbol, 'id'>
): Promise<Symbol> {
  const result = await query(
    `INSERT INTO symbols (file_id, repository_id, name, kind, start_line, end_line, signature, docstring)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      symbol.fileId,
      symbol.repositoryId,
      symbol.name,
      symbol.kind,
      symbol.startLine,
      symbol.endLine,
      symbol.signature,
      symbol.docstring,
    ]
  );
  return mapSymbol(result[0]);
}

export async function getSymbolsByRepository(repositoryId: number): Promise<Symbol[]> {
  const result = await query(
    'SELECT * FROM symbols WHERE repository_id = $1 ORDER BY name',
    [repositoryId]
  );
  return result.map(mapSymbol);
}

export async function searchSymbols(
  repositoryId: number,
  searchTerm: string
): Promise<Symbol[]> {
  const result = await query(
    `SELECT * FROM symbols 
     WHERE repository_id = $1 AND name ILIKE $2
     ORDER BY name LIMIT 50`,
    [repositoryId, `%${searchTerm}%`]
  );
  return result.map(mapSymbol);
}

// Import operations
export async function createImport(imp: Omit<Import, 'id'>): Promise<Import> {
  const result = await query(
    `INSERT INTO imports (file_id, repository_id, source, specifiers, is_default, line)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [imp.fileId, imp.repositoryId, imp.source, imp.specifiers, imp.isDefault, imp.line]
  );
  return mapImport(result[0]);
}

export async function getImportsByRepository(repositoryId: number): Promise<Import[]> {
  const result = await query(
    'SELECT * FROM imports WHERE repository_id = $1 ORDER BY source',
    [repositoryId]
  );
  return result.map(mapImport);
}

// Dependency operations
export async function createDependency(
  dep: Omit<Dependency, 'id'>
): Promise<Dependency> {
  const result = await query(
    `INSERT INTO dependencies (repository_id, name, version, type, ecosystem)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repository_id, name, ecosystem) DO UPDATE SET
       version = EXCLUDED.version,
       type = EXCLUDED.type
     RETURNING *`,
    [dep.repositoryId, dep.name, dep.version, dep.type, dep.ecosystem]
  );
  return mapDependency(result[0]);
}

export async function getDependenciesByRepository(
  repositoryId: number
): Promise<Dependency[]> {
  const result = await query(
    'SELECT * FROM dependencies WHERE repository_id = $1 ORDER BY name',
    [repositoryId]
  );
  return result.map(mapDependency);
}


// Chunk operations
export async function createChunk(chunk: Omit<Chunk, 'id'>): Promise<Chunk> {
  const result = await query(
    `INSERT INTO chunks (repository_id, file_id, symbol_id, content, start_line, end_line, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      chunk.repositoryId,
      chunk.fileId,
      chunk.symbolId,
      chunk.content,
      chunk.startLine,
      chunk.endLine,
      chunk.embedding,
    ]
  );
  return mapChunk(result[0]);
}

// Settings operations
export async function getSetting(key: string): Promise<string | null> {
  const result = await query(
    'SELECT * FROM settings WHERE key = $1',
    [key]
  );
  return result.length > 0 ? result[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

// Query history operations
export async function saveQueryHistory(
  repositoryId: number | null,
  result: QueryResult
): Promise<void> {
  await execute(
    `INSERT INTO query_history (repository_id, query, answer, sources, sql_used)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      repositoryId,
      result.query,
      result.answer,
      JSON.stringify(result.sources),
      result.sqlUsed,
    ]
  );
}

// Repository statistics
export async function getRepositoryStats(repositoryId: number): Promise<{
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  languages: string[];
}> {
  const [fileCountResult] = await query(
    'SELECT COUNT(*) as count FROM files WHERE repository_id = $1',
    [repositoryId]
  );
  const [symbolCountResult] = await query(
    'SELECT COUNT(*) as count FROM symbols WHERE repository_id = $1',
    [repositoryId]
  );
  const [dependencyCountResult] = await query(
    'SELECT COUNT(*) as count FROM dependencies WHERE repository_id = $1',
    [repositoryId]
  );
  const languagesResult = await query(
    'SELECT DISTINCT language FROM files WHERE repository_id = $1 AND language IS NOT NULL',
    [repositoryId]
  );

  return {
    fileCount: parseInt(fileCountResult.count),
    symbolCount: parseInt(symbolCountResult.count),
    dependencyCount: parseInt(dependencyCountResult.count),
    languages: languagesResult.map((r: DatabaseRow) => r.language as string),
  };
}

// Helper functions to map database rows to TypeScript types
function mapRepository(row: DatabaseRow): Repository {
  return {
    id: row.id as number,
    name: row.name as string,
    fullName: row.full_name as string,
    description: row.description as string | null,
    url: row.url as string,
    defaultBranch: row.default_branch as string,
    language: row.language as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    ingestedAt: new Date(row.ingested_at as string),
  };
}

function mapFile(row: DatabaseRow): RepoFile {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    path: row.path as string,
    name: row.name as string,
    extension: row.extension as string | null,
    language: row.language as string | null,
    size: row.size as number,
    content: row.content as string | null,
    sha: row.sha as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapDirectory(row: DatabaseRow): Directory {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    path: row.path as string,
    name: row.name as string,
    parentPath: row.parent_path as string | null,
  };
}

function mapSymbol(row: DatabaseRow): Symbol {
  return {
    id: row.id as number,
    fileId: row.file_id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    kind: row.kind as Symbol['kind'],
    startLine: row.start_line as number,
    endLine: row.end_line as number,
    signature: row.signature as string | null,
    docstring: row.docstring as string | null,
  };
}

function mapImport(row: DatabaseRow): Import {
  return {
    id: row.id as number,
    fileId: row.file_id as number,
    repositoryId: row.repository_id as number,
    source: row.source as string,
    specifiers: row.specifiers as string[],
    isDefault: row.is_default as boolean,
    line: row.line as number,
  };
}

function mapDependency(row: DatabaseRow): Dependency {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    version: row.version as string | null,
    type: row.type as Dependency['type'],
    ecosystem: row.ecosystem as string,
  };
}

function mapChunk(row: DatabaseRow): Chunk {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    fileId: row.file_id as number | null,
    symbolId: row.symbol_id as number | null,
    content: row.content as string,
    startLine: row.start_line as number | null,
    endLine: row.end_line as number | null,
    embedding: row.embedding as number[] | null,
  };
}

function mapCollection(row: DatabaseRow): Collection {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string | null,
    color: row.color as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapCollectionRepository(row: DatabaseRow): CollectionRepository {
  return {
    collectionId: row.collection_id as number,
    repositoryId: row.repository_id as number,
    addedAt: new Date(row.added_at as string),
  };
}

// Collection operations
export async function createCollection(
  collection: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Collection> {
  const result = await query(
    `INSERT INTO collections (name, description, color)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [collection.name, collection.description, collection.color]
  );
  return mapCollection(result[0]);
}

export async function updateCollection(
  id: number,
  updates: Partial<Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Collection | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.color !== undefined) {
    setClauses.push(`color = $${paramIndex++}`);
    values.push(updates.color);
  }

  if (setClauses.length === 0) {
    return getCollection(id);
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await query(
    `UPDATE collections SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.length > 0 ? mapCollection(result[0]) : null;
}

export async function getCollection(id: number): Promise<Collection | null> {
  const result = await query('SELECT * FROM collections WHERE id = $1', [id]);
  return result.length > 0 ? mapCollection(result[0]) : null;
}

export async function getCollectionByName(name: string): Promise<Collection | null> {
  const result = await query('SELECT * FROM collections WHERE name = $1', [name]);
  return result.length > 0 ? mapCollection(result[0]) : null;
}

export async function getAllCollections(): Promise<Collection[]> {
  const result = await query('SELECT * FROM collections ORDER BY name');
  return result.map(mapCollection);
}

export async function deleteCollection(id: number): Promise<void> {
  await execute('DELETE FROM collections WHERE id = $1', [id]);
}

export async function addRepositoryToCollection(
  collectionId: number,
  repositoryId: number
): Promise<CollectionRepository> {
  const result = await query(
    `INSERT INTO collection_repositories (collection_id, repository_id)
     VALUES ($1, $2)
     ON CONFLICT (collection_id, repository_id) DO NOTHING
     RETURNING *`,
    [collectionId, repositoryId]
  );
  if (result.length === 0) {
    // Already exists, fetch it
    const existing = await query(
      'SELECT * FROM collection_repositories WHERE collection_id = $1 AND repository_id = $2',
      [collectionId, repositoryId]
    );
    return mapCollectionRepository(existing[0]);
  }
  return mapCollectionRepository(result[0]);
}

export async function removeRepositoryFromCollection(
  collectionId: number,
  repositoryId: number
): Promise<void> {
  await execute(
    'DELETE FROM collection_repositories WHERE collection_id = $1 AND repository_id = $2',
    [collectionId, repositoryId]
  );
}

export async function getRepositoriesByCollection(
  collectionId: number
): Promise<Repository[]> {
  const result = await query(
    `SELECT r.* FROM repositories r
     JOIN collection_repositories cr ON r.id = cr.repository_id
     WHERE cr.collection_id = $1
     ORDER BY cr.added_at DESC`,
    [collectionId]
  );
  return result.map(mapRepository);
}

export async function getCollectionsByRepository(
  repositoryId: number
): Promise<Collection[]> {
  const result = await query(
    `SELECT c.* FROM collections c
     JOIN collection_repositories cr ON c.id = cr.collection_id
     WHERE cr.repository_id = $1
     ORDER BY c.name`,
    [repositoryId]
  );
  return result.map(mapCollection);
}

export async function getCollectionRepositoryCount(collectionId: number): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) as count FROM collection_repositories WHERE collection_id = $1',
    [collectionId]
  );
  const countStr = String(result[0].count);
  const count = parseInt(countStr, 10);
  return isNaN(count) ? 0 : count;
}

// Ensure default collection exists
export async function ensureDefaultCollection(): Promise<Collection> {
  const existing = await getCollectionByName('My Repositories');
  if (existing) {
    return existing;
  }
  return createCollection({
    name: 'My Repositories',
    description: 'Default collection for your repositories',
    color: '#8b5cf6',
  });
}
