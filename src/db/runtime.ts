/**
 * Runtime Database Operations
 * 
 * CRUD operations for runtime profiles, execution sessions,
 * runtime containers, execution processes, and container events.
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
  RuntimeContainer,
  CreateRuntimeContainerData,
  ContainerStatus,
  ResourceLimits,
  ExecutionProcess,
  CreateExecutionProcessData,
  ProcessStatus,
  ProcessHealth,
  ContainerEvent,
  CreateContainerEventData,
  ContainerEventType,
  DevicePlatform,
  RuntimeProvider,
  PreviewType,
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
      device_type, provider, preview_type, container_id, container_image, url, ports)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      session.id,
      session.repositoryId,
      session.profileId,
      session.status,
      session.statusMessage,
      session.environment,
      session.mode,
      session.deviceType,
      session.provider,
      session.previewType,
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
  if (updates.deviceType !== undefined) {
    setClauses.push(`device_type = $${paramIndex++}`);
    values.push(updates.deviceType);
  }
  if (updates.provider !== undefined) {
    setClauses.push(`provider = $${paramIndex++}`);
    values.push(updates.provider);
  }
  if (updates.previewType !== undefined) {
    setClauses.push(`preview_type = $${paramIndex++}`);
    values.push(updates.previewType);
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
    deviceType: (row.device_type as DevicePlatform | null) || null,
    provider: (row.provider as RuntimeProvider | null) || null,
    previewType: (row.preview_type as PreviewType | null) || null,
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

function mapRuntimeContainer(row: DatabaseRow): RuntimeContainer {
  return {
    id: row.id as string,
    runtimeImage: row.runtime_image as string,
    runtimeVersion: row.runtime_version as string,
    status: row.status as ContainerStatus,
    createdAt: new Date(row.created_at as string),
    lastUsedAt: new Date(row.last_used_at as string),
    resourceLimits: (row.resource_limits || { cpuLimit: 1, memoryLimit: 512 }) as ResourceLimits,
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

function mapExecutionProcess(row: DatabaseRow): ExecutionProcess {
  return {
    id: row.id as number,
    sessionId: row.session_id as string,
    pid: row.pid as number | null,
    command: row.command as string,
    status: row.status as ProcessStatus,
    health: row.health as ProcessHealth,
    restartCount: row.restart_count as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapContainerEvent(row: DatabaseRow): ContainerEvent {
  return {
    id: row.id as number,
    containerId: row.container_id as string,
    eventType: row.event_type as ContainerEventType,
    message: row.message as string,
    timestamp: new Date(row.timestamp as string),
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}

// ============================================================================
// Runtime Container Operations
// ============================================================================

/**
 * Generate a unique container ID
 */
function generateContainerId(runtimeImage: string, version: string): string {
  const prefix = runtimeImage.split('/').pop()?.split(':')[0] || 'container';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}${version.replace(/\./g, '')}-${timestamp}-${random}`;
}

/**
 * Create a new runtime container
 */
export async function createRuntimeContainer(
  data: CreateRuntimeContainerData
): Promise<RuntimeContainer> {
  const id = generateContainerId(data.runtimeImage, data.runtimeVersion);
  const result = await query(
    `INSERT INTO runtime_containers 
     (id, runtime_image, runtime_version, status, resource_limits, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      id,
      data.runtimeImage,
      data.runtimeVersion,
      data.status,
      JSON.stringify(data.resourceLimits),
      JSON.stringify(data.metadata),
    ]
  );
  return mapRuntimeContainer(result[0]);
}

/**
 * Get runtime container by ID
 */
