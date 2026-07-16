/**
 * Execution Engine Service
 * 
 * Manages the lifecycle of ephemeral containers for running repositories.
 * This service provides an abstraction layer over Docker/Podman containers.
 */

import type {
  ExecutionSession,
  ExecutionStatus,
  ExecutionConfig,
  RuntimeEnvironment,
  ExecutionMode,
  RuntimeProfile,
  PortMapping,
  ExecutionEvent,
  ExecutionEventType,
} from '../../types/runtime';
import { DEFAULT_EXECUTION_CONFIG } from '../../types/runtime';
import {
  createExecutionSession,
  updateExecutionSession,
  getExecutionSession,
  addExecutionLog,
  getActiveSessionsForRepository,
} from '../../db/runtime';

// ============================================================================
// Session ID Generation
// ============================================================================

function generateSessionId(): string {
  // Use crypto.randomUUID for secure, unique session IDs
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `exec-${crypto.randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID
  const timestamp = Date.now().toString(36);
  const randomBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  }
  const random = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `exec-${timestamp}-${random}`;
}

// ============================================================================
// Event Emitter
// ============================================================================

type EventHandler = (event: ExecutionEvent) => void;

const eventHandlers: Set<EventHandler> = new Set();

/**
 * Subscribe to execution events
 */
export function onExecutionEvent(handler: EventHandler): () => void {
  eventHandlers.add(handler);
  return () => eventHandlers.delete(handler);
}

/**
 * Emit an execution event
 */
function emitEvent(
  type: ExecutionEventType,
  sessionId: string,
  data: Record<string, unknown> = {}
): void {
  const event: ExecutionEvent = {
    type,
    sessionId,
    timestamp: new Date(),
    data,
  };
  eventHandlers.forEach(handler => handler(event));
}

// ============================================================================
// Container Runtime Detection
// ============================================================================

export type ContainerRuntime = 'docker' | 'podman' | 'none';

/**
 * Detect available container runtime
 * Note: In browser environment, we simulate container execution
 */
export function detectContainerRuntime(): ContainerRuntime {
  // In browser environment, we can't actually run containers
  // This would be implemented differently for a desktop agent
  return 'none';
}

// ============================================================================
// Execution Session Management
// ============================================================================

/**
 * Create a new execution session for a repository
 */
export async function createSession(
  repositoryId: number,
  profile: RuntimeProfile,
  options: {
    environment?: RuntimeEnvironment;
    mode?: ExecutionMode;
    config?: Partial<ExecutionConfig>;
  } = {}
): Promise<ExecutionSession> {
  const sessionId = generateSessionId();
  const environment = options.environment || 'development';
  const mode = options.mode || detectBestExecutionMode();

  // Check for existing active sessions
  const existingSessions = await getActiveSessionsForRepository(repositoryId);
  if (existingSessions.length > 0) {
    // Stop existing sessions first
    for (const session of existingSessions) {
      await stopSession(session.id);
    }
  }

  const session = await createExecutionSession({
    id: sessionId,
    repositoryId,
    profileId: profile.id,
    status: 'idle',
    statusMessage: null,
    environment,
    mode,
    containerId: null,
    containerImage: null,
    url: null,
    ports: [],
  });

  emitEvent('session.created', sessionId, { repositoryId, profileId: profile.id });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Execution session created for repository ${repositoryId}`,
    source: 'system',
  });

  return session;
}

/**
 * Detect the best execution mode based on environment
 */
function detectBestExecutionMode(): ExecutionMode {
  const runtime = detectContainerRuntime();
  if (runtime !== 'none') {
    return 'local';
  }
  // In browser without container runtime, use browser mode
  return 'browser';
}

/**
 * Start an execution session
 */
