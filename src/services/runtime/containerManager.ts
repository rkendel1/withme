/**
 * Container Manager Service
 * 
 * Manages the lifecycle of reusable runtime containers.
 * Handles container creation, reuse, recycling, and cleanup.
 */

import type {
  RuntimeContainer,
  ContainerStatus,
  ResourceLimits,
  ExecutionEvent,
  ExecutionEventType,
  CleanupConfig,
  RuntimeLanguage,
} from '../../types/runtime';
import { DEFAULT_CLEANUP_CONFIG } from '../../types/runtime';
import {
  createRuntimeContainer,
  getRuntimeContainer,
  updateRuntimeContainer,
  getAvailableContainer,
  getAllRuntimeContainers,
  getIdleContainers,
  deleteRuntimeContainer,
  createContainerEvent,
  getContainersByStatus,
} from '../../db/runtime';

// ============================================================================
// Types
// ============================================================================

export interface ContainerCreateOptions {
  runtime: RuntimeLanguage;
  version: string;
  resourceLimits?: Partial<ResourceLimits>;
  metadata?: Record<string, unknown>;
}

export interface ContainerReuseResult {
  container: RuntimeContainer;
  reused: boolean;
}

// ============================================================================
// Event Emitter
// ============================================================================

type ContainerEventHandler = (event: ExecutionEvent) => void;
const containerEventHandlers: Set<ContainerEventHandler> = new Set();

/**
 * Subscribe to container events
 */
export function onContainerEvent(handler: ContainerEventHandler): () => void {
  containerEventHandlers.add(handler);
  return () => containerEventHandlers.delete(handler);
}

/**
 * Emit a container event
 */
function emitContainerEvent(
  type: ExecutionEventType,
  containerId: string,
  data: Record<string, unknown> = {}
): void {
  const event: ExecutionEvent = {
    type,
    sessionId: containerId, // Use containerId as sessionId for container events
    timestamp: new Date(),
    data: { containerId, ...data },
  };
  containerEventHandlers.forEach(handler => handler(event));
}

// ============================================================================
// Container Image Mapping
// ============================================================================

/**
 * Get the container image for a runtime
 */
export function getContainerImageForRuntime(
  runtime: RuntimeLanguage,
  version: string
): string {
  const imageMap: Record<string, string> = {
    node: `repolens/node:${formatVersion(runtime, version)}`,
    python: `repolens/python:${formatVersion(runtime, version)}`,
    rust: `repolens/rust:${formatVersion(runtime, version)}`,
    go: `repolens/go:${formatVersion(runtime, version)}`,
    java: `repolens/java:${formatVersion(runtime, version)}`,
    dotnet: `repolens/dotnet:${formatVersion(runtime, version)}`,
    ruby: `repolens/ruby:${formatVersion(runtime, version)}`,
    php: `repolens/php:${formatVersion(runtime, version)}`,
  };

  return imageMap[runtime] || `repolens/${runtime}:${version}`;
}

/**
 * Format version string for Docker image tag
 */
