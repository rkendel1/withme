import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Loader2,
  Terminal,
  ExternalLink,
  RefreshCw,
  Box,
  Cpu,
  Package,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  RotateCcw,
  Server,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { getRuntimeProfile, upsertRuntimeProfile } from '../db/runtime';
import { getFilesByRepository, getDependenciesByRepository } from '../db';
import { detectRuntimeProfile } from '../services/runtime/runtimeDetector';
import {
  createSession,
  startSession,
  stopSession,
  onExecutionEvent,
  recycleContainerForSession,
  destroyContainerForSession,
  getContainerStatusForSession,
} from '../services/runtime/executionEngine';
import type {
  RuntimeEnvironment,
  ExecutionStatus,
  ExecutionEvent,
  ContainerStatus,
} from '../types/runtime';

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: ExecutionStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const configs: Record<ExecutionStatus, { color: string; icon: React.ReactNode; label: string }> = {
    idle: {
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      icon: <Box className="w-3 h-3" />,
      label: 'Idle',
    },
    creating: {
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'Creating',
    },
    installing: {
      color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'Installing',
    },
    starting: {
      color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'Starting',
    },
    running: {
      color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
      label: 'Running',
    },
    stopping: {
      color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'Stopping',
    },
    stopped: {
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      icon: <Square className="w-3 h-3" />,
      label: 'Stopped',
    },
    error: {
      color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      icon: <XCircle className="w-3 h-3" />,
      label: 'Error',
    },
  };

  const config = configs[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, icon, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </button>
      {expanded && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Log Viewer Component
// ============================================================================

interface LogViewerProps {
  logs: Array<{ level: string; message: string; timestamp: Date; source: string }>;
}

function LogViewer({ logs }: LogViewerProps) {
  const levelColors: Record<string, string> = {
    info: 'text-blue-500',
    warn: 'text-yellow-500',
    error: 'text-red-500',
    debug: 'text-gray-500',
  };

  const sourceColors: Record<string, string> = {
    system: 'text-purple-500',
    stdout: 'text-green-500',
    stderr: 'text-red-500',
    agent: 'text-cyan-500',
  };

  return (
    <div className="bg-gray-900 rounded-lg p-2 font-mono text-xs h-48 overflow-y-auto">
      {logs.length === 0 ? (
        <div className="text-gray-500 text-center py-4">No logs yet</div>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="flex gap-2 py-0.5">
            <span className="text-gray-600 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 ${sourceColors[log.source] || 'text-gray-500'}`}>
              [{log.source}]
            </span>
            <span className={`shrink-0 ${levelColors[log.level] || 'text-gray-400'}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-gray-300 break-all">{log.message}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// Runtime Panel Component
// ============================================================================

// Counter for unique log entry IDs
let logIdCounter = 0;
function generateLogId(): number {
  return ++logIdCounter;
}

/**
 * Format container ID for display
 * Truncates to 12 characters (standard Docker short ID format) with ellipsis
 */
const CONTAINER_ID_DISPLAY_LENGTH = 12;
function formatContainerId(containerId: string): string {
  if (containerId.length <= CONTAINER_ID_DISPLAY_LENGTH) {
    return containerId;
  }
  return `${containerId.substring(0, CONTAINER_ID_DISPLAY_LENGTH)}...`;
}

export function RuntimePanel() {
  const {
    selectedRepository,
    runtimeProfile,
    setRuntimeProfile,
    executionSession,
    setExecutionSession,
    executionLogs,
    addExecutionLog,
    clearExecutionLogs,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<RuntimeEnvironment>('development');
  const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null);
  const [isRecycling, setIsRecycling] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    profile: true,
    commands: true,
    logs: true,
    config: false,
    container: false,
  });

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Load runtime profile when repository changes
  useEffect(() => {
    if (!selectedRepository) {
      setRuntimeProfile(null);
      return;
    }

    async function loadProfile() {
      try {
        const profile = await getRuntimeProfile(selectedRepository!.id);
        setRuntimeProfile(profile);
      } catch (err) {
        console.error('Failed to load runtime profile:', err);
      }
    }

    loadProfile();
  }, [selectedRepository, setRuntimeProfile]);

  // Subscribe to execution events
  useEffect(() => {
    const unsubscribe = onExecutionEvent((event: ExecutionEvent) => {
      // Update session status based on events
      if (event.type === 'session.stopped' || event.type === 'session.error') {
        // We need to get current session and update it
        if (executionSession) {
          setExecutionSession({
            ...executionSession,
            status: event.type === 'session.error' ? 'error' : 'stopped',
            stoppedAt: new Date(),
          });
        }
      }

      // Add log entry for the event
      addExecutionLog({
        id: generateLogId(),
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        level: event.type.includes('error') ? 'error' : 'info',
        message: formatEventMessage(event),
        source: 'system',
      });
    });

    return unsubscribe;
  }, [executionSession, setExecutionSession, addExecutionLog]);

  // Format event message for logging
  const formatEventMessage = (event: ExecutionEvent): string => {
    switch (event.type) {
      case 'session.created':
        return 'Execution session created';
      case 'session.started':
        return 'Starting execution...';
      case 'session.stopped':
        return 'Execution stopped';
      case 'session.error':
        return `Error: ${event.data.error || 'Unknown error'}`;
      case 'container.pulling':
        return `Pulling image: ${event.data.image}`;
      case 'container.created':
        return `Container created: ${event.data.containerId}`;
      case 'container.started':
        return `Container started${event.data.reused ? ' (reused)' : ''}`;
      case 'container.stopped':
        return 'Container stopped';
      case 'container.recycled':
        return 'Container recycled and ready for reuse';
      case 'container.destroyed':
        return 'Container destroyed';
      case 'container.health':
        return `Container health: ${event.data.healthy ? 'healthy' : 'unhealthy'}`;
      case 'dependencies.installing':
        return 'Installing dependencies...';
      case 'dependencies.installed':
        return 'Dependencies installed';
      case 'application.starting':
        return 'Starting application...';
      case 'application.ready':
        return `Application ready at ${event.data.url}`;
      case 'port.exposed':
        return `Port ${event.data.internal} exposed as ${event.data.external}`;
      case 'preview.available':
        return `Preview available at ${event.data.url}`;
      case 'preview.unavailable':
        return `Preview unavailable on port ${event.data.port}`;
      case 'process.health':
        return `Process health check completed`;
      default:
        return event.type;
    }
  };

  // Detect runtime profile
  const handleDetectRuntime = useCallback(async () => {
    if (!selectedRepository) return;

    setIsDetecting(true);
    setError(null);

    try {
      const files = await getFilesByRepository(selectedRepository.id);
      const dependencies = await getDependenciesByRepository(selectedRepository.id);

      const detection = detectRuntimeProfile(files, dependencies);

      const profile = await upsertRuntimeProfile({
        repositoryId: selectedRepository.id,
        runtime: detection.runtime,
        version: detection.version,
        packageManager: detection.packageManager,
        lockFile: detection.lockFile,
        framework: detection.framework,
        installCommand: detection.installCommand,
        startCommand: detection.startCommand,
        buildCommand: detection.buildCommand,
        testCommand: detection.testCommand,
        ports: detection.ports,
        environmentVariables: detection.environmentVariables,
        confidence: detection.confidence,
        detectedFrom: detection.detectedFrom,
      });

      setRuntimeProfile(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to detect runtime';
      setError(message);
      console.error('Runtime detection failed:', err);
    } finally {
      setIsDetecting(false);
    }
  }, [selectedRepository, setRuntimeProfile]);

  // Start execution
  const handleStart = useCallback(async () => {
    if (!selectedRepository || !runtimeProfile) return;

    setIsLoading(true);
    setError(null);
    clearExecutionLogs();

    try {
      // Create session
      const session = await createSession(selectedRepository.id, runtimeProfile, {
        environment,
      });
      setExecutionSession(session);

      // Start session
      const startedSession = await startSession(session.id, runtimeProfile);
      setExecutionSession(startedSession);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start execution';
      setError(message);
      console.error('Execution failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRepository, runtimeProfile, environment, setExecutionSession, clearExecutionLogs]);

  // Stop execution
  const handleStop = useCallback(async () => {
    if (!executionSession) return;

    setIsLoading(true);

    try {
      const stoppedSession = await stopSession(executionSession.id);
      setExecutionSession(stoppedSession);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop execution';
      setError(message);
      console.error('Stop failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [executionSession, setExecutionSession]);

  // Recycle container (clear workspace, reset environment)
  const handleRecycleContainer = useCallback(async () => {
    if (!executionSession) return;

    setIsRecycling(true);
    setError(null);

    try {
      const container = await recycleContainerForSession(executionSession.id);
      if (container) {
        setContainerStatus(container.status);
        addExecutionLog({
          id: generateLogId(),
          sessionId: executionSession.id,
          timestamp: new Date(),
          level: 'info',
          message: `Container recycled and ready for reuse`,
          source: 'system',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recycle container';
      setError(message);
      console.error('Recycle failed:', err);
    } finally {
      setIsRecycling(false);
    }
  }, [executionSession, addExecutionLog]);

  // Destroy container completely
  const handleDestroyContainer = useCallback(async () => {
    if (!executionSession) return;

    setIsLoading(true);
    setError(null);

    try {
      await destroyContainerForSession(executionSession.id);
      setContainerStatus(null);
      addExecutionLog({
        id: generateLogId(),
        sessionId: executionSession.id,
        timestamp: new Date(),
        level: 'info',
        message: 'Container destroyed',
        source: 'system',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to destroy container';
      setError(message);
      console.error('Destroy failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [executionSession, addExecutionLog]);

  // Refresh container status
  const refreshContainerStatus = useCallback(async () => {
    if (!executionSession) return;

    try {
      const status = await getContainerStatusForSession(executionSession.id);
      if (status) {
        setContainerStatus(status.status as ContainerStatus);
      }
    } catch (err) {
      console.error('Failed to get container status:', err);
    }
  }, [executionSession]);

  // Update container status when session changes
  useEffect(() => {
    if (executionSession?.containerId) {
      refreshContainerStatus();
    } else {
      setContainerStatus(null);
    }
  }, [executionSession?.containerId, refreshContainerStatus]);

  // No repository selected
  if (!selectedRepository) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Play className="w-5 h-5" />
            Runtime Execution
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Select a repository to view runtime options</p>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = executionSession?.status === 'running';
  const isExecuting = ['creating', 'installing', 'starting', 'stopping'].includes(
    executionSession?.status || ''
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Play className="w-5 h-5" />
            Runtime Execution
          </h2>
          {executionSession && <StatusBadge status={executionSession.status} />}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {selectedRepository.fullName}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* No Profile State */}
        {!runtimeProfile && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Cpu className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-700 dark:text-blue-300">
                  Runtime Not Detected
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Click "Detect Runtime" to analyze this repository and generate a runtime profile.
                </p>
                <button
                  onClick={handleDetectRuntime}
                  disabled={isDetecting}
                  className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Detect Runtime
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Runtime Profile Section */}
        {runtimeProfile && (
          <Section
            title="Runtime Profile"
            icon={<Cpu className="w-4 h-4 text-blue-500" />}
            expanded={expandedSections.profile}
            onToggle={() => toggleSection('profile')}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Runtime:</span>
                  <span className="ml-2 font-medium capitalize">
                    {runtimeProfile.runtime}
                    {runtimeProfile.version && ` ${runtimeProfile.version}`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Package Manager:</span>
                  <span className="ml-2 font-medium capitalize">
                    {runtimeProfile.packageManager.replace('_', ' ')}
                  </span>
                </div>
                {runtimeProfile.framework && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Framework:</span>
                    <span className="ml-2 font-medium capitalize">
                      {runtimeProfile.framework.replace('_', ' ')}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Ports:</span>
                  <span className="ml-2 font-medium">
                    {runtimeProfile.ports.join(', ') || 'None'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">
                  Confidence: {Math.round(runtimeProfile.confidence * 100)}%
                </span>
                <button
                  onClick={handleDetectRuntime}
                  disabled={isDetecting}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
                  Re-detect
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Commands Section */}
        {runtimeProfile && (
          <Section
            title="Commands"
            icon={<Terminal className="w-4 h-4 text-green-500" />}
            expanded={expandedSections.commands}
            onToggle={() => toggleSection('commands')}
          >
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-500 dark:text-gray-400">Install:</span>
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs flex-1 truncate">
                  {runtimeProfile.installCommand}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-gray-500 dark:text-gray-400">Start:</span>
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs flex-1 truncate">
                  {runtimeProfile.startCommand}
                </code>
              </div>
              {runtimeProfile.buildCommand && (
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400">Build:</span>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs flex-1 truncate">
                    {runtimeProfile.buildCommand}
                  </code>
                </div>
              )}
              {runtimeProfile.testCommand && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400">Test:</span>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs flex-1 truncate">
                    {runtimeProfile.testCommand}
                  </code>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Configuration Section */}
        {runtimeProfile && (
          <Section
            title="Configuration"
            icon={<Settings className="w-4 h-4 text-purple-500" />}
            expanded={expandedSections.config}
            onToggle={() => toggleSection('config')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Environment</label>
                <div className="flex gap-2">
                  {(['development', 'production', 'test'] as RuntimeEnvironment[]).map(env => (
                    <button
                      key={env}
                      onClick={() => setEnvironment(env)}
                      disabled={isRunning || isExecuting}
                      className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${
                        environment === env
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>

              {Object.keys(runtimeProfile.environmentVariables).length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Environment Variables</label>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
                    {Object.entries(runtimeProfile.environmentVariables).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-purple-600 dark:text-purple-400">{key}</span>
                        <span className="text-gray-500">=</span>
                        <span className="text-gray-600 dark:text-gray-400 truncate">
                          {value || '(not set)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Logs Section */}
        <Section
          title="Execution Logs"
          icon={<Terminal className="w-4 h-4 text-orange-500" />}
          expanded={expandedSections.logs}
          onToggle={() => toggleSection('logs')}
        >
          <LogViewer logs={executionLogs} />
        </Section>

        {/* Running Session Info */}
        {executionSession?.status === 'running' && executionSession.url && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-300">
                  Application Running
                </span>
              </div>
              <a
                href={executionSession.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
              >
                <ExternalLink className="w-4 h-4" />
                Open Preview
              </a>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {executionSession.url}
            </p>
            {executionSession.ports.length > 0 && (
              <div className="mt-2 flex gap-2">
                {executionSession.ports.map((port, index) => (
                  <span
                    key={index}
                    className="text-xs bg-green-100 dark:bg-green-800/30 px-2 py-0.5 rounded"
                  >
                    {port.internal}:{port.external}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      {runtimeProfile && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={isLoading || isExecuting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {executionSession?.statusMessage || 'Starting...'}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Repository
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4" />
                    Stop
                  </>
                )}
              </button>
            )}
          </div>

          {/* Container Management Controls */}
          {executionSession?.containerId && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Server className="w-4 h-4" />
                  <span>Container: {formatContainerId(executionSession.containerId)}</span>
                  {containerStatus && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      containerStatus === 'running' || containerStatus === 'ready'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : containerStatus === 'idle'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : containerStatus === 'recycling'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {containerStatus}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRecycleContainer}
                  disabled={isRecycling || isLoading || isRunning}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  title="Recycle container - clear workspace and reset for reuse"
                >
                  {isRecycling ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Recycling...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3" />
                      Recycle
                    </>
                  )}
                </button>
                <button
                  onClick={handleDestroyContainer}
                  disabled={isLoading || isRunning}
                  className="flex-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  title="Destroy container - completely remove"
                >
                  <Trash2 className="w-3 h-3" />
                  Destroy
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
