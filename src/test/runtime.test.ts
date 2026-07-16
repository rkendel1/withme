import { describe, it, expect } from 'vitest';
import {
  detectRuntime,
  detectPackageManager,
  detectFramework,
  detectEnvironmentVariables,
  detectPorts,
  detectRuntimeProfile,
} from '../services/runtime/runtimeDetector';
import type { RepoFile, Dependency } from '../types';

// Helper to create mock files
function createMockFile(path: string, content?: string): RepoFile {
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : null;
  return {
    id: Math.random(),
    repositoryId: 1,
    path,
    name,
    extension: ext,
    language: null,
    size: content?.length || 0,
    content: content || null,
    sha: null,
    createdAt: new Date(),
  };
}

// Helper to create mock dependencies
function createMockDependency(name: string, ecosystem: string, version?: string): Dependency {
  return {
    id: Math.random(),
    repositoryId: 1,
    name,
    version: version || '1.0.0',
    type: 'production',
    ecosystem,
  };
}

describe('Runtime Detection', () => {
  describe('detectRuntime', () => {
    it('should detect Node.js runtime from package.json', () => {
      const files = [createMockFile('package.json', '{}')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['package.json']), filePaths: new Set(['package.json']), extensions: new Map() };
      
      const result = detectRuntime(context);
      expect(result.runtime).toBe('node');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Python runtime from requirements.txt', () => {
      const files = [createMockFile('requirements.txt', 'flask==2.0.0')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['requirements.txt']), filePaths: new Set(['requirements.txt']), extensions: new Map() };
      
      const result = detectRuntime(context);
      expect(result.runtime).toBe('python');
    });

    it('should detect Rust runtime from Cargo.toml', () => {
      const files = [createMockFile('Cargo.toml', '[package]')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['Cargo.toml']), filePaths: new Set(['Cargo.toml']), extensions: new Map() };
      
      const result = detectRuntime(context);
      expect(result.runtime).toBe('rust');
    });

    it('should detect Go runtime from go.mod', () => {
      const files = [createMockFile('go.mod', 'module example.com')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['go.mod']), filePaths: new Set(['go.mod']), extensions: new Map() };
      
      const result = detectRuntime(context);
      expect(result.runtime).toBe('go');
    });

    it('should return unknown for empty repository', () => {
      const files: RepoFile[] = [];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set<string>(), filePaths: new Set<string>(), extensions: new Map() };
      
      const result = detectRuntime(context);
      expect(result.runtime).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm from pnpm-lock.yaml', () => {
      const files = [createMockFile('pnpm-lock.yaml'), createMockFile('package.json')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['pnpm-lock.yaml', 'package.json']), filePaths: new Set(['pnpm-lock.yaml', 'package.json']), extensions: new Map() };
      
      const result = detectPackageManager(context, 'node');
      expect(result.manager).toBe('pnpm');
      expect(result.lockFile).toBe('pnpm-lock.yaml');
      expect(result.installCommand).toBe('pnpm install');
    });

    it('should detect yarn from yarn.lock', () => {
      const files = [createMockFile('yarn.lock'), createMockFile('package.json')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['yarn.lock', 'package.json']), filePaths: new Set(['yarn.lock', 'package.json']), extensions: new Map() };
      
      const result = detectPackageManager(context, 'node');
      expect(result.manager).toBe('yarn');
      expect(result.lockFile).toBe('yarn.lock');
    });

    it('should detect npm from package-lock.json', () => {
      const files = [createMockFile('package-lock.json'), createMockFile('package.json')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['package-lock.json', 'package.json']), filePaths: new Set(['package-lock.json', 'package.json']), extensions: new Map() };
      
      const result = detectPackageManager(context, 'node');
      expect(result.manager).toBe('npm');
    });

    it('should detect pip from requirements.txt', () => {
      const files = [createMockFile('requirements.txt')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['requirements.txt']), filePaths: new Set(['requirements.txt']), extensions: new Map() };
      
      const result = detectPackageManager(context, 'python');
      expect(result.manager).toBe('pip');
    });

    it('should detect cargo from Cargo.toml', () => {
      const files = [createMockFile('Cargo.toml')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['Cargo.toml']), filePaths: new Set(['Cargo.toml']), extensions: new Map() };
      
      const result = detectPackageManager(context, 'rust');
      expect(result.manager).toBe('cargo');
    });
  });

  describe('detectFramework', () => {
    it('should detect Next.js from dependencies', () => {
      const files = [createMockFile('package.json')];
      const dependencies = [createMockDependency('next', 'npm')];
      const context = { files, dependencies, fileNames: new Set(['package.json']), filePaths: new Set(['package.json']), extensions: new Map() };
      
      const result = detectFramework(context, 'node');
      expect(result.framework).toBe('nextjs');
      expect(result.port).toBe(3000);
    });

    it('should detect Vite from dependencies', () => {
      const files = [createMockFile('package.json')];
      const dependencies = [createMockDependency('vite', 'npm')];
      const context = { files, dependencies, fileNames: new Set(['package.json']), filePaths: new Set(['package.json']), extensions: new Map() };
      
      const result = detectFramework(context, 'node');
      expect(result.framework).toBe('vite');
      expect(result.port).toBe(5173);
    });

    it('should detect React from dependencies', () => {
      const files = [createMockFile('package.json')];
      const dependencies = [
        createMockDependency('react', 'npm'),
        createMockDependency('react-dom', 'npm'),
      ];
      const context = { files, dependencies, fileNames: new Set(['package.json']), filePaths: new Set(['package.json']), extensions: new Map() };
      
      const result = detectFramework(context, 'node');
      expect(result.framework).toBe('react');
    });

    it('should detect Django from manage.py file', () => {
      const files = [createMockFile('manage.py')];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['manage.py']), filePaths: new Set(['manage.py']), extensions: new Map() };
      
      const result = detectFramework(context, 'python');
      expect(result.framework).toBe('django');
      expect(result.port).toBe(8000);
    });

    it('should return null framework for unknown', () => {
      const files: RepoFile[] = [];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set<string>(), filePaths: new Set<string>(), extensions: new Map() };
      
      const result = detectFramework(context, 'node');
      expect(result.framework).toBeNull();
    });
  });

  describe('detectEnvironmentVariables', () => {
    it('should extract env vars from .env.example', () => {
      const files = [createMockFile('.env.example', `
DATABASE_URL=postgres://localhost
API_KEY=
DEBUG=true
`)];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['.env.example']), filePaths: new Set(['.env.example']), extensions: new Map() };
      
      const result = detectEnvironmentVariables(context);
      expect(result.DATABASE_URL).toBe('postgres://localhost');
      expect(result.API_KEY).toBe('');
      expect(result.DEBUG).toBe('true');
    });

    it('should skip comments in env files', () => {
      const files = [createMockFile('.env.example', `
# This is a comment
DATABASE_URL=value
# Another comment
`)];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['.env.example']), filePaths: new Set(['.env.example']), extensions: new Map() };
      
      const result = detectEnvironmentVariables(context);
      expect(Object.keys(result)).toHaveLength(1);
      expect(result.DATABASE_URL).toBe('value');
    });
  });

  describe('detectPorts', () => {
    it('should detect ports from Dockerfile', () => {
      const files = [createMockFile('Dockerfile', `
FROM node:18
EXPOSE 3000
EXPOSE 8080
`)];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set(['Dockerfile']), filePaths: new Set(['Dockerfile']), extensions: new Map() };
      
      const result = detectPorts(context, null);
      expect(result).toContain(3000);
      expect(result).toContain(8080);
    });

    it('should use framework default port', () => {
      const files: RepoFile[] = [];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set<string>(), filePaths: new Set<string>(), extensions: new Map() };
      
      const result = detectPorts(context, 'nextjs');
      expect(result).toContain(3000);
    });

    it('should default to 3000 if nothing detected', () => {
      const files: RepoFile[] = [];
      const dependencies: Dependency[] = [];
      const context = { files, dependencies, fileNames: new Set<string>(), filePaths: new Set<string>(), extensions: new Map() };
      
      const result = detectPorts(context, null);
      expect(result).toContain(3000);
    });
  });

  describe('detectRuntimeProfile (full detection)', () => {
    it('should detect full profile for Next.js project', () => {
      const files = [
        createMockFile('package.json', JSON.stringify({
          scripts: { dev: 'next dev', start: 'next start' },
          engines: { node: '18.0.0' },
        })),
        createMockFile('pnpm-lock.yaml'),
      ];
      const dependencies = [
        createMockDependency('next', 'npm', '14.0.0'),
        createMockDependency('react', 'npm'),
      ];
      
      const result = detectRuntimeProfile(files, dependencies);
      
      expect(result.runtime).toBe('node');
      expect(result.version).toBe('18.0.0');
      expect(result.packageManager).toBe('pnpm');
      expect(result.framework).toBe('nextjs');
      expect(result.ports).toContain(3000);
      expect(result.installCommand).toBe('pnpm install');
    });

    it('should detect full profile for Python Django project', () => {
      const files = [
        createMockFile('requirements.txt', 'django==4.0.0'),
        createMockFile('manage.py', 'import django'),
      ];
      const dependencies: Dependency[] = [];
      
      const result = detectRuntimeProfile(files, dependencies);
      
      expect(result.runtime).toBe('python');
      expect(result.packageManager).toBe('pip');
      expect(result.framework).toBe('django');
      expect(result.ports).toContain(8000);
      expect(result.installCommand).toBe('pip install -r requirements.txt');
    });

    it('should detect full profile for Rust project', () => {
      const files = [
        createMockFile('Cargo.toml', '[package]'),
        createMockFile('Cargo.lock'),
      ];
      const dependencies: Dependency[] = [];
      
      const result = detectRuntimeProfile(files, dependencies);
      
      expect(result.runtime).toBe('rust');
      expect(result.packageManager).toBe('cargo');
      expect(result.installCommand).toBe('cargo build');
      expect(result.startCommand).toBe('cargo run');
    });
  });
});