export async function startSession(
  sessionId: string,
  profile: RuntimeProfile,
  _config: ExecutionConfig = { ...DEFAULT_EXECUTION_CONFIG }
): Promise<ExecutionSession> {
  let session = await getExecutionSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Update status to creating
  session = await updateExecutionSession(sessionId, {
    status: 'creating',
    statusMessage: 'Creating execution environment...',
  });

  emitEvent('session.started', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Starting execution session...',
    source: 'system',
  });

  try {
    // Simulate container creation (in browser mode)
    if (session!.mode === 'browser') {
      session = await simulateBrowserExecution(sessionId, profile);
    } else if (session!.mode === 'local') {
      session = await executeLocalContainer(sessionId, profile, _config);
    } else {
      throw new Error(`Unsupported execution mode: ${session!.mode}`);
    }

    return session!;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await updateExecutionSession(sessionId, {
      status: 'error',
      statusMessage: errorMessage,
    });

    emitEvent('session.error', sessionId, { error: errorMessage });

    await addExecutionLog({
      sessionId,
      level: 'error',
      message: `Execution failed: ${errorMessage}`,
      source: 'system',
    });

    throw error;
  }
}

/**
 * Simulate browser-based execution (for WASM-compatible projects)
 */
async function simulateBrowserExecution(
  sessionId: string,
  profile: RuntimeProfile
): Promise<ExecutionSession> {
  // Update status to installing
  await updateExecutionSession(sessionId, {
    status: 'installing',
    statusMessage: 'Installing dependencies...',
  });

  emitEvent('dependencies.installing', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Running: ${profile.installCommand}`,
    source: 'system',
  });

  // Simulate installation delay
  await delay(1000);

  emitEvent('dependencies.installed', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Dependencies installed successfully',
    source: 'system',
  });

  // Update status to starting
  await updateExecutionSession(sessionId, {
    status: 'starting',
    statusMessage: 'Starting application...',
  });

  emitEvent('application.starting', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Running: ${profile.startCommand}`,
    source: 'system',
  });

  // Simulate startup delay
  await delay(1500);

  // Generate simulated port mappings
  const ports: PortMapping[] = profile.ports.map((port, index) => ({
    internal: port,
    external: 10000 + index,
    protocol: 'tcp' as const,
  }));

  // Update to running status
  const session = await updateExecutionSession(sessionId, {
    status: 'running',
    statusMessage: 'Application running',
    url: `http://localhost:${ports[0]?.external || 3000}`,
    ports,
  });

  emitEvent('application.ready', sessionId, { 
    url: session?.url,
    ports 
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Application is running at ${session?.url}`,
    source: 'system',
  });

  // Add simulated log entries
  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Server listening on port ${profile.ports[0] || 3000}`,
    source: 'stdout',
  });

  return session!;
}

/**
 * Execute in local container (Docker/Podman)
 */