export async function getRuntimeContainer(
  id: string
): Promise<RuntimeContainer | null> {
  const result = await query(
    'SELECT * FROM runtime_containers WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapRuntimeContainer(result[0]) : null;
}

/**
 * Update runtime container
 */
export async function updateRuntimeContainer(
  id: string,
  updates: Partial<Omit<RuntimeContainer, 'id' | 'createdAt'>>
): Promise<RuntimeContainer | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.lastUsedAt !== undefined) {
    setClauses.push(`last_used_at = $${paramIndex++}`);
    values.push(updates.lastUsedAt);
  }
  if (updates.resourceLimits !== undefined) {
    setClauses.push(`resource_limits = $${paramIndex++}`);
    values.push(JSON.stringify(updates.resourceLimits));
  }
  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metadata));
  }

  if (setClauses.length === 0) {
    return getRuntimeContainer(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE runtime_containers SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.length > 0 ? mapRuntimeContainer(result[0]) : null;
}

/**
 * Get containers by status
 */
export async function getContainersByStatus(
  status: ContainerStatus
): Promise<RuntimeContainer[]> {
  const result = await query(
    'SELECT * FROM runtime_containers WHERE status = $1 ORDER BY last_used_at DESC',
    [status]
  );
  return result.map(mapRuntimeContainer);
}

/**
 * Get available container for a runtime image
 */
export async function getAvailableContainer(
  runtimeImage: string,
  runtimeVersion: string
): Promise<RuntimeContainer | null> {
  const result = await query(
    `SELECT * FROM runtime_containers 
     WHERE runtime_image = $1 AND runtime_version = $2 
       AND status IN ('ready', 'idle')
     ORDER BY last_used_at DESC
     LIMIT 1`,
    [runtimeImage, runtimeVersion]
  );
  return result.length > 0 ? mapRuntimeContainer(result[0]) : null;
}

/**
 * Get all runtime containers
 */
export async function getAllRuntimeContainers(): Promise<RuntimeContainer[]> {
  const result = await query(
    'SELECT * FROM runtime_containers ORDER BY created_at DESC'
  );
  return result.map(mapRuntimeContainer);
}

/**
 * Get idle containers older than specified timestamp
 */
export async function getIdleContainers(
  idleSince: Date
): Promise<RuntimeContainer[]> {
  const result = await query(
    `SELECT * FROM runtime_containers 
     WHERE status = 'idle' AND last_used_at < $1
     ORDER BY last_used_at ASC`,
    [idleSince.toISOString()]
  );
  return result.map(mapRuntimeContainer);
}

/**
 * Delete runtime container
 */
export async function deleteRuntimeContainer(id: string): Promise<void> {
  await execute('DELETE FROM runtime_containers WHERE id = $1', [id]);
}

// ============================================================================
// Execution Process Operations
// ============================================================================

/**
 * Create a new execution process
 */
export async function createExecutionProcess(
  data: CreateExecutionProcessData
): Promise<ExecutionProcess> {
  const result = await query(
    `INSERT INTO execution_processes 
     (session_id, pid, command, status, health, restart_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.sessionId,
      data.pid,
      data.command,
      data.status,
      data.health,
      data.restartCount,
    ]
  );
  return mapExecutionProcess(result[0]);
}

/**
 * Get execution process by ID
 */
export async function getExecutionProcess(
  id: number
): Promise<ExecutionProcess | null> {
  const result = await query(
    'SELECT * FROM execution_processes WHERE id = $1',
    [id]
  );
  return result.length > 0 ? mapExecutionProcess(result[0]) : null;
}

/**
 * Update execution process
 */
export async function updateExecutionProcess(
  id: number,
  updates: Partial<Omit<ExecutionProcess, 'id' | 'sessionId' | 'createdAt'>>
): Promise<ExecutionProcess | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.pid !== undefined) {
    setClauses.push(`pid = $${paramIndex++}`);
    values.push(updates.pid);
  }
  if (updates.command !== undefined) {
    setClauses.push(`command = $${paramIndex++}`);
    values.push(updates.command);
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.health !== undefined) {
    setClauses.push(`health = $${paramIndex++}`);
    values.push(updates.health);
  }
  if (updates.restartCount !== undefined) {
    setClauses.push(`restart_count = $${paramIndex++}`);
    values.push(updates.restartCount);
  }

  values.push(id);
  const result = await query(
    `UPDATE execution_processes SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.length > 0 ? mapExecutionProcess(result[0]) : null;
}

/**
 * Get processes for a session
 */
export async function getProcessesForSession(
  sessionId: string
): Promise<ExecutionProcess[]> {
  const result = await query(
    'SELECT * FROM execution_processes WHERE session_id = $1 ORDER BY created_at DESC',
    [sessionId]
  );
  return result.map(mapExecutionProcess);
}

/**
 * Get active processes for a session
 */
export async function getActiveProcessesForSession(
  sessionId: string
): Promise<ExecutionProcess[]> {
  const result = await query(
    `SELECT * FROM execution_processes 
     WHERE session_id = $1 AND status IN ('running', 'restarting')
     ORDER BY created_at DESC`,
    [sessionId]
  );
  return result.map(mapExecutionProcess);
}

/**
 * Delete execution process
 */
export async function deleteExecutionProcess(id: number): Promise<void> {
  await execute('DELETE FROM execution_processes WHERE id = $1', [id]);
}

// ============================================================================
// Container Event Operations
// ============================================================================

/**
 * Create a new container event
 */
export async function createContainerEvent(
  data: CreateContainerEventData
): Promise<ContainerEvent> {
  const result = await query(
    `INSERT INTO container_events 
     (container_id, event_type, message, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      data.containerId,
      data.eventType,
      data.message,
      JSON.stringify(data.metadata || {}),
    ]
  );
  return mapContainerEvent(result[0]);
}

/**
 * Get container events
 */
export async function getContainerEvents(
  containerId: string,
  limit = 100
): Promise<ContainerEvent[]> {
  const result = await query(
    `SELECT * FROM container_events 
     WHERE container_id = $1 
     ORDER BY timestamp DESC
     LIMIT $2`,
    [containerId, limit]
  );
  return result.map(mapContainerEvent);
}

/**
 * Get container events since a timestamp
 */
export async function getContainerEventsSince(
  containerId: string,
  since: Date
): Promise<ContainerEvent[]> {
  const result = await query(
    `SELECT * FROM container_events 
     WHERE container_id = $1 AND timestamp > $2
     ORDER BY timestamp ASC`,
    [containerId, since.toISOString()]
  );
  return result.map(mapContainerEvent);
}

/**
 * Get recent events by type
 */
export async function getEventsByType(
  eventType: ContainerEventType,
  limit = 50
): Promise<ContainerEvent[]> {
  const result = await query(
    `SELECT * FROM container_events 
     WHERE event_type = $1 
     ORDER BY timestamp DESC
     LIMIT $2`,
    [eventType, limit]
  );
  return result.map(mapContainerEvent);
}

/**
 * Clear old container events
 */
export async function clearOldContainerEvents(
  olderThan: Date
): Promise<void> {
  await execute(
    'DELETE FROM container_events WHERE timestamp < $1',
    [olderThan.toISOString()]
  );
}
