/**
 * Runtime Database Operations
 * 
 * CRUD operations for runtime profiles and execution sessions.
 */

import { query, execute } from './index';
import type {
  RuntimeProfile,
  CreateRuntimeProfileData,
  ExecutionSession,
  ExecutionLog,
  PortMapping,
  ExecutionStatus,
  RuntimeEnvironment,
  ExecutionMode,
} from '../types/runtime';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseRow = Record<string, any>;

// ============================================================================
// Runtime Profile Operations
// ============================================================================

/**
 * Create or update a runtime profile for a repository
 */
export async function upsertRuntimeProfile(
  data: CreateRuntimeProfileData
): Promise<RuntimeProfile> {
  const result = await query(
    `INSERT INTO runtime_profiles 
     (repository_id, runtime, version, package_manager, lock_file, framework,
      install_command, start_command, build_command, test_command,
      ports, environment_variables, confidence, detected_from)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (repository_id) DO UPDATE SET
       runtime = EXCLUDED.runtime,
       version = EXCLUDED.version,
       package_manager = EXCLUDED.package_manager,
       lock_file = EXCLUDED.lock_file,
       framework = EXCLUDED.framework,
       install_command = EXCLUDED.install_command,
       start_command = EXCLUDED.start_command,
       build_command = EXCLUDED.build_command,
       test_command = EXCLUDED.test_command,
       ports = EXCLUDED.ports,
       environment_variables = EXCLUDED.environment_variables,
       confidence = EXCLUDED.confidence,
       detected_from = EXCLUDED.detected_from,
       updated_at = NOW()
     RETURNING *`,
    [
      data.repositoryId,
      data.runtime,
      data.version,
      data.packageManager,
      data.lockFile,
      data.framework,
      data.installCommand,
      data.startCommand,
      data.buildCommand,
      data.testCommand,
      data.ports,
      JSON.stringify(data.environmentVariables),
      data.confidence,
      data.detectedFrom,
    ]
  );
  return mapRuntimeProfile(result[0]);
}

/**
 * Get runtime profile for a repository
 */
export async function getRuntimeProfile(
  repositoryId: number
): Promise<RuntimeProfile | null> {
  const result = await query(
    'SELECT * FROM runtime_profiles WHERE repository_id = $1',
    [repositoryId]
  );
  return result.length > 0 ? mapRuntimeProfile(result[0]) : null;
}

/**
 * Get runtime profile by ID
 */
