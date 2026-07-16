/**
 * Execution Engine Service
 * 
 * Manages the lifecycle of ephemeral containers for running repositories.
 * This service provides an abstraction layer over Docker/Podman containers.
 * 
 * Extended with:
 * - Persistent runtime containers
 * - Container reuse
 * - Preview URL management
 * - Process health monitoring
 * - Device capability detection
 * - Adaptive execution strategies
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
  RuntimeContainer,
  ExecutionProcess,
  DeviceCapabilities,
  ExecutionStrategy,
  RuntimeProvider,
  PreviewType,
} from '../../types/runtime';
import { DEFAULT_EXECUTION_CONFIG, DEFAULT_REMOTE_PREVIEW_URL } from '../../types/runtime';
import {
  createExecutionSession,
  updateExecutionSession,
  getExecutionSession,
  addExecutionLog,
  getActiveSessionsForRepository,
  createExecutionProcess,
  updateExecutionProcess,
  getActiveProcessesForSession,
} from '../../db/runtime';
import {
  createOrReuseContainer,
  stopContainer,
  recycleContainer,
  destroyContainer,
  getContainerStatus,
  listContainers,
  onContainerEvent,
  healthCheckContainer,
  getContainerImageForRuntime,
  getDefaultVersion,
} from './containerManager';
import {
  allocatePorts,
  createPreviewsForSession,
  removePreviewsForSession,
  checkAllPreviewsHealth,
  onPreviewEvent,
  getPrimaryPreviewUrl,
  getPreviewsForSession,
} from './previewManager';
import {
  detectDeviceCapabilities,
  selectExecutionStrategy,
} from './deviceCapabilities';

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
 * Options for creating an execution session
 */
export interface CreateSessionOptions {
  environment?: RuntimeEnvironment;
  mode?: ExecutionMode;
  config?: Partial<ExecutionConfig>;
  /** Override device capabilities (for testing or explicit selection) */
  capabilities?: Partial<DeviceCapabilities>;
  /** Whether a local agent is available */
  localAgentAvailable?: boolean;
  /** Whether container runtime is available */
  containerRuntimeAvailable?: boolean;
  /** Whether remote execution is available */
  remoteExecutionAvailable?: boolean;
}

/**
 * Create a new execution session for a repository
 * 
 * This function now includes device capability detection to select
 * the appropriate execution strategy based on the user's device.
 */
