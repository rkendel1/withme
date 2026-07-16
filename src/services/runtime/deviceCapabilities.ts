/**
 * Device Capability Detection Service
 * 
 * Detects device capabilities to determine available execution strategies.
 * This enables adaptive runtime behavior based on the user's device and
 * available execution providers.
 */

import type {
  DeviceCapabilities,
  DevicePlatform,
  BrowserType,
  ExecutionStrategy,
  ExecutionOption,
  ExecutionMode,
  RuntimeProvider,
  PreviewType,
} from '../../types/runtime';
import { DEFAULT_REMOTE_PREVIEW_URL } from '../../types/runtime';

// ============================================================================
// Device Detection
// ============================================================================

/**
 * Detect the device platform from user agent
 */
export function detectPlatform(userAgent?: string): DevicePlatform {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  
  // Check for mobile devices first
  const mobilePatterns = [
    /iPhone/i,
    /iPod/i,
    /Android.*Mobile/i,
    /Windows Phone/i,
    /BlackBerry/i,
    /Opera Mini/i,
    /IEMobile/i,
    /Mobile Safari/i,
  ];
  
  if (mobilePatterns.some(pattern => pattern.test(ua))) {
    return 'mobile';
  }
  
  // Check for tablets
  const tabletPatterns = [
    /iPad/i,
    /Android(?!.*Mobile)/i,
    /Tablet/i,
    /PlayBook/i,
    /Silk/i,
  ];
  
  if (tabletPatterns.some(pattern => pattern.test(ua))) {
    return 'tablet';
  }
  
  // Default to desktop
  return 'desktop';
}

/**
 * Detect the browser type from user agent
 */
export function detectBrowser(userAgent?: string): BrowserType {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  
  // Check for specific browsers
  if (/Edg/i.test(ua)) return 'edge';
  if (/OPR|Opera/i.test(ua)) return 'opera';
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'safari';
  if (/Firefox/i.test(ua)) return 'firefox';
  
  // Check for embedded browsers (WebView, etc.)
  if (/WebView/i.test(ua) || /wv\)/i.test(ua)) return 'embedded';
  
  return 'unknown';
}

/**
 * Check if WebAssembly is supported
 */
