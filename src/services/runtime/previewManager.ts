/**
 * Preview Manager Service
 * 
 * Manages preview URLs for running applications.
 * Handles port detection, URL assignment, and availability tracking.
 */

import type {
  PreviewInfo,
  PreviewConfig,
  PortMapping,
  ExecutionEvent,
  ExecutionEventType,
} from '../../types/runtime';
import { DEFAULT_PREVIEW_CONFIG } from '../../types/runtime';

// ============================================================================
// Types
// ============================================================================

export interface PreviewSession {
  sessionId: string;
  previews: PreviewInfo[];
  createdAt: Date;
  lastCheckedAt: Date;
}

// ============================================================================
// In-memory Preview Store
// ============================================================================

const previewSessions: Map<string, PreviewSession> = new Map();
const usedPorts: Set<number> = new Set();

// ============================================================================
// Event Emitter
// ============================================================================

type PreviewEventHandler = (event: ExecutionEvent) => void;
const previewEventHandlers: Set<PreviewEventHandler> = new Set();

/**
 * Subscribe to preview events
 */
export function onPreviewEvent(handler: PreviewEventHandler): () => void {
  previewEventHandlers.add(handler);
  return () => previewEventHandlers.delete(handler);
}

/**
 * Emit a preview event
 */
function emitPreviewEvent(
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
  previewEventHandlers.forEach(handler => handler(event));
}

// ============================================================================
// Port Management
// ============================================================================

/**
 * Allocate external ports for internal ports
 */
export function allocatePorts(
  internalPorts: number[],
  config: PreviewConfig = DEFAULT_PREVIEW_CONFIG
): PortMapping[] {
  const mappings: PortMapping[] = [];
  
  for (const internal of internalPorts) {
    const external = findAvailablePort(config);
    usedPorts.add(external);
    
    mappings.push({
      internal,
      external,
      protocol: 'tcp',
    });
  }
  
  return mappings;
}

/**
 * Find an available external port
 * Throws error if all ports in range are exhausted
 */
function findAvailablePort(config: PreviewConfig): number {
  let port = config.portRangeStart;
  
  while (port <= config.portRangeEnd) {
    if (!usedPorts.has(port)) {
      return port;
    }
    port++;
  }
  
  // All ports exhausted - throw error
  throw new Error(
    `All ports in range ${config.portRangeStart}-${config.portRangeEnd} are exhausted. ` +
    `Release some ports before allocating new ones.`
  );
}

/**
 * Release allocated ports
 */
export function releasePorts(portMappings: PortMapping[]): void {
  for (const mapping of portMappings) {
    usedPorts.delete(mapping.external);
  }
}

// ============================================================================
// Preview URL Management
// ============================================================================

/**
 * Create preview URLs for a session
 */
export function createPreviewsForSession(
  sessionId: string,
  portMappings: PortMapping[],
  config: PreviewConfig = DEFAULT_PREVIEW_CONFIG
): PreviewInfo[] {
  const previews: PreviewInfo[] = portMappings.map(mapping => ({
    url: `${config.baseUrl}:${mapping.external}`,
    port: mapping.external,
    protocol: 'http' as const,
    isAvailable: true,
    lastCheckedAt: new Date(),
  }));

  const session: PreviewSession = {
    sessionId,
    previews,
    createdAt: new Date(),
    lastCheckedAt: new Date(),
  };

  previewSessions.set(sessionId, session);

  for (const preview of previews) {
    emitPreviewEvent('preview.available', sessionId, {
      url: preview.url,
      port: preview.port,
    });
  }

  return previews;
}

/**
 * Get preview information for a session
 */
export function getPreviewsForSession(sessionId: string): PreviewInfo[] {
  const session = previewSessions.get(sessionId);
  return session?.previews || [];
}

/**
 * Get the primary preview URL for a session
 */
export function getPrimaryPreviewUrl(sessionId: string): string | null {
  const session = previewSessions.get(sessionId);
  if (!session || session.previews.length === 0) {
    return null;
  }
  return session.previews[0].url;
}

/**
 * Update preview availability
 */
export function updatePreviewAvailability(
  sessionId: string,
  port: number,
  isAvailable: boolean
): void {
  const session = previewSessions.get(sessionId);
  if (!session) {
    return;
  }

  const preview = session.previews.find(p => p.port === port);
  if (preview) {
    const wasAvailable = preview.isAvailable;
    preview.isAvailable = isAvailable;
    preview.lastCheckedAt = new Date();
    session.lastCheckedAt = new Date();

    if (wasAvailable && !isAvailable) {
      emitPreviewEvent('preview.unavailable', sessionId, {
        url: preview.url,
        port: preview.port,
      });
    } else if (!wasAvailable && isAvailable) {
      emitPreviewEvent('preview.available', sessionId, {
        url: preview.url,
        port: preview.port,
      });
    }
  }
}

/**
 * Remove previews for a session
 */
export function removePreviewsForSession(sessionId: string): void {
  const session = previewSessions.get(sessionId);
  if (session) {
    // Release the ports
    const portMappings: PortMapping[] = session.previews.map(p => ({
      internal: p.port,
      external: p.port,
      protocol: 'tcp',
    }));
    releasePorts(portMappings);
    
    // Emit unavailable events
    for (const preview of session.previews) {
      emitPreviewEvent('preview.unavailable', sessionId, {
        url: preview.url,
        port: preview.port,
      });
    }
    
    previewSessions.delete(sessionId);
  }
}

// ============================================================================
// Health Check Operations
// ============================================================================

/**
 * Check if a preview URL is available
 * Note: In browser mode, this simulates availability
 */
export async function checkPreviewHealth(
  sessionId: string,
  port: number
): Promise<boolean> {
  const session = previewSessions.get(sessionId);
  if (!session) {
    return false;
  }

  const preview = session.previews.find(p => p.port === port);
  if (!preview) {
    return false;
  }

  // In browser simulation mode, previews are always "available"
  // In a real implementation, this would make an HTTP request
  const isAvailable = true;
  
  updatePreviewAvailability(sessionId, port, isAvailable);
  
  return isAvailable;
}

/**
 * Check all previews for a session
 */
export async function checkAllPreviewsHealth(
  sessionId: string
): Promise<Map<number, boolean>> {
  const session = previewSessions.get(sessionId);
  const results = new Map<number, boolean>();
  
  if (!session) {
    return results;
  }

  for (const preview of session.previews) {
    const isAvailable = await checkPreviewHealth(sessionId, preview.port);
    results.set(preview.port, isAvailable);
  }

  return results;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a preview URL
 */
export function generatePreviewUrl(
  port: number,
  config: PreviewConfig = DEFAULT_PREVIEW_CONFIG
): string {
  return `${config.baseUrl}:${port}`;
}

/**
 * Parse a preview URL to extract port
 */
export function parsePreviewUrl(url: string): { host: string; port: number } | null {
  try {
    const match = url.match(/^(https?:\/\/[^:]+):(\d+)/);
    if (match) {
      return {
        host: match[1],
        port: parseInt(match[2], 10),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get all active preview sessions
 */
export function getAllPreviewSessions(): PreviewSession[] {
  return Array.from(previewSessions.values());
}

/**
 * Get count of used ports
 */
export function getUsedPortCount(): number {
  return usedPorts.size;
}

/**
 * Clear all preview data (for testing/cleanup)
 */
export function clearAllPreviews(): void {
  previewSessions.clear();
  usedPorts.clear();
}