export async function getRuntimeProfileById(
  id: number
): Promise<RuntimeProfile | null> {
  const result = await query(
    'SELECT * FROM runtime_profiles WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapRuntimeProfile(result[0]) : null;
}

/**
 * Delete runtime profile for a repository
 */
export async function deleteRuntimeProfile(repositoryId: number): Promise<void> {
  await execute('DELETE FROM runtime_profiles WHERE repository_id = $1', [repositoryId]);
}

/**
 * Get all runtime profiles
 */
export async function getAllRuntimeProfiles(): Promise<RuntimeProfile[]> {
  const result = await query('SELECT * FROM runtime_profiles ORDER BY created_at DESC');
  return result.map(mapRuntimeProfile);
}

// ============================================================================
// Execution Session Operations
// ============================================================================

/**
 * Create a new execution session
 */
export async function createExecutionSession(
  session: Omit<ExecutionSession, 'startedAt' | 'stoppedAt'>
): Promise<ExecutionSession> {
  const result = await query(
    `INSERT INTO execution_sessions 
     (id, repository_id, profile_id, status, status_message, environment, mode,
      container_id, container_image, url, ports)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      session.id,
      session.repositoryId,
      session.profileId,
      session.status,
      session.statusMessage,
      session.environment,
      session.mode,
      session.containerId,
      session.containerImage,
      session.url,
      JSON.stringify(session.ports),
    ]
  );
  return mapExecutionSession(result[0]);
}

/**
 * Update execution session
 */
export async function updateExecutionSession(
  id: string,
  updates: Partial<Omit<ExecutionSession, 'id' | 'repositoryId' | 'profileId' | 'startedAt'>>
): Promise<ExecutionSession | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.statusMessage !== undefined) {
    setClauses.push(`status_message = $${paramIndex++}`);
    values.push(updates.statusMessage);
  }
  if (updates.containerId !== undefined) {
    setClauses.push(`container_id = $${paramIndex++}`);
    values.push(updates.containerId);
  }
  if (updates.containerImage !== undefined) {
    setClauses.push(`container_image = $${paramIndex++}`);
    values.push(updates.containerImage);
  }
  if (updates.url !== undefined) {
    setClauses.push(`url = $${paramIndex++}`);
    values.push(updates.url);
  }
  if (updates.ports !== undefined) {
    setClauses.push(`ports = $${paramIndex++}`);
    values.push(JSON.stringify(updates.ports));
  }
  if (updates.stoppedAt !== undefined) {
    setClauses.push(`stopped_at = $${paramIndex++}`);
    values.push(updates.stoppedAt);
  }

  if (setClauses.length === 0) {
    return getExecutionSession(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE execution_sessions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.length > 0 ? mapExecutionSession(result[0]) : null;
}

/**
 * Get execution session by ID
 */
export async function getExecutionSession(id: string): Promise<ExecutionSession | null> {
  const result = await query(
    'SELECT * FROM execution_sessions WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapExecutionSession(result[0]) : null;
}

/**
 * Get active execution sessions for a repository
 */
export async function getActiveSessionsForRepository(
  repositoryId: number
): Promise<ExecutionSession[]> {
  const result = await query(
    `SELECT * FROM execution_sessions 
     WHERE repository_id = $1 AND status NOT IN ('stopped', 'error')
     ORDER BY started_at DESC`,
    [repositoryId]
  );
  return result.map(mapExecutionSession);
}

/**
 * Get all execution sessions for a repository
 */
export async function getSessionsForRepository(
  repositoryId: number
): Promise<ExecutionSession[]> {
  const result = await query(
    'SELECT * FROM execution_sessions WHERE repository_id = $1 ORDER BY started_at DESC',
    [repositoryId]
  );
  return result.map(mapExecutionSession);
}

/**
 * Get all running sessions
 */
export async function getAllRunningSessions(): Promise<ExecutionSession[]> {
  const result = await query(
    `SELECT * FROM execution_sessions 
     WHERE status = 'running'
     ORDER BY started_at DESC`
  );
  return result.map(mapExecutionSession);
}

/**
 * Delete execution session
 */
export async function deleteExecutionSession(id: string): Promise<void> {
  await execute('DELETE FROM execution_sessions WHERE id = $1', [id]);
}

// ============================================================================
// Execution Log Operations
// ============================================================================

/**
 * Add a log entry
 */
export async function addExecutionLog(
  log: Omit<ExecutionLog, 'id' | 'timestamp'>
): Promise<ExecutionLog> {
  const result = await query(
    `INSERT INTO execution_logs (session_id, level, message, source)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [log.sessionId, log.level, log.message, log.source]
  );
  return mapExecutionLog(result[0]);
}

/**
 * Get logs for a session
 */
export async function getExecutionLogs(
  sessionId: string,
  limit = 100,
  offset = 0
): Promise<ExecutionLog[]> {
  const result = await query(
    `SELECT * FROM execution_logs 
     WHERE session_id = $1 
     ORDER BY timestamp DESC
     LIMIT $2 OFFSET $3`,
    [sessionId, limit, offset]
  );
  return result.map(mapExecutionLog);
}

/**
 * Get logs for a session since a timestamp
 */
export async function getExecutionLogsSince(
  sessionId: string,
  since: Date
): Promise<ExecutionLog[]> {
  const result = await query(
    `SELECT * FROM execution_logs 
     WHERE session_id = $1 AND timestamp > $2
     ORDER BY timestamp ASC`,
    [sessionId, since.toISOString()]
  );
  return result.map(mapExecutionLog);
}

/**
 * Clear logs for a session
 */
export async function clearExecutionLogs(sessionId: string): Promise<void> {
  await execute('DELETE FROM execution_logs WHERE session_id = $1', [sessionId]);
}

// ============================================================================
// Mappers
// ============================================================================

function mapRuntimeProfile(row: DatabaseRow): RuntimeProfile {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    runtime: row.runtime,
    version: row.version as string | null,
    packageManager: row.package_manager,
    lockFile: row.lock_file as string | null,
    framework: row.framework,
    installCommand: row.install_command as string,
    startCommand: row.start_command as string,
    buildCommand: row.build_command as string | null,
    testCommand: row.test_command as string | null,
    ports: (row.ports || []) as number[],
    environmentVariables: (row.environment_variables || {}) as Record<string, string>,
    confidence: row.confidence as number,
    detectedFrom: (row.detected_from || []) as string[],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapExecutionSession(row: DatabaseRow): ExecutionSession {
  return {
    id: row.id as string,
    repositoryId: row.repository_id as number,
    profileId: row.profile_id as number,
    status: row.status as ExecutionStatus,
    statusMessage: row.status_message as string | null,
    environment: row.environment as RuntimeEnvironment,
    mode: row.mode as ExecutionMode,
    containerId: row.container_id as string | null,
    containerImage: row.container_image as string | null,
    url: row.url as string | null,
    ports: (row.ports || []) as PortMapping[],
    startedAt: new Date(row.started_at as string),
    stoppedAt: row.stopped_at ? new Date(row.stopped_at as string) : null,
  };
}

function mapExecutionLog(row: DatabaseRow): ExecutionLog {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    timestamp: new Date(row.timestamp as string),
    level: row.level as ExecutionLog['level'],
    message: row.message as string,
    source: row.source as ExecutionLog['source'],
  };
}