export async function createSession(
  repositoryId: number,
  profile: RuntimeProfile,
  options: CreateSessionOptions = {}
): Promise<ExecutionSession> {
  const sessionId = generateSessionId();
  const environment = options.environment || 'development';
  
  // Detect device capabilities
  const containerRuntime = detectContainerRuntime();
  const capabilities = detectDeviceCapabilities({
    localAgentAvailable: options.localAgentAvailable ?? false,
    containerRuntimeAvailable: options.containerRuntimeAvailable ?? (containerRuntime !== 'none'),
    remoteExecutionAvailable: options.remoteExecutionAvailable ?? true,
  });
  
  // Select execution strategy based on capabilities
  const strategy = selectExecutionStrategy(capabilities);
  
  // Use provided mode or use strategy-selected mode
  const mode = options.mode || strategy.mode;
  
  // Determine provider and preview type based on mode
  let provider: RuntimeProvider;
  let previewType: PreviewType;
  
  switch (mode) {
    case 'local':
      provider = 'local-agent';
      previewType = 'localhost';
      break;
    case 'remote':
      provider = 'remote-sandbox';
      previewType = 'https';
      break;
    case 'browser':
      provider = 'browser-wasm';
      previewType = 'embedded';
      break;
    case 'analysis':
      provider = 'analysis-only';
      previewType = 'none';
      break;
    default:
      provider = strategy.provider;
      previewType = strategy.previewType;
  }

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
    deviceType: capabilities.platform,
    provider,
    previewType,
    containerId: null,
    containerImage: null,
    url: null,
    ports: [],
  });

  emitEvent('session.created', sessionId, { 
    repositoryId, 
    profileId: profile.id,
    deviceType: capabilities.platform,
    provider,
    previewType,
    executionStrategy: strategy.selectionReason,
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Execution session created for repository ${repositoryId} (${capabilities.platform} device, ${provider} provider)`,
    source: 'system',
  });

  return session;
}

/**
 * Detect the best execution mode based on environment and device capabilities
 */
function detectBestExecutionMode(capabilities?: DeviceCapabilities): ExecutionMode {
  if (capabilities) {
    const strategy = selectExecutionStrategy(capabilities);
    return strategy.mode;
  }
  
  // Legacy fallback
  const runtime = detectContainerRuntime();
  if (runtime !== 'none') {
    return 'local';
  }
  // In browser without container runtime, use browser mode
  return 'browser';
}

/**
 * Get device capabilities for the current environment
 */
export function getDeviceCapabilities(options: {
  localAgentAvailable?: boolean;
  containerRuntimeAvailable?: boolean;
  remoteExecutionAvailable?: boolean;
} = {}): DeviceCapabilities {
  const containerRuntime = detectContainerRuntime();
  return detectDeviceCapabilities({
    localAgentAvailable: options.localAgentAvailable ?? false,
    containerRuntimeAvailable: options.containerRuntimeAvailable ?? (containerRuntime !== 'none'),
    remoteExecutionAvailable: options.remoteExecutionAvailable ?? true,
  });
}

/**
 * Get execution strategy for current device
 */
export function getExecutionStrategy(options: {
  localAgentAvailable?: boolean;
  containerRuntimeAvailable?: boolean;
  remoteExecutionAvailable?: boolean;
} = {}): ExecutionStrategy {
  const capabilities = getDeviceCapabilities(options);
  return selectExecutionStrategy(capabilities);
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

  emitEvent('session.started', sessionId, {
    mode: session!.mode,
    provider: session!.provider,
    deviceType: session!.deviceType,
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Starting execution session (mode: ${session!.mode}, provider: ${session!.provider || 'auto'})...`,
    source: 'system',
  });

  try {
    // Execute based on mode
    switch (session!.mode) {
      case 'browser':
        session = await simulateBrowserExecution(sessionId, profile);
        break;
      case 'local':
        session = await executeLocalContainer(sessionId, profile, _config);
        break;
      case 'remote':
        session = await executeRemoteSandbox(sessionId, profile, _config);
        break;
      case 'analysis':
        session = await executeAnalysisMode(sessionId, profile);
        break;
      default:
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
 * Execute in remote cloud sandbox
 * This mode is used for mobile devices and environments without local container runtime
 */
async function executeRemoteSandbox(
  sessionId: string,
  profile: RuntimeProfile,
  _config: ExecutionConfig
): Promise<ExecutionSession> {
  const currentSession = await getExecutionSession(sessionId);
  if (!currentSession) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Generate a unique sandbox ID with robust fallback
  // Note: sandboxId is a short unique identifier for the sandbox instance and preview URL,
  // while sessionId is the internal tracking identifier. The sandbox stores a reference
  // to sessionId via containerId field (sandbox-{sandboxId}).
  let sandboxId: string;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    sandboxId = crypto.randomUUID().substring(0, 8);
  } else {
    // Fallback: combine timestamp with random component for uniqueness
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    sandboxId = `${timestamp}-${random}`;
  }

  // Update status to creating remote sandbox
  await updateExecutionSession(sessionId, {
    status: 'creating',
    statusMessage: 'Provisioning cloud sandbox...',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Connecting to remote execution provider...',
    source: 'system',
  });

  // Simulate remote sandbox provisioning
  await delay(1500);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Cloud sandbox provisioned (ID: ${sandboxId})`,
    source: 'system',
  });

  // Update status to installing
  await updateExecutionSession(sessionId, {
    status: 'installing',
    statusMessage: 'Installing dependencies in sandbox...',
    containerId: `sandbox-${sandboxId}`,
  });

  emitEvent('dependencies.installing', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Running: ${profile.installCommand}`,
    source: 'system',
  });

  await delay(2000);

  emitEvent('dependencies.installed', sessionId);

  // Update status to starting
  await updateExecutionSession(sessionId, {
    status: 'starting',
    statusMessage: 'Starting application in sandbox...',
  });

  emitEvent('application.starting', sessionId);

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Running: ${profile.startCommand}`,
    source: 'system',
  });

  await delay(1500);

  // Generate secure preview URL (HTTPS) using the configured base URL with proxy path
  const previewUrl = `${DEFAULT_REMOTE_PREVIEW_URL}/preview/session-${sandboxId}`;
  
  // No port mappings for remote - access is via HTTPS URL
  const ports: PortMapping[] = profile.ports.map((port) => ({
    internal: port,
    external: 443, // HTTPS
    protocol: 'tcp' as const,
  }));

  const session = await updateExecutionSession(sessionId, {
    status: 'running',
    statusMessage: 'Application running in cloud sandbox',
    url: previewUrl,
    ports,
    previewType: 'https',
  });

  emitEvent('application.ready', sessionId, { 
    url: previewUrl,
    ports,
    provider: 'remote-sandbox',
  });
  
  emitEvent('preview.available', sessionId, {
    url: previewUrl,
    type: 'https',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Application is running at ${previewUrl}`,
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Secure preview URL ready for access from any device',
    source: 'system',
  });

  return session!;
}

