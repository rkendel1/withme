import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  detectBrowser,
  detectDeviceCapabilities,
  selectExecutionStrategy,
  RuntimeProviderSelector,
  createMockCapabilities,
  describeStrategy,
} from '../services/runtime/deviceCapabilities';

describe('Device Capability Detection', () => {
  describe('detectPlatform', () => {
    it('should detect desktop from Chrome on Mac user agent', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const platform = detectPlatform(ua);
      expect(platform).toBe('desktop');
    });

    it('should detect desktop from Firefox on Windows user agent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const platform = detectPlatform(ua);
      expect(platform).toBe('desktop');
    });

    it('should detect mobile from iPhone user agent', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const platform = detectPlatform(ua);
      expect(platform).toBe('mobile');
    });

    it('should detect mobile from Android phone user agent', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const platform = detectPlatform(ua);
      expect(platform).toBe('mobile');
    });

    it('should detect tablet from iPad user agent', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const platform = detectPlatform(ua);
      expect(platform).toBe('tablet');
    });

    it('should detect tablet from Android tablet user agent', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 12; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const platform = detectPlatform(ua);
      expect(platform).toBe('tablet');
    });

    it('should default to desktop for empty user agent', () => {
      const platform = detectPlatform('');
      expect(platform).toBe('desktop');
    });
  });

  describe('detectBrowser', () => {
    it('should detect Chrome browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const browser = detectBrowser(ua);
      expect(browser).toBe('chrome');
    });

    it('should detect Firefox browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const browser = detectBrowser(ua);
      expect(browser).toBe('firefox');
    });

    it('should detect Safari browser', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      const browser = detectBrowser(ua);
      expect(browser).toBe('safari');
    });

    it('should detect Edge browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const browser = detectBrowser(ua);
      expect(browser).toBe('edge');
    });

    it('should detect Opera browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';
      const browser = detectBrowser(ua);
      expect(browser).toBe('opera');
    });

    it('should return unknown for unrecognized user agent', () => {
      const ua = 'CustomBot/1.0';
      const browser = detectBrowser(ua);
      expect(browser).toBe('unknown');
    });
  });

  describe('detectDeviceCapabilities', () => {
    it('should detect full capabilities for desktop with local agent', () => {
      const capabilities = detectDeviceCapabilities({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
        localAgentAvailable: true,
        containerRuntimeAvailable: true,
        remoteExecutionAvailable: true,
      });

      expect(capabilities.platform).toBe('desktop');
      expect(capabilities.localFilesystem).toBe(true);
      expect(capabilities.containerRuntime).toBe(true);
      expect(capabilities.localhostPorts).toBe(true);
      expect(capabilities.backgroundExecution).toBe(true);
      expect(capabilities.remoteExecutionAvailable).toBe(true);
    });

    it('should detect limited capabilities for desktop browser without local agent', () => {
      const capabilities = detectDeviceCapabilities({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      expect(capabilities.platform).toBe('desktop');
      expect(capabilities.localFilesystem).toBe(false);
      expect(capabilities.containerRuntime).toBe(false);
      expect(capabilities.localhostPorts).toBe(false);
      expect(capabilities.backgroundExecution).toBe(true);
      expect(capabilities.remoteExecutionAvailable).toBe(true);
    });

    it('should detect mobile capabilities', () => {
      const capabilities = detectDeviceCapabilities({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      expect(capabilities.platform).toBe('mobile');
      expect(capabilities.localFilesystem).toBe(false);
      expect(capabilities.containerRuntime).toBe(false);
      expect(capabilities.localhostPorts).toBe(false);
      expect(capabilities.backgroundExecution).toBe(false);
      expect(capabilities.remoteExecutionAvailable).toBe(true);
    });
  });

  describe('selectExecutionStrategy', () => {
    it('should select local mode for desktop with full capabilities', () => {
      const capabilities = createMockCapabilities('desktop-full');
      const strategy = selectExecutionStrategy(capabilities);

      expect(strategy.mode).toBe('local');
      expect(strategy.provider).toBe('local-agent');
      expect(strategy.previewType).toBe('localhost');
      expect(strategy.selectionReason).toContain('local');
    });

    it('should select remote mode for desktop browser without local agent', () => {
      const capabilities = createMockCapabilities('desktop-browser');
      const strategy = selectExecutionStrategy(capabilities);

      expect(strategy.mode).toBe('remote');
      expect(strategy.provider).toBe('remote-sandbox');
      expect(strategy.previewType).toBe('https');
    });

    it('should select remote mode for mobile device', () => {
      const capabilities = createMockCapabilities('mobile');
      const strategy = selectExecutionStrategy(capabilities);

      expect(strategy.mode).toBe('remote');
      expect(strategy.provider).toBe('remote-sandbox');
      expect(strategy.previewType).toBe('https');
      expect(strategy.selectionReason).toContain('Mobile');
    });

    it('should select remote mode for tablet device', () => {
      const capabilities = createMockCapabilities('tablet');
      const strategy = selectExecutionStrategy(capabilities);

      expect(strategy.mode).toBe('remote');
      expect(strategy.provider).toBe('remote-sandbox');
      expect(strategy.previewType).toBe('https');
      expect(strategy.selectionReason).toContain('Tablet');
    });

    it('should select analysis mode when no execution is available', () => {
      const capabilities: ReturnType<typeof createMockCapabilities> = {
        ...createMockCapabilities('mobile'),
        remoteExecutionAvailable: false,
        wasmSupport: false,
      };
      const strategy = selectExecutionStrategy(capabilities);

      expect(strategy.mode).toBe('analysis');
      expect(strategy.provider).toBe('analysis-only');
      expect(strategy.previewType).toBe('none');
    });

    it('should include available options in strategy', () => {
      const capabilities = createMockCapabilities('mobile');
      const strategy = selectExecutionStrategy(capabilities);

      expect(strategy.availableOptions).toBeDefined();
      expect(strategy.availableOptions.length).toBeGreaterThan(0);
      
      // Check that remote-sandbox is available
      const remoteOption = strategy.availableOptions.find(opt => opt.id === 'remote-sandbox');
      expect(remoteOption).toBeDefined();
      expect(remoteOption?.available).toBe(true);
      
      // Check that local-container is unavailable on mobile
      const localOption = strategy.availableOptions.find(opt => opt.id === 'local-container');
      expect(localOption).toBeDefined();
      expect(localOption?.available).toBe(false);
    });
  });

  describe('RuntimeProviderSelector', () => {
    it('should create selector with device capabilities', () => {
      const selector = new RuntimeProviderSelector({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
        localAgentAvailable: true,
        containerRuntimeAvailable: true,
        remoteExecutionAvailable: true,
      });

      expect(selector.canRunLocally()).toBe(true);
      expect(selector.canRunRemotely()).toBe(true);
      expect(selector.isDesktop()).toBe(true);
      expect(selector.isMobile()).toBe(false);
    });

    it('should detect mobile device correctly', () => {
      const selector = new RuntimeProviderSelector({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      expect(selector.canRunLocally()).toBe(false);
      expect(selector.canRunRemotely()).toBe(true);
      expect(selector.isMobile()).toBe(true);
      expect(selector.isDesktop()).toBe(false);
    });

    it('should return available options', () => {
      const selector = new RuntimeProviderSelector({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      const options = selector.getAvailableOptions();
      expect(options.length).toBeGreaterThan(0);
      expect(options.every(opt => opt.available)).toBe(true);
    });

    it('should return recommended option', () => {
      const selector = new RuntimeProviderSelector({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      const recommended = selector.getRecommendedOption();
      expect(recommended).toBeDefined();
      expect(recommended?.available).toBe(true);
      expect(recommended?.recommended).toBe(true);
    });

    it('should generate correct preview URL format for desktop', () => {
      const selector = new RuntimeProviderSelector({
        localAgentAvailable: true,
        containerRuntimeAvailable: true,
        remoteExecutionAvailable: true,
      });

      const url = selector.generatePreviewUrl({ sessionId: 'test-session', port: 3000 });
      expect(url).toBe('http://localhost:3000');
    });

    it('should generate correct preview URL format for mobile', () => {
      const selector = new RuntimeProviderSelector({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      const url = selector.generatePreviewUrl({ sessionId: 'test-session' });
      expect(url).toContain('https://');
      expect(url).toContain('test-session');
    });

    it('should allow selecting specific option', () => {
      const selector = new RuntimeProviderSelector({
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      const option = selector.selectOption('remote-sandbox');
      expect(option).toBeDefined();
      expect(option?.id).toBe('remote-sandbox');
      expect(option?.available).toBe(true);
    });

    it('should return null for unavailable option', () => {
      const selector = new RuntimeProviderSelector({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      const option = selector.selectOption('local-container');
      expect(option).toBeNull();
    });

    it('should refresh capabilities', () => {
      const selector = new RuntimeProviderSelector({
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      expect(selector.canRunLocally()).toBe(false);

      selector.refresh({
        localAgentAvailable: true,
        containerRuntimeAvailable: true,
      });

      expect(selector.canRunLocally()).toBe(true);
    });

    it('should check if any execution is possible', () => {
      const selector = new RuntimeProviderSelector({
        localAgentAvailable: false,
        containerRuntimeAvailable: false,
        remoteExecutionAvailable: true,
      });

      expect(selector.canExecute()).toBe(true);
    });
  });

  describe('createMockCapabilities', () => {
    it('should create desktop-full capabilities', () => {
      const caps = createMockCapabilities('desktop-full');
      expect(caps.platform).toBe('desktop');
      expect(caps.containerRuntime).toBe(true);
      expect(caps.localFilesystem).toBe(true);
      expect(caps.localhostPorts).toBe(true);
    });

    it('should create desktop-browser capabilities', () => {
      const caps = createMockCapabilities('desktop-browser');
      expect(caps.platform).toBe('desktop');
      expect(caps.containerRuntime).toBe(false);
      expect(caps.localFilesystem).toBe(false);
      expect(caps.localhostPorts).toBe(false);
    });

    it('should create mobile capabilities', () => {
      const caps = createMockCapabilities('mobile');
      expect(caps.platform).toBe('mobile');
      expect(caps.containerRuntime).toBe(false);
      expect(caps.backgroundExecution).toBe(false);
    });

    it('should create tablet capabilities', () => {
      const caps = createMockCapabilities('tablet');
      expect(caps.platform).toBe('tablet');
      expect(caps.containerRuntime).toBe(false);
    });
  });

  describe('describeStrategy', () => {
    it('should describe strategy with all components', () => {
      const capabilities = createMockCapabilities('mobile');
      const strategy = selectExecutionStrategy(capabilities);
      const description = describeStrategy(strategy);

      expect(description).toContain('Execution Mode:');
      expect(description).toContain('Provider:');
      expect(description).toContain('Preview:');
      expect(description).toContain('Reason:');
      expect(description).toContain('Available Options:');
    });
  });
});
