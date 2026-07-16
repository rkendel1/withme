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
  | 'dependencies.installing'
  | 'dependencies.installed'
  | 'application.starting'
  | 'application.ready'
  | 'application.error'
  | 'port.exposed'
  | 'log.received';

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