/**
 * Execute in analysis-only mode
 * This mode provides repository analysis without actual execution
 */
async function executeAnalysisMode(
  sessionId: string,
  profile: RuntimeProfile
): Promise<ExecutionSession> {
  // Update status - analysis mode doesn't need "creating"
  await updateExecutionSession(sessionId, {
    status: 'starting',
    statusMessage: 'Initializing analysis mode...',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Starting analysis-only mode (no runtime execution)',
    source: 'system',
  });

  await delay(500);

  // In analysis mode, we don't actually run anything
  // The session is immediately "running" in analysis mode
  const session = await updateExecutionSession(sessionId, {
    status: 'running',
    statusMessage: 'Analysis mode active',
    url: null, // No preview URL in analysis mode
    ports: [],
    previewType: 'none',
  });

  emitEvent('application.ready', sessionId, {
    mode: 'analysis',
    capabilities: [
      'repository-analysis',
      'architecture-diagram',
      'ai-questions',
      'code-review',
    ],
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Analysis mode active. Available capabilities:',
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: '  ✓ Repository structure analysis',
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: '  ✓ Architecture diagram generation',
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: '  ✓ AI-powered Q&A',
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: '  ✓ Code review assistance',
    source: 'system',
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Detected runtime: ${profile.runtime} (execution unavailable on this device)`,
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
// Container Lifecycle Management
// ============================================================================

/**
 * Create a runtime container for a profile
 */
export async function createContainer(
  profile: RuntimeProfile,
  options: {
    resourceLimits?: { cpuLimit?: number; memoryLimit?: number };
    reuseExisting?: boolean;
  } = {}
): Promise<{ container: RuntimeContainer; reused: boolean }> {
  const version = profile.version || getDefaultVersion(profile.runtime);
  
  const result = await createOrReuseContainer({
    runtime: profile.runtime,
    version,
    resourceLimits: options.resourceLimits,
    metadata: {
      profileId: profile.id,
      repositoryId: profile.repositoryId,
      framework: profile.framework,
    },
  });

  return result;
}

/**
 * Stop a container (preserves for reuse)
 */
export async function stopContainerForSession(
  sessionId: string
): Promise<RuntimeContainer | null> {
  const session = await getExecutionSession(sessionId);
  if (!session?.containerId) {
    return null;
  }

  return stopContainer(session.containerId);
}

/**
 * Recycle a container (clear workspace, reset environment)
 */
export async function recycleContainerForSession(
  sessionId: string
): Promise<RuntimeContainer | null> {
  const session = await getExecutionSession(sessionId);
  if (!session?.containerId) {
    return null;
  }

  return recycleContainer(session.containerId);
}

/**
 * Destroy a container completely
 */
export async function destroyContainerForSession(
  sessionId: string
): Promise<void> {
  const session = await getExecutionSession(sessionId);
  if (session?.containerId) {
    await destroyContainer(session.containerId);
  }
}

/**
 * Get container status for a session
 */
export async function getContainerStatusForSession(
  sessionId: string
): Promise<{ status: string; container: RuntimeContainer } | null> {
  const session = await getExecutionSession(sessionId);
  if (!session?.containerId) {
    return null;
  }

  return getContainerStatus(session.containerId);
}

/**
 * List all available containers
 */
export async function listAllContainers(): Promise<RuntimeContainer[]> {
  return listContainers();
}

// ============================================================================
// Session with Container Management
// ============================================================================

/**
 * Create a session with a reusable container
 */
export async function createSessionWithContainer(
  repositoryId: number,
  profile: RuntimeProfile,
  options: {
    environment?: RuntimeEnvironment;
    mode?: ExecutionMode;
    command?: string;
    reuseContainer?: boolean;
  } = {}
): Promise<{ session: ExecutionSession; container: RuntimeContainer; reused: boolean }> {
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

  // Create or reuse a container
  const { container, reused } = await createOrReuseContainer({
    runtime: profile.runtime,
    version: profile.version || getDefaultVersion(profile.runtime),
    metadata: {
      profileId: profile.id,
      repositoryId,
    },
  });

  // Allocate ports and create previews
  const ports = allocatePorts(profile.ports);
  const previews = createPreviewsForSession(sessionId, ports);
  const previewUrl = previews.length > 0 ? previews[0].url : null;

  // Create the session with container reference
  const session = await createExecutionSession({
    id: sessionId,
    repositoryId,
    profileId: profile.id,
    status: 'idle',
    statusMessage: null,
    environment,
    mode,
    deviceType: null,
    provider: 'local-agent',
    previewType: 'localhost',
    containerId: container.id,
    containerImage: getContainerImageForRuntime(profile.runtime, profile.version || getDefaultVersion(profile.runtime)),
    url: previewUrl,
    ports,
  });

  emitEvent('session.created', sessionId, { 
    repositoryId, 
    profileId: profile.id,
    containerId: container.id,
    reusedContainer: reused,
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Execution session created with ${reused ? 'reused' : 'new'} container ${container.id}`,
    source: 'system',
  });

  return { session, container, reused };
}