function formatVersion(runtime: string, version: string): string {
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
 * Get default version for a runtime
 */
export function getDefaultVersion(runtime: RuntimeLanguage): string {
  const defaults: Record<string, string> = {
    node: '22',
    python: '3.12',
    rust: 'latest',
    go: '1.22',
    java: '21',
    dotnet: '8.0',
    ruby: '3.3',
    php: '8.3',
    unknown: 'latest',
  };
  return defaults[runtime] || 'latest';
}

// ============================================================================
// Container Lifecycle Operations
// ============================================================================

/**
 * Create a new container or reuse an existing one
 */
export async function createOrReuseContainer(
  options: ContainerCreateOptions
): Promise<ContainerReuseResult> {
  const { runtime, version, resourceLimits, metadata } = options;
  const runtimeImage = getContainerImageForRuntime(runtime, version);
  const runtimeVersion = version || getDefaultVersion(runtime);

  // Try to find an available container to reuse
  const existingContainer = await getAvailableContainer(runtimeImage, runtimeVersion);
  
  if (existingContainer) {
    // Update the container to mark it as being used
    const updated = await updateRuntimeContainer(existingContainer.id, {
      status: 'running',
      lastUsedAt: new Date(),
    });

    if (updated) {
      await createContainerEvent({
        containerId: updated.id,
        eventType: 'container.started',
        message: `Container reused for ${runtime}:${runtimeVersion}`,
        metadata: { reused: true },
      });

      emitContainerEvent('container.started', updated.id, { 
        reused: true, 
        runtimeImage,
        runtimeVersion,
      });

      return { container: updated, reused: true };
    }
  }

  // Create a new container
  const defaultResourceLimits: ResourceLimits = {
    cpuLimit: 1,
    memoryLimit: 512,
    ...resourceLimits,
  };

  const container = await createRuntimeContainer({
    runtimeImage,
    runtimeVersion,
    status: 'created',
    resourceLimits: defaultResourceLimits,
    metadata: metadata || {},
  });

  await createContainerEvent({
    containerId: container.id,
    eventType: 'container.created',
    message: `Container created for ${runtime}:${runtimeVersion}`,
    metadata: { resourceLimits: defaultResourceLimits },
  });

  emitContainerEvent('container.created', container.id, {
    runtimeImage,
    runtimeVersion,
    resourceLimits: defaultResourceLimits,
  });

  // Simulate container startup (in browser mode)
  await simulateContainerStartup(container.id);

  return { container, reused: false };
}

/**
 * Simulate container startup process
 */
async function simulateContainerStartup(containerId: string): Promise<void> {
  // Update to ready status
  await updateRuntimeContainer(containerId, {
    status: 'ready',
    lastUsedAt: new Date(),
  });

  await createContainerEvent({
    containerId,
    eventType: 'container.started',
    message: 'Container is ready',
  });
}

/**
 * Start a container
 */
export async function startContainer(
  containerId: string
): Promise<RuntimeContainer | null> {
  const container = await getRuntimeContainer(containerId);
  if (!container) {
    return null;
  }

  if (container.status === 'running') {
    return container;
  }

  const updated = await updateRuntimeContainer(containerId, {
    status: 'running',
    lastUsedAt: new Date(),
  });

  if (updated) {
    await createContainerEvent({
      containerId,
      eventType: 'container.started',
      message: 'Container started',
    });

    emitContainerEvent('container.started', containerId);
  }

  return updated;
}

/**
 * Stop a container (preserves for reuse)
 */
export async function stopContainer(
  containerId: string
): Promise<RuntimeContainer | null> {
  const container = await getRuntimeContainer(containerId);
  if (!container) {
    return null;
  }

  if (container.status === 'idle' || container.status === 'destroyed') {
    return container;
  }

  const updated = await updateRuntimeContainer(containerId, {
    status: 'idle',
    lastUsedAt: new Date(),
  });

  if (updated) {
    await createContainerEvent({
      containerId,
      eventType: 'container.stopped',
      message: 'Container stopped and available for reuse',
    });

    emitContainerEvent('container.stopped', containerId);
  }

  return updated;
}

/**
 * Recycle a container (clear workspace, reset environment)
 */
export async function recycleContainer(
  containerId: string
): Promise<RuntimeContainer | null> {
  const container = await getRuntimeContainer(containerId);
  if (!container) {
    return null;
  }

  // Set to recycling status
  await updateRuntimeContainer(containerId, {
    status: 'recycling',
  });

  await createContainerEvent({
    containerId,
    eventType: 'container.recycled',
    message: 'Container recycling started',
  });

  // Simulate cleanup process
  await delay(500);

  // Return to ready state
  const updated = await updateRuntimeContainer(containerId, {
    status: 'ready',
    lastUsedAt: new Date(),
    metadata: {
      ...container.metadata,
      lastRecycledAt: new Date().toISOString(),
      recycleCount: ((container.metadata.recycleCount as number) || 0) + 1,
    },
  });

  if (updated) {
    await createContainerEvent({
      containerId,
      eventType: 'container.recycled',
      message: 'Container recycled and ready for reuse',
    });

    emitContainerEvent('container.recycled', containerId);
  }

  return updated;
}

/**
 * Destroy a container (completely remove)
 */
export async function destroyContainer(
  containerId: string
): Promise<void> {
  const container = await getRuntimeContainer(containerId);
  if (!container) {
    return;
  }

  // Mark as destroyed first
  await updateRuntimeContainer(containerId, {
    status: 'destroyed',
  });

  await createContainerEvent({
    containerId,
    eventType: 'container.destroyed',
    message: 'Container destroyed',
  });

  emitContainerEvent('container.destroyed', containerId);

  // Delete the container record
  await deleteRuntimeContainer(containerId);
}

/**
 * Get container status
 */
export async function getContainerStatus(
  containerId: string
): Promise<{ status: ContainerStatus; container: RuntimeContainer } | null> {
  const container = await getRuntimeContainer(containerId);
  if (!container) {
    return null;
  }

  return {
    status: container.status,
    container,
  };
}

/**
 * Get all containers
 */
export async function listContainers(): Promise<RuntimeContainer[]> {
  return getAllRuntimeContainers();
}

/**
 * Get containers by status
 */
export async function listContainersByStatus(
  status: ContainerStatus
): Promise<RuntimeContainer[]> {
  return getContainersByStatus(status);
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Cleanup idle containers based on configuration
 */
export async function cleanupIdleContainers(
  config: CleanupConfig = DEFAULT_CLEANUP_CONFIG
): Promise<number> {
  const idleSince = new Date(Date.now() - config.idleTimeoutMs);
  const idleContainers = await getIdleContainers(idleSince);

  let cleanedCount = 0;

  for (const container of idleContainers) {
    try {
      switch (config.policy) {
        case 'destroy':
          await destroyContainer(container.id);
          cleanedCount++;
          break;
        case 'recycle':
          await recycleContainer(container.id);
          cleanedCount++;
          break;
        case 'stop':
          // Already stopped/idle, nothing to do
          break;
      }
    } catch (error) {
      console.error(`Failed to cleanup container ${container.id}:`, error);
    }
  }

  return cleanedCount;
}

/**
 * Enforce maximum container limit
 */
export async function enforceContainerLimit(
  maxContainers: number
): Promise<number> {
  const allContainers = await getAllRuntimeContainers();
  
  if (allContainers.length <= maxContainers) {
    return 0;
  }

  // Sort by last used (oldest first)
  const sortedContainers = [...allContainers].sort(
    (a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime()
  );

  const toRemove = sortedContainers.slice(0, allContainers.length - maxContainers);
  let removedCount = 0;

  for (const container of toRemove) {
    // Only remove idle or ready containers
    if (container.status === 'idle' || container.status === 'ready') {
      await destroyContainer(container.id);
      removedCount++;
    }
  }

  return removedCount;
}

// ============================================================================
// Health Check Operations
// ============================================================================

/**
 * Perform health check on a container
 */
export async function healthCheckContainer(
  containerId: string
): Promise<{ healthy: boolean; message: string }> {
  const container = await getRuntimeContainer(containerId);
  
  if (!container) {
    return { healthy: false, message: 'Container not found' };
  }

  if (container.status === 'destroyed') {
    return { healthy: false, message: 'Container is destroyed' };
  }

  if (container.status === 'error') {
    return { healthy: false, message: 'Container is in error state' };
  }

  // In browser simulation, containers are always healthy if not destroyed
  const healthy = ['created', 'ready', 'running', 'idle', 'recycling'].includes(container.status);

  await createContainerEvent({
    containerId,
    eventType: 'container.health_check',
    message: healthy ? 'Health check passed' : 'Health check failed',
    metadata: { healthy, status: container.status },
  });

  emitContainerEvent('container.health', containerId, { healthy });

  return {
    healthy,
    message: healthy ? 'Container is healthy' : `Container status: ${container.status}`,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
