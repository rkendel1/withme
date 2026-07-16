/**
 * Repository Acquisition Tests
 * 
 * Tests for the local repository acquisition pipeline.
 */

import { describe, it, expect } from 'vitest';
import { resolveSource, isUrlInput } from '../services/acquisition/resolver';
import { sha256, createContentHash, detectChanges } from '../services/acquisition/contentHash';
import type { ContentHash } from '../types/acquisition';

describe('Repository Acquisition', () => {
  describe('Resolver', () => {
    describe('resolveSource', () => {
      it('should resolve GitHub URLs', () => {
        const result = resolveSource({ input: 'https://github.com/facebook/react' });
        expect(result).not.toBeNull();
        expect(result?.strategy).toBe('github-api');
        expect(result?.source).toBe('github');
        expect(result?.details.type).toBe('github');
        if (result?.details.type === 'github') {
          expect(result.details.owner).toBe('facebook');
          expect(result.details.repo).toBe('react');
        }
      });

      it('should resolve GitHub short format', () => {
        const result = resolveSource({ input: 'facebook/react' });
        expect(result).not.toBeNull();
        expect(result?.strategy).toBe('github-api');
        expect(result?.source).toBe('github');
      });

      it('should resolve GitLab URLs', () => {
        const result = resolveSource({ input: 'https://gitlab.com/gitlab-org/gitlab' });
        expect(result).not.toBeNull();
        expect(result?.strategy).toBe('gitlab-api');
        expect(result?.source).toBe('gitlab');
        expect(result?.details.type).toBe('gitlab');
        if (result?.details.type === 'gitlab') {
          expect(result.details.host).toBe('gitlab.com');
          expect(result.details.projectPath).toBe('gitlab-org/gitlab');
        }
      });

      it('should resolve ZIP files', () => {
        const zipFile = new File(['test'], 'repo.zip', { type: 'application/zip' });
        const result = resolveSource({ input: '', files: [zipFile] });
        expect(result).not.toBeNull();
        expect(result?.strategy).toBe('zip-import');
        expect(result?.source).toBe('zip-archive');
        expect(result?.details.type).toBe('zip');
      });

      it('should resolve folder imports with multiple files', () => {
        const files = [
          new File(['content'], 'file1.ts'),
          new File(['content'], 'file2.ts'),
        ];
        const result = resolveSource({ input: '', files });
        expect(result).not.toBeNull();
        expect(result?.strategy).toBe('folder-import');
        expect(result?.source).toBe('local-folder');
        expect(result?.details.type).toBe('folder');
      });

      it('should return null for empty input', () => {
        const result = resolveSource({ input: '' });
        expect(result).toBeNull();
      });

      it('should return null for invalid URLs', () => {
        const result = resolveSource({ input: 'not-a-valid-url' });
        expect(result).toBeNull();
      });
    });

    describe('isUrlInput', () => {
      it('should return true for HTTP URLs', () => {
        expect(isUrlInput('http://example.com')).toBe(true);
        expect(isUrlInput('https://example.com')).toBe(true);
      });

      it('should return true for GitHub URLs', () => {
        expect(isUrlInput('github.com/owner/repo')).toBe(true);
      });

      it('should return true for owner/repo format', () => {
        expect(isUrlInput('facebook/react')).toBe(true);
      });

      it('should return false for plain text', () => {
        expect(isUrlInput('just some text')).toBe(false);
      });
    });
  });

  describe('Content Hash', () => {
    describe('sha256', () => {
      it('should generate consistent hashes', async () => {
        const hash1 = await sha256('test content');
        const hash2 = await sha256('test content');
        expect(hash1).toBe(hash2);
      });

      it('should generate different hashes for different content', async () => {
        const hash1 = await sha256('content 1');
        const hash2 = await sha256('content 2');
        expect(hash1).not.toBe(hash2);
      });

      it('should return 64 character hex string', async () => {
        const hash = await sha256('test');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    describe('createContentHash', () => {
      it('should create a content hash object', async () => {
        const hash = await createContentHash('src/index.ts', 'console.log("hello")', 20);
        expect(hash.path).toBe('src/index.ts');
        expect(hash.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(hash.sizeBytes).toBe(20);
        expect(hash.gitBlobSha).toBeNull();
      });

      it('should include git blob SHA when provided', async () => {
        const hash = await createContentHash('src/index.ts', 'content', 7, 'abc123');
        expect(hash.gitBlobSha).toBe('abc123');
      });

      it('should handle null content', async () => {
        const hash = await createContentHash('binary.png', null, 1000);
        expect(hash.path).toBe('binary.png');
        expect(hash.sha256).toBeDefined();
      });
    });

    describe('detectChanges', () => {
      it('should detect added files', () => {
        const current = new Map<string, ContentHash>([
          ['new-file.ts', { path: 'new-file.ts', sha256: 'abc', gitBlobSha: null, sizeBytes: 100 }],
        ]);
        const cached = new Map<string, ContentHash>();

        const changes = detectChanges(current, cached);
        expect(changes.added).toContain('new-file.ts');
        expect(changes.modified).toHaveLength(0);
        expect(changes.deleted).toHaveLength(0);
      });

      it('should detect modified files', () => {
        const current = new Map<string, ContentHash>([
          ['file.ts', { path: 'file.ts', sha256: 'new-hash', gitBlobSha: null, sizeBytes: 100 }],
        ]);
        const cached = new Map<string, ContentHash>([
          ['file.ts', { path: 'file.ts', sha256: 'old-hash', gitBlobSha: null, sizeBytes: 100 }],
        ]);

        const changes = detectChanges(current, cached);
        expect(changes.modified).toContain('file.ts');
        expect(changes.added).toHaveLength(0);
        expect(changes.deleted).toHaveLength(0);
      });

      it('should detect deleted files', () => {
        const current = new Map<string, ContentHash>();
        const cached = new Map<string, ContentHash>([
          ['deleted.ts', { path: 'deleted.ts', sha256: 'hash', gitBlobSha: null, sizeBytes: 100 }],
        ]);

        const changes = detectChanges(current, cached);
        expect(changes.deleted).toContain('deleted.ts');
        expect(changes.added).toHaveLength(0);
        expect(changes.modified).toHaveLength(0);
      });

      it('should detect unchanged files', () => {
        const hash: ContentHash = { path: 'file.ts', sha256: 'same-hash', gitBlobSha: null, sizeBytes: 100 };
        const current = new Map<string, ContentHash>([['file.ts', hash]]);
        const cached = new Map<string, ContentHash>([['file.ts', hash]]);

        const changes = detectChanges(current, cached);
        expect(changes.unchanged).toContain('file.ts');
        expect(changes.added).toHaveLength(0);
        expect(changes.modified).toHaveLength(0);
        expect(changes.deleted).toHaveLength(0);
      });

      it('should handle complex change scenarios', () => {
        const current = new Map<string, ContentHash>([
          ['unchanged.ts', { path: 'unchanged.ts', sha256: 'hash1', gitBlobSha: null, sizeBytes: 100 }],
          ['modified.ts', { path: 'modified.ts', sha256: 'new-hash', gitBlobSha: null, sizeBytes: 100 }],
          ['added.ts', { path: 'added.ts', sha256: 'hash3', gitBlobSha: null, sizeBytes: 100 }],
        ]);
        const cached = new Map<string, ContentHash>([
          ['unchanged.ts', { path: 'unchanged.ts', sha256: 'hash1', gitBlobSha: null, sizeBytes: 100 }],
          ['modified.ts', { path: 'modified.ts', sha256: 'old-hash', gitBlobSha: null, sizeBytes: 100 }],
          ['deleted.ts', { path: 'deleted.ts', sha256: 'hash4', gitBlobSha: null, sizeBytes: 100 }],
        ]);

        const changes = detectChanges(current, cached);
        expect(changes.added).toContain('added.ts');
        expect(changes.modified).toContain('modified.ts');
        expect(changes.deleted).toContain('deleted.ts');
        expect(changes.unchanged).toContain('unchanged.ts');
      });
    });
  });

  describe('Acquisition Types', () => {
    it('should have correct default exclude patterns', async () => {
      const { DEFAULT_EXCLUDE_PATTERNS } = await import('../types/acquisition');
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('node_modules/**');
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('.git/**');
      expect(DEFAULT_EXCLUDE_PATTERNS).toContain('dist/**');
    });

    it('should have correct binary extensions', async () => {
      const { BINARY_EXTENSIONS } = await import('../types/acquisition');
      expect(BINARY_EXTENSIONS.has('png')).toBe(true);
      expect(BINARY_EXTENSIONS.has('jpg')).toBe(true);
      expect(BINARY_EXTENSIONS.has('wasm')).toBe(true);
      expect(BINARY_EXTENSIONS.has('zip')).toBe(true);
    });

    it('should have correct max file size default', async () => {
      const { DEFAULT_MAX_FILE_SIZE } = await import('../types/acquisition');
      expect(DEFAULT_MAX_FILE_SIZE).toBe(100 * 1024);
    });
  });
});