// ============================================================================
// Process Management
// ============================================================================

/**
 * Create and track an execution process
 */
export async function createProcess(
  sessionId: string,
  command: string
): Promise<ExecutionProcess> {
  const process = await createExecutionProcess({
    sessionId,
    pid: null,
    command,
    status: 'created',
    health: 'unknown',
    restartCount: 0,
  });

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: `Process created: ${command}`,
    source: 'system',
  });

  return process;
}

/**
 * Update process status
 */
export async function updateProcessStatus(
  processId: number,
  status: 'running' | 'stopped' | 'crashed' | 'restarting',
  health?: 'healthy' | 'unhealthy' | 'starting' | 'unknown'
): Promise<ExecutionProcess | null> {
  return updateExecutionProcess(processId, { 
    status, 
    ...(health && { health }),
  });
}

/**
 * Get active processes for a session
 */
export async function getActiveProcesses(
  sessionId: string
): Promise<ExecutionProcess[]> {
  return getActiveProcessesForSession(sessionId);
}

// ============================================================================
// Health Monitoring
// ============================================================================

/**
 * Check health of a session (container + previews)
 */
export async function checkSessionHealth(sessionId: string): Promise<{
  containerHealthy: boolean;
  previewsHealthy: boolean;
  details: Record<string, unknown>;
}> {
  const session = await getExecutionSession(sessionId);
  if (!session) {
    return {
      containerHealthy: false,
      previewsHealthy: false,
      details: { error: 'Session not found' },
    };
  }

  // Check container health
  let containerHealthy = false;
  if (session.containerId) {
    const containerHealth = await healthCheckContainer(session.containerId);
    containerHealthy = containerHealth.healthy;
  }

  // Check preview health
  const previewHealth = await checkAllPreviewsHealth(sessionId);
  const previewsHealthy = Array.from(previewHealth.values()).every(h => h);

  emitEvent('process.health', sessionId, {
    containerHealthy,
    previewsHealthy,
  });

  return {
    containerHealthy,
    previewsHealthy,
    details: {
      containerId: session.containerId,
      previewHealth: Object.fromEntries(previewHealth),
    },
  };
}

// ============================================================================
// Event Subscription (Combined)
// ============================================================================

/**
 * Subscribe to all runtime events (execution, container, preview)
 */
export function onAllRuntimeEvents(handler: (event: ExecutionEvent) => void): () => void {
  const unsubExec = onExecutionEvent(handler);
  const unsubContainer = onContainerEvent(handler);
  const unsubPreview = onPreviewEvent(handler);

  return () => {
    unsubExec();
    unsubContainer();
    unsubPreview();
  };
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Clean up a session and optionally its container
 */
export async function cleanupSession(
  sessionId: string,
  options: {
    recycleContainer?: boolean;
    destroyContainer?: boolean;
  } = {}
): Promise<void> {
  const session = await getExecutionSession(sessionId);
  if (!session) {
    return;
  }

  // Stop the session if running
  if (session.status !== 'stopped' && session.status !== 'error') {
    await stopSession(sessionId);
  }

  // Remove previews
  removePreviewsForSession(sessionId);

  // Handle container cleanup
  if (session.containerId) {
    if (options.destroyContainer) {
      await destroyContainer(session.containerId);
    } else if (options.recycleContainer) {
      await recycleContainer(session.containerId);
    } else {
      // Default: stop container (preserve for reuse)
      await stopContainer(session.containerId);
    }
  }

  await addExecutionLog({
    sessionId,
    level: 'info',
    message: 'Session cleaned up',
    source: 'system',
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Export Default Config and Re-exports
// ============================================================================

export { DEFAULT_EXECUTION_CONFIG } from '../../types/runtime';

// Re-export container management functions for external use
export { listContainers } from './containerManager';

// Export preview management functions
export { getPrimaryPreviewUrl, getPreviewsForSession };
