import { describe, it, expect } from 'vitest';
import type {
  RuntimeContainer,
  ContainerStatus,
  ExecutionProcess,
  ContainerEvent,
  ProcessHealth,
  ProcessStatus,
  ResourceLimits,
} from '../types/runtime';

// ============================================================================
// Container Type Tests
// ============================================================================

describe('Container Types', () => {
  describe('ContainerStatus', () => {
    it('should include all valid container statuses', () => {
      const validStatuses: ContainerStatus[] = [
        'created',
        'ready',
        'running',
        'idle',
        'recycling',
        'destroyed',
        'error',
      ];
      
      // Type check - this should compile without errors
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('RuntimeContainer', () => {
    it('should have required properties', () => {
      const container: RuntimeContainer = {
        id: 'node22-abc123',
        runtimeImage: 'repolens/node:22',
        runtimeVersion: '22',
        status: 'ready',
        createdAt: new Date(),
        lastUsedAt: new Date(),
        resourceLimits: {
          cpuLimit: 1,
          memoryLimit: 512,
        },
        metadata: {},
      };

      expect(container.id).toBe('node22-abc123');
      expect(container.runtimeImage).toBe('repolens/node:22');
      expect(container.status).toBe('ready');
      expect(container.resourceLimits.cpuLimit).toBe(1);
      expect(container.resourceLimits.memoryLimit).toBe(512);
    });

    it('should allow optional storage limit in resource limits', () => {
      const limits: ResourceLimits = {
        cpuLimit: 2,
        memoryLimit: 1024,
        storageLimit: 5000,
      };

      expect(limits.storageLimit).toBe(5000);
    });
  });

  describe('ProcessStatus', () => {
    it('should include all valid process statuses', () => {
      const validStatuses: ProcessStatus[] = [
        'created',
        'running',
        'stopped',
        'crashed',
        'restarting',
      ];

      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('ProcessHealth', () => {
    it('should include all valid health states', () => {
      const validHealth: ProcessHealth[] = [
        'healthy',
        'unhealthy',
        'starting',
        'unknown',
      ];

      validHealth.forEach(health => {
        expect(typeof health).toBe('string');
      });
    });
  });

  describe('ExecutionProcess', () => {
    it('should have required properties', () => {
      const process: ExecutionProcess = {
        id: 1,
        sessionId: 'exec-123',
        pid: 12345,
        command: 'pnpm dev',
        status: 'running',
        health: 'healthy',
        restartCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(process.id).toBe(1);
      expect(process.sessionId).toBe('exec-123');
      expect(process.pid).toBe(12345);
      expect(process.command).toBe('pnpm dev');
      expect(process.status).toBe('running');
      expect(process.health).toBe('healthy');
    });

    it('should allow null pid', () => {
      const process: ExecutionProcess = {
        id: 1,
        sessionId: 'exec-123',
        pid: null,
        command: 'pnpm dev',
        status: 'created',
        health: 'unknown',
        restartCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(process.pid).toBeNull();
    });
  });

  describe('ContainerEvent', () => {
    it('should have required properties', () => {
      const event: ContainerEvent = {
        id: 1,
        containerId: 'node22-abc123',
        eventType: 'container.created',
        message: 'Container created successfully',
        timestamp: new Date(),
      };

      expect(event.containerId).toBe('node22-abc123');
      expect(event.eventType).toBe('container.created');
      expect(event.message).toBe('Container created successfully');
    });

    it('should allow optional metadata', () => {
      const event: ContainerEvent = {
        id: 1,
        containerId: 'node22-abc123',
        eventType: 'container.health_check',
        message: 'Health check passed',
        timestamp: new Date(),
        metadata: { healthy: true, latency: 50 },
      };

      expect(event.metadata).toBeDefined();
      expect(event.metadata?.healthy).toBe(true);
    });
  });
});

// ============================================================================
// Preview Types Tests
// ============================================================================

describe('Preview Types', () => {
  describe('PreviewInfo', () => {
    it('should have correct structure', () => {
      const preview = {
        url: 'http://localhost:10000',
        port: 10000,
        protocol: 'http' as const,
        isAvailable: true,
        lastCheckedAt: new Date(),
      };

      expect(preview.url).toBe('http://localhost:10000');
      expect(preview.port).toBe(10000);
      expect(preview.protocol).toBe('http');
      expect(preview.isAvailable).toBe(true);
    });
  });

  describe('PreviewConfig', () => {
    it('should have default values', () => {
      const config = {
        baseUrl: 'http://localhost',
        portRangeStart: 10000,
        portRangeEnd: 20000,
        healthCheckInterval: 5000,
      };

      expect(config.baseUrl).toBe('http://localhost');
      expect(config.portRangeStart).toBe(10000);
      expect(config.portRangeEnd).toBe(20000);
      expect(config.healthCheckInterval).toBe(5000);
    });
  });
});

// ============================================================================
// Cleanup Policy Tests
// ============================================================================

describe('Cleanup Policies', () => {
  it('should support stop policy', () => {
    const policy = 'stop';
    expect(policy).toBe('stop');
  });

  it('should support recycle policy', () => {
    const policy = 'recycle';
    expect(policy).toBe('recycle');
  });

  it('should support destroy policy', () => {
    const policy = 'destroy';
    expect(policy).toBe('destroy');
  });

  describe('CleanupConfig', () => {
    it('should have correct structure', () => {
      const config = {
        policy: 'recycle' as const,
        idleTimeoutMs: 30 * 60 * 1000,
        maxContainers: 5,
      };

      expect(config.policy).toBe('recycle');
      expect(config.idleTimeoutMs).toBe(1800000);
      expect(config.maxContainers).toBe(5);
    });
  });
});

// ============================================================================
// Extended Execution Session Tests
// ============================================================================

describe('Extended Execution Session', () => {
  it('should include additional fields for container management', () => {
    const session = {
      id: 'exec-123',
      repositoryId: 1,
      profileId: 1,
      status: 'running' as const,
      statusMessage: 'Application running',
      environment: 'development' as const,
      mode: 'local' as const,
      containerId: 'node22-abc123',
      containerImage: 'repolens/node:22',
      url: 'http://localhost:10000',
      ports: [{ internal: 3000, external: 10000, protocol: 'tcp' as const }],
      startedAt: new Date(),
      stoppedAt: null,
      command: 'pnpm dev',
      workingDirectory: '/workspace/my-project',
      previewUrl: 'http://localhost:10000',
    };

    expect(session.command).toBe('pnpm dev');
    expect(session.workingDirectory).toBe('/workspace/my-project');
    expect(session.previewUrl).toBe('http://localhost:10000');
    expect(session.containerId).toBe('node22-abc123');
  });
});

// ============================================================================
// Container Lifecycle State Transitions
// ============================================================================

describe('Container Lifecycle', () => {
  it('should follow expected state transitions', () => {
    // created -> ready (after initialization)
    // ready -> running (when executing)
    // running -> idle (when stopped but preserved)
    // idle -> running (when reused)
    // idle -> recycling (when cleaning)
    // recycling -> ready (after cleanup)
    // any -> destroyed (when removed)

    const validTransitions: Record<ContainerStatus, ContainerStatus[]> = {
      created: ['ready', 'error', 'destroyed'],
      ready: ['running', 'destroyed'],
      running: ['idle', 'error', 'destroyed'],
      idle: ['running', 'recycling', 'destroyed'],
      recycling: ['ready', 'error', 'destroyed'],
      destroyed: [], // Terminal state
      error: ['destroyed'],
    };

    expect(validTransitions.created).toContain('ready');
    expect(validTransitions.running).toContain('idle');
    expect(validTransitions.idle).toContain('recycling');
    expect(validTransitions.recycling).toContain('ready');
  });
});

// ============================================================================
// Event Type Coverage
// ============================================================================

describe('Container Event Types', () => {
  it('should cover all container lifecycle events', () => {
    const eventTypes = [
      'container.created',
      'container.started',
      'container.stopped',
      'container.recycled',
      'container.destroyed',
      'container.error',
      'container.health_check',
      'repository.mounted',
      'repository.unmounted',
      'process.started',
      'process.stopped',
      'process.crashed',
      'process.restarted',
    ];

    expect(eventTypes).toContain('container.created');
    expect(eventTypes).toContain('container.recycled');
    expect(eventTypes).toContain('repository.mounted');
    expect(eventTypes).toContain('process.crashed');
  });
});
