/**
 * Runtime Execution Engine Types
 * 
 * These types represent the runtime execution capabilities that enable
 * RepoLens to move from "understanding repositories" to "running them."
 */

// ============================================================================
// Runtime Types
// ============================================================================

/** Supported runtime languages */
export type RuntimeLanguage =
  | 'node'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'dotnet'
  | 'ruby'
  | 'php'
  | 'unknown';

/** Supported package managers */
export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'pip'
  | 'poetry'
  | 'pipenv'
  | 'cargo'
  | 'go_modules'
  | 'maven'
  | 'gradle'
  | 'nuget'
  | 'dotnet'
  | 'bundler'
  | 'composer'
  | 'unknown';

/** Supported frameworks */
export type RuntimeFramework =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'angular'
  | 'vite'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'django'
  | 'fastapi'
  | 'flask'
  | 'rails'
  | 'spring_boot'
  | 'laravel'
  | 'actix'
  | 'rocket'
  | 'gin'
  | 'fiber'
  | 'unknown';

/** Runtime execution environment type */
export type RuntimeEnvironment = 'development' | 'production' | 'test';

/** Container execution status */
export type ExecutionStatus =
  | 'idle'
  | 'creating'
  | 'installing'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

/** Execution mode for running repositories */
export type ExecutionMode = 
  | 'browser'      // WASM-compatible, runs in browser
  | 'local'        // Local container via Docker/Podman
  | 'remote';      // Remote ephemeral runtime

// ============================================================================
// Runtime Profile
// ============================================================================

/** Runtime profile generated from repository analysis */
export interface RuntimeProfile {
  id: number;
  repositoryId: number;
  
  // Detected runtime
  runtime: RuntimeLanguage;
  version: string | null;
  
  // Package management
  packageManager: PackageManager;
  lockFile: string | null;
  
  // Framework detection
  framework: RuntimeFramework | null;
  
  // Commands
  installCommand: string;
  startCommand: string;
  buildCommand: string | null;
  testCommand: string | null;
  
  // Network
  ports: number[];
  
  // Environment
  environmentVariables: Record<string, string>;
  
  // Detection metadata
  confidence: number;
  detectedFrom: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

/** Data for creating a new runtime profile */
export type CreateRuntimeProfileData = Omit<RuntimeProfile, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Execution Session
// ============================================================================

/** An active execution session */
export interface ExecutionSession {
  id: string;
  repositoryId: number;
  profileId: number;
  
  // Status
  status: ExecutionStatus;
  statusMessage: string | null;
  
  // Environment
  environment: RuntimeEnvironment;
  mode: ExecutionMode;
  
  // Container info (for local/remote)
  containerId: string | null;
  containerImage: string | null;
  
  // Access
  url: string | null;
  ports: PortMapping[];
  
  // Timestamps
  startedAt: Date;
  stoppedAt: Date | null;
}

/** Port mapping for container */
export interface PortMapping {
  internal: number;
  external: number;
  protocol: 'tcp' | 'udp';
}

// ============================================================================
// Execution Log
// ============================================================================

/** Log entry from execution */
export interface ExecutionLog {
  id: number;
  sessionId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: 'system' | 'stdout' | 'stderr' | 'agent';
}

// ============================================================================
// Runtime Detection Result
// ============================================================================

/** Result of runtime detection analysis */
export interface RuntimeDetectionResult {
  // Primary runtime
  runtime: RuntimeLanguage;
  version: string | null;
  confidence: number;
  
  // Package manager
  packageManager: PackageManager;
  lockFile: string | null;
  
  // Framework
  framework: RuntimeFramework | null;
  frameworkVersion: string | null;
  
  // Commands
  installCommand: string;
  startCommand: string;
  buildCommand: string | null;
  testCommand: string | null;
  
  // Ports
  ports: number[];
  
  // Environment variables detected
  environmentVariables: Record<string, string>;
  
  // Files that contributed to detection
  detectedFrom: string[];
}

// ============================================================================
// Runtime Images
// ============================================================================

/** Available runtime container images */
export interface RuntimeImage {
  id: string;
  name: string;
  runtime: RuntimeLanguage;
  version: string;
  tag: string;
  packageManagers: PackageManager[];
  description: string;
}

/** Default runtime images using Docker-style naming convention */
export const DEFAULT_RUNTIME_IMAGES: RuntimeImage[] = [
  {
    id: 'node22',
    name: 'Node.js 22',
    runtime: 'node',
    version: '22',
    tag: 'repolens/node:22',
    packageManagers: ['npm', 'yarn', 'pnpm'],
    description: 'Node.js 22 LTS with npm, yarn, and pnpm',
  },
  {
    id: 'python312',
    name: 'Python 3.12',
    runtime: 'python',
    version: '3.12',
    tag: 'repolens/python:3.12',
    packageManagers: ['pip', 'poetry', 'pipenv'],
    description: 'Python 3.12 with pip, poetry, and pipenv',
  },
  {
    id: 'rust',
    name: 'Rust (Latest)',
    runtime: 'rust',
    version: 'latest',
    tag: 'repolens/rust:latest',
    packageManagers: ['cargo'],
    description: 'Rust with Cargo package manager',
  },
  {
    id: 'go',
    name: 'Go (Latest)',
    runtime: 'go',
    version: 'latest',
    tag: 'repolens/go:latest',
    packageManagers: ['go_modules'],
    description: 'Go with modules support',
  },
];

// ============================================================================
// Runtime Graph Relationship Types
// ============================================================================

/** Additional relationship types for runtime graph */
export type RuntimeEdgeType =
  | 'starts'
  | 'loads'
  | 'exposes'
  | 'connects_to'
  | 'depends_on_runtime'
  | 'reads_env'
  | 'writes_data';

// ============================================================================
// Execution Events
// ============================================================================

/** Events emitted during execution */
export type ExecutionEventType =
  | 'session.created'
  | 'session.started'
  | 'session.stopped'
  | 'session.error'
  | 'container.pulling'
  | 'container.created'
  | 'container.started'
  | 'container.stopped'
  | 'container.recycled'
  | 'container.destroyed'
  | 'container.health'
  | 'dependencies.installing'
  | 'dependencies.installed'
  | 'application.starting'
  | 'application.ready'
  | 'application.error'
  | 'port.exposed'
  | 'log.received'
  | 'process.health'
  | 'preview.available'
  | 'preview.unavailable';

/** Execution event */
export interface ExecutionEvent {
  type: ExecutionEventType;
  sessionId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================================================
// Execution Configuration
// ============================================================================

/** Configuration for execution */
export interface ExecutionConfig {
  // Resource limits
  cpuLimit: number;        // CPU cores (e.g., 1, 2)
  memoryLimit: number;     // Memory in MB
  