async function executeLocalContainer(
  sessionId: string,
  profile: RuntimeProfile,
  _config: ExecutionConfig
): Promise<ExecutionSession> {
  const containerImage = getContainerImage(profile);

  // Update status to pulling image
  await updateExecutionSession(sessionId, {
    status: 'creating',
    statusMessage: `Pulling image ${containerImage}...`,
    containerImage,
  });

  emitEvent('container.pulling', sessionId, { image: containerImage });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Pulling container image: ${containerImage}`,
    source: 'system',
  });

  // Note: In a real implementation, this would interact with Docker/Podman API
  // For now, we simulate the container lifecycle

  await delay(2000);

  // Use crypto.randomUUID for unique container IDs
  const containerId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `container-${crypto.randomUUID().substring(0, 12)}`
    : `container-${Date.now().toString(36)}`;

  emitEvent('container.created', sessionId, { containerId });

  await updateExecutionSession(sessionId, {
    containerId,
    status: 'installing',
    statusMessage: 'Installing dependencies...',
  });

  emitEvent('dependencies.installing', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Container created: ${containerId}`,
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Running: ${profile.installCommand}`,
    source: 'system',
  });

  await delay(3000);

  emitEvent('dependencies.installed', sessionId);

  await updateExecutionSession(sessionId, {
    status: 'starting',
    statusMessage: 'Starting application...',
  });

  emitEvent('application.starting', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Running: ${profile.startCommand}`,
    source: 'system',
  });

  await delay(2000);

  // Generate port mappings
  const ports: PortMapping[] = profile.ports.map((port, index) => ({
    internal: port,
    external: 30000 + index,
    protocol: 'tcp' as const,
  }));

  const session = await updateExecutionSession(sessionId, {
    status: 'running',
    statusMessage: 'Application running',
    url: `http://localhost:${ports[0]?.external || 30000}`,
    ports,
  });

  emitEvent('container.started', sessionId, { containerId });
  emitEvent('application.ready', sessionId, { 
    url: session?.url,
    ports 
  });

  for (const port of ports) {
    emitEvent('port.exposed', sessionId, { 
      internal: port.internal, 
      external: port.external 
    });
  }

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Application is running at ${session?.url}`,
    source: 'system',
  });

  return session!;
}

/**
 * Get the appropriate container image for a runtime profile
 * Uses Docker-style naming convention: repolens/runtime:version
 */
function getContainerImage(profile: RuntimeProfile): string {
  const version = profile.version || getDefaultVersion(profile.runtime);
  const formattedVersion = formatVersion(profile.runtime, version);
  
  const imageMap: Record<string, string> = {
    node: `repolens/node:${formattedVersion}`,
    python: `repolens/python:${formattedVersion}`,
    rust: `repolens/rust:${formattedVersion}`,
    go: `repolens/go:${formattedVersion}`,
    java: `repolens/java:${formattedVersion}`,
    dotnet: `repolens/dotnet:${formattedVersion}`,
    ruby: `repolens/ruby:${formattedVersion}`,
    php: `repolens/php:${formattedVersion}`,
  };

  return imageMap[profile.runtime] || 'repolens/node:22';
}

/**
 * Get default version for a runtime
 */
function getDefaultVersion(runtime: string): string {
  const defaults: Record<string, string> = {
    node: '22',
    python: '3.12',
    rust: 'latest',
    go: '1.22',
    java: '21',
    dotnet: '8.0',
    ruby: '3.3',
    php: '8.3',
  };
  return defaults[runtime] || 'latest';
}

/**
 * Format version string for Docker image tag
 * Ensures consistent version formatting (e.g., '312' becomes '3.12' for Python)
 */
function formatVersion(runtime: string, version: string): string {
  // If already contains a dot, return as-is
  if (version.includes('.')) {
    return version;
  }
  
  // Handle Python versions like '312' -> '3.12'
  if (runtime === 'python' && version.length === 3) {
    return `${version[0]}.${version.slice(1)}`;
  }
  
  return version;
}

/**
 * Stop an execution session
 */
export async function stopSession(sessionId: string): Promise<ExecutionSession | null> {
  let session = await getExecutionSession(sessionId);
  if (!session) {
    return null;
  }

  if (session.status === 'stopped' || session.status === 'error') {
    return session;
  }

  // Update status to stopping
  await updateExecutionSession(sessionId, {
    status: 'stopping',
    statusMessage: 'Stopping application...',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Stopping execution session...',
    source: 'system',
  });

  // Simulate shutdown
  await delay(500);

  if (session.containerId) {
    emitEvent('container.stopped', sessionId, { containerId: session.containerId });

    await addExecutionLog({
      sessionId,
      level: 'info',
      message: `Container ${session.containerId} stopped`,
      source: 'system',
    });
  }

  session = await updateExecutionSession(sessionId, {
    status: 'stopped',
    statusMessage: 'Application stopped',
    stoppedAt: new Date(),
  });

  emitEvent('session.stopped', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Execution session stopped',
    source: 'system',
  });

  return session;
}

/**
 * Get session status
 */
export async function getSessionStatus(sessionId: string): Promise<{
  status: ExecutionStatus;
  message: string | null;
  url: string | null;
  ports: PortMapping[];
} | null> {
  const session = await getExecutionSession(sessionId);
  if (!session) {
    return null;
  }

  return {
    status: session.status,
    message: session.statusMessage,
    url: session.url,
    ports: session.ports,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Export Default Config
// ============================================================================

export { DEFAULT_EXECUTION_CONFIG } from '../../types/runtime';