export function checkWasmSupport(): boolean {
  try {
    if (typeof WebAssembly === 'object' &&
        typeof WebAssembly.instantiate === 'function') {
      // Additional check: can we compile a minimal WASM module?
      const module = new WebAssembly.Module(
        Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
      );
      return module instanceof WebAssembly.Module;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Check if Service Workers are supported
 */
export function checkServiceWorkerSupport(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Check if running in a browser context
 */
export function isBrowserContext(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Detect all device capabilities
 */
export function detectDeviceCapabilities(options: {
  userAgent?: string;
  localAgentAvailable?: boolean;
  containerRuntimeAvailable?: boolean;
  remoteExecutionAvailable?: boolean;
} = {}): DeviceCapabilities {
  const {
    userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null,
    localAgentAvailable = false,
    containerRuntimeAvailable = false,
    remoteExecutionAvailable = true, // Assume remote is available by default
  } = options;
  
  const platform = detectPlatform(userAgent || undefined);
  const browser = detectBrowser(userAgent || undefined);
  const inBrowser = isBrowserContext();
  
  // Desktop with local agent has full capabilities
  const isDesktop = platform === 'desktop';
  const hasLocalAgent = localAgentAvailable && isDesktop;
  
  return {
    platform,
    browser,
    isBrowser: inBrowser,
    
    // Filesystem access - only available with local agent on desktop
    localFilesystem: hasLocalAgent,
    
    // Container runtime - only available with local agent
    containerRuntime: hasLocalAgent && containerRuntimeAvailable,
    
    // Localhost ports - only available on desktop with local agent
    localhostPorts: hasLocalAgent,
    
    // Background execution - limited on mobile browsers
    backgroundExecution: isDesktop || !inBrowser,
    
    // WASM support - check browser capability
    wasmSupport: inBrowser ? checkWasmSupport() : true,
    
    // Remote execution - assume available unless explicitly disabled
    remoteExecutionAvailable,
    
    // Service worker support
    serviceWorkerSupport: checkServiceWorkerSupport(),
    
    // User agent for debugging
    userAgent,
  };
}

// ============================================================================
// Execution Strategy Selection
// ============================================================================

/**
 * Define all possible execution options
 */
function createExecutionOptions(capabilities: DeviceCapabilities): ExecutionOption[] {
  const options: ExecutionOption[] = [];
  
  // Local container execution (Desktop only)
  options.push({
    id: 'local-container',
    label: 'Run Locally',
    description: 'Execute in a local container using Docker or Podman',
    mode: 'local',
    provider: 'local-agent',
    available: capabilities.containerRuntime && capabilities.localhostPorts,
    unavailableReason: !capabilities.containerRuntime 
      ? 'Container runtime not available'
      : !capabilities.localhostPorts 
        ? 'Localhost ports not available on this device'
        : undefined,
    recommended: capabilities.containerRuntime && capabilities.localhostPorts,
  });
  
  // Remote sandbox execution (Available everywhere)
  options.push({
    id: 'remote-sandbox',
    label: 'Run in Cloud Sandbox',
    description: 'Execute in a secure cloud sandbox with HTTPS preview',
    mode: 'remote',
    provider: 'remote-sandbox',
    available: capabilities.remoteExecutionAvailable,
    unavailableReason: !capabilities.remoteExecutionAvailable 
      ? 'Remote execution not available'
      : undefined,
    recommended: !capabilities.containerRuntime && capabilities.remoteExecutionAvailable,
  });
  
  // Browser WASM execution (For compatible apps)
  options.push({
    id: 'browser-wasm',
    label: 'Run in Browser',
    description: 'Execute directly in the browser using WebAssembly',
    mode: 'browser',
    provider: 'browser-wasm',
    available: capabilities.wasmSupport && capabilities.isBrowser,
    unavailableReason: !capabilities.wasmSupport 
      ? 'WebAssembly not supported'
      : !capabilities.isBrowser 
        ? 'Not in browser context'
        : undefined,
    recommended: false, // Only recommended for specific WASM-compatible projects
  });
  
  // Analysis-only mode (Always available)
  options.push({
    id: 'analysis-only',
    label: 'Analyze Only',
    description: 'Analyze repository without execution',
    mode: 'analysis',
    provider: 'analysis-only',
    available: true,
    recommended: !capabilities.containerRuntime && !capabilities.remoteExecutionAvailable,
  });
  
  return options;
}

/**
 * Select the best execution strategy based on device capabilities
 */
export function selectExecutionStrategy(capabilities: DeviceCapabilities): ExecutionStrategy {
  const options = createExecutionOptions(capabilities);
  
  // Determine execution mode and provider
  let mode: ExecutionMode;
  let provider: RuntimeProvider;
  let previewType: PreviewType;
  let selectionReason: string;
  
  if (capabilities.containerRuntime && capabilities.localhostPorts) {
    // Desktop with full local capabilities
    mode = 'local';
    provider = 'local-agent';
    previewType = 'localhost';
    selectionReason = 'Local container runtime available with localhost preview';
  } else if (capabilities.remoteExecutionAvailable) {
    // Remote sandbox for mobile or desktop without local runtime
    mode = 'remote';
    provider = 'remote-sandbox';
    previewType = 'https';
    selectionReason = capabilities.platform === 'mobile'
      ? 'Mobile device - using cloud sandbox with secure preview'
      : capabilities.platform === 'tablet'
        ? 'Tablet device - using cloud sandbox with secure preview'
        : 'No local container runtime - using cloud sandbox';
  } else if (capabilities.wasmSupport && capabilities.isBrowser) {
    // Browser WASM fallback
    mode = 'browser';
    provider = 'browser-wasm';
    previewType = 'embedded';
    selectionReason = 'Using in-browser WASM execution';
  } else {
    // Analysis only
    mode = 'analysis';
    provider = 'analysis-only';
    previewType = 'none';
    selectionReason = 'No execution runtime available - analysis mode only';
  }
  
  return {
    mode,
    provider,
    previewType,
    availableOptions: options,
    selectionReason,
  };
}

// ============================================================================
// Runtime Provider Selection
// ============================================================================

/**
 * RuntimeProviderSelector - Selects the appropriate runtime provider
 * based on device capabilities and user preferences.
 */
export class RuntimeProviderSelector {
  private capabilities: DeviceCapabilities;
  private strategy: ExecutionStrategy;
  
  constructor(options: {
    userAgent?: string;
    localAgentAvailable?: boolean;
    containerRuntimeAvailable?: boolean;
    remoteExecutionAvailable?: boolean;
  } = {}) {
    this.capabilities = detectDeviceCapabilities(options);
    this.strategy = selectExecutionStrategy(this.capabilities);
  }
  
  /**
   * Get detected device capabilities
   */
  getCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }
  
  /**
   * Get selected execution strategy
   */
  getStrategy(): ExecutionStrategy {
    return this.strategy;
  }
  
  /**
   * Get available execution options for UI display
   */
  getAvailableOptions(): ExecutionOption[] {
    return this.strategy.availableOptions.filter(opt => opt.available);
  }
  
  /**
   * Get all execution options (including unavailable ones)
   */
  getAllOptions(): ExecutionOption[] {
    return this.strategy.availableOptions;
  }
  
  /**
   * Get the recommended execution option
   */
  getRecommendedOption(): ExecutionOption | null {
    return this.strategy.availableOptions.find(opt => opt.recommended && opt.available) || null;
  }
  
  /**
   * Check if local execution is available
   */
  canRunLocally(): boolean {
    return this.capabilities.containerRuntime && this.capabilities.localhostPorts;
  }
  
  /**
   * Check if remote execution is available
   */
  canRunRemotely(): boolean {
    return this.capabilities.remoteExecutionAvailable;
  }
  
  /**
   * Check if browser execution is available
   */
  canRunInBrowser(): boolean {
    return this.capabilities.wasmSupport && this.capabilities.isBrowser;
  }
  
  /**
   * Check if any execution is available
   */
  canExecute(): boolean {
    return this.canRunLocally() || this.canRunRemotely() || this.canRunInBrowser();
  }
  
  /**
   * Check if device is mobile
   */
  isMobile(): boolean {
    return this.capabilities.platform === 'mobile';
  }
  
  /**
   * Check if device is tablet
   */
  isTablet(): boolean {
    return this.capabilities.platform === 'tablet';
  }
  
  /**
   * Check if device is desktop
   */
  isDesktop(): boolean {
    return this.capabilities.platform === 'desktop';
  }
  
  /**
   * Get preview URL format based on strategy
   */
  getPreviewUrlFormat(): 'localhost' | 'https' | 'embedded' | 'none' {
    return this.strategy.previewType;
  }
  
  /**
   * Generate a preview URL based on the execution context
   */
  generatePreviewUrl(options: {
    sessionId: string;
    port?: number;
    baseRemoteUrl?: string;
  }): string | null {
    const { sessionId, port = 3000, baseRemoteUrl = DEFAULT_REMOTE_PREVIEW_URL } = options;
    
    switch (this.strategy.previewType) {
      case 'localhost':
        return `http://localhost:${port}`;
      case 'https':
        return `${baseRemoteUrl}/preview/session-${sessionId}`;
      case 'embedded':
        return `embedded://preview/${sessionId}`;
      case 'none':
        return null;
    }
  }
  
  /**
   * Select an execution option by ID
   */
  selectOption(optionId: string): ExecutionOption | null {
    const option = this.strategy.availableOptions.find(opt => opt.id === optionId);
    if (!option || !option.available) {
      return null;
    }
    return option;
  }
  
  /**
   * Refresh capabilities (e.g., after agent connection)
   */
  refresh(options: {
    localAgentAvailable?: boolean;
    containerRuntimeAvailable?: boolean;
    remoteExecutionAvailable?: boolean;
  }): void {
    this.capabilities = detectDeviceCapabilities({
      userAgent: this.capabilities.userAgent || undefined,
      ...options,
    });
    this.strategy = selectExecutionStrategy(this.capabilities);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a capability profile for a specific device type (for testing)
 */
export function createMockCapabilities(type: 'desktop-full' | 'desktop-browser' | 'mobile' | 'tablet'): DeviceCapabilities {
  switch (type) {
    case 'desktop-full':
      return {
        platform: 'desktop',
        browser: 'chrome',
        isBrowser: true,
        localFilesystem: true,
        containerRuntime: true,
        localhostPorts: true,
        backgroundExecution: true,
        wasmSupport: true,
        remoteExecutionAvailable: true,
        serviceWorkerSupport: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      };
    
    case 'desktop-browser':
      return {
        platform: 'desktop',
        browser: 'chrome',
        isBrowser: true,
        localFilesystem: false,
        containerRuntime: false,
        localhostPorts: false,
        backgroundExecution: true,
        wasmSupport: true,
        remoteExecutionAvailable: true,
        serviceWorkerSupport: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      };
    
    case 'mobile':
      return {
        platform: 'mobile',
        browser: 'safari',
        isBrowser: true,
        localFilesystem: false,
        containerRuntime: false,
        localhostPorts: false,
        backgroundExecution: false,
        wasmSupport: true,
        remoteExecutionAvailable: true,
        serviceWorkerSupport: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
      };
    
    case 'tablet':
      return {
        platform: 'tablet',
        browser: 'safari',
        isBrowser: true,
        localFilesystem: false,
        containerRuntime: false,
        localhostPorts: false,
        backgroundExecution: false,
        wasmSupport: true,
        remoteExecutionAvailable: true,
        serviceWorkerSupport: true,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/605.1.15',
      };
  }
}

/**
 * Get a human-readable description of the execution strategy
 */
export function describeStrategy(strategy: ExecutionStrategy): string {
  const availableCount = strategy.availableOptions.filter(opt => opt.available).length;
  const recommended = strategy.availableOptions.find(opt => opt.recommended);
  
  let description = `Execution Mode: ${strategy.mode}\n`;
  description += `Provider: ${strategy.provider}\n`;
  description += `Preview: ${strategy.previewType}\n`;
  description += `Reason: ${strategy.selectionReason}\n`;
  description += `Available Options: ${availableCount}/${strategy.availableOptions.length}\n`;
  
  if (recommended) {
    description += `Recommended: ${recommended.label}`;
  }
  
  return description;
}