  // Network
  networkIsolation: boolean;
  allowedHosts: string[];
  
  // Filesystem
  readOnlyMounts: string[];
  writablePaths: string[];
  
  // Timeout
  maxRuntime: number;      // Max runtime in seconds (0 = no limit)
  
  // Environment
  additionalEnv: Record<string, string>;
}

/** Default execution configuration */
export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  cpuLimit: 1,
  memoryLimit: 512,
  networkIsolation: false,
  allowedHosts: [],
  readOnlyMounts: [],
  writablePaths: ['/tmp'],
  maxRuntime: 3600, // 1 hour
  additionalEnv: {},
};

// ============================================================================
// Runtime Container Types
// ============================================================================

/** Container lifecycle status */
export type ContainerStatus = 
  | 'created'
  | 'ready'
  | 'running'
  | 'idle'
  | 'recycling'
  | 'destroyed'
  | 'error';

/** Resource limits for a container */
export interface ResourceLimits {
  cpuLimit: number;
  memoryLimit: number;
  storageLimit?: number;
}

/** A reusable runtime container */
export interface RuntimeContainer {
  id: string;
  runtimeImage: string;
  runtimeVersion: string;
  status: ContainerStatus;
  createdAt: Date;
  lastUsedAt: Date;
  resourceLimits: ResourceLimits;
  metadata: Record<string, unknown>;
}

/** Data for creating a new runtime container */
export type CreateRuntimeContainerData = Omit<RuntimeContainer, 'id' | 'createdAt' | 'lastUsedAt'>;

// ============================================================================
// Execution Process Types
// ============================================================================

/** Process health status */
export type ProcessHealth = 'healthy' | 'unhealthy' | 'starting' | 'unknown';

/** Process status */
export type ProcessStatus = 
  | 'created'
  | 'running'
  | 'stopped'
  | 'crashed'
  | 'restarting';

/** An application process running in a session */
export interface ExecutionProcess {
  id: number;
  sessionId: string;
  pid: number | null;
  command: string;
  status: ProcessStatus;
  health: ProcessHealth;
  restartCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Data for creating a new execution process */
export type CreateExecutionProcessData = Omit<ExecutionProcess, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// Container Event Types
// ============================================================================

/** Container event types */
export type ContainerEventType =
  | 'container.created'
  | 'container.started'
  | 'container.stopped'
  | 'container.recycled'
  | 'container.destroyed'
  | 'container.error'
  | 'container.health_check'
  | 'repository.mounted'
  | 'repository.unmounted'
  | 'process.started'
  | 'process.stopped'
  | 'process.crashed'
  | 'process.restarted';

/** A container lifecycle event */
export interface ContainerEvent {
  id: number;
  containerId: string;
  eventType: ContainerEventType;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** Data for creating a container event */
export type CreateContainerEventData = Omit<ContainerEvent, 'id' | 'timestamp'>;

// ============================================================================
// Extended Execution Session Types
// ============================================================================

/** Extended execution session with container and process info */
export interface ExtendedExecutionSession extends ExecutionSession {
  command?: string;
  workingDirectory?: string;
  previewUrl?: string | null;
}

// ============================================================================
// Preview System Types
// ============================================================================

/** Preview URL info */
export interface PreviewInfo {
  url: string;
  port: number;
  protocol: 'http' | 'https';
  isAvailable: boolean;
  lastCheckedAt: Date;
}

/** Preview manager configuration */
export interface PreviewConfig {
  baseUrl: string;
  portRangeStart: number;
  portRangeEnd: number;
  healthCheckInterval: number;
}

/** Default preview configuration */
export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  baseUrl: 'http://localhost',
  portRangeStart: 10000,
  portRangeEnd: 20000,
  healthCheckInterval: 5000,
};

// ============================================================================
// Container Cleanup Policy Types
// ============================================================================

/** Cleanup policy for containers */
export type CleanupPolicy = 'stop' | 'recycle' | 'destroy';

/** Time constants for configuration */
const MINUTES_TO_MS = 60 * 1000;
const IDLE_TIMEOUT_MINUTES = 30;

/** Cleanup configuration */
export interface CleanupConfig {
  policy: CleanupPolicy;
  idleTimeoutMs: number;
  maxContainers: number;
}

/** Default cleanup configuration */
export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  policy: 'recycle',
  idleTimeoutMs: IDLE_TIMEOUT_MINUTES * MINUTES_TO_MS, // 30 minutes
  maxContainers: 5,
};
