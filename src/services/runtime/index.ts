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
  getDeviceCapabilities,
  getExecutionStrategy,
  DEFAULT_EXECUTION_CONFIG,
} from './executionEngine';

// Device Capabilities
export {
  detectPlatform,
  detectBrowser,
  detectDeviceCapabilities,
  selectExecutionStrategy,
  RuntimeProviderSelector,
  createMockCapabilities,
  describeStrategy,
  checkWasmSupport,
  checkServiceWorkerSupport,
  isBrowserContext,
} from './deviceCapabilities';

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
  // Device capability types
  DevicePlatform,
  BrowserType,
  RuntimeProvider,
  PreviewType,
  DeviceCapabilities,
  ExecutionStrategy,
  ExecutionOption,
  ExecutionContext,
} from '../../types/runtime';

// Re-export CreateSessionOptions type
export type { CreateSessionOptions } from './executionEngine';
