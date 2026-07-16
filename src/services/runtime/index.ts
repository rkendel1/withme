/**
 * Runtime Services
 * 
 * Exports for runtime detection and execution engine services.
 */

// Runtime Detection
export {
  detectRuntime,
  detectPackageManager,
  detectFramework,
  detectEnvironmentVariables,
  detectPorts,
  detectStartCommand,
  detectRuntimeProfile,
} from './runtimeDetector';

// Execution Engine
export {
  createSession,
  startSession,
  stopSession,
  getSessionStatus,
  onExecutionEvent,
  detectContainerRuntime,
  DEFAULT_EXECUTION_CONFIG,
} from './executionEngine';

// Re-export types
export type {
  RuntimeLanguage,
  PackageManager,
  RuntimeFramework,
  RuntimeEnvironment,
  ExecutionStatus,
  ExecutionMode,
  RuntimeProfile,
  ExecutionSession,
  ExecutionLog,
  ExecutionEvent,
  ExecutionEventType,
  ExecutionConfig,
  RuntimeDetectionResult,
  PortMapping,
  RuntimeImage,
} from '../../types/runtime';
