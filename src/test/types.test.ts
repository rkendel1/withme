import { describe, it, expect } from 'vitest';
import type { LLMConfig, Repository, RepoFile, Symbol, SymbolKind } from '../types';

describe('Types', () => {
  it('should create valid LLMConfig', () => {
    const config: LLMConfig = {
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
    };

    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });

  it('should create valid Repository', () => {
    const repo: Repository = {
      id: 1,
      name: 'react',
      fullName: 'facebook/react',
      description: 'A JavaScript library',
      url: 'https://github.com/facebook/react',
      defaultBranch: 'main',
      language: 'JavaScript',
      createdAt: new Date(),
      updatedAt: new Date(),
      ingestedAt: new Date(),
    };

    expect(repo.fullName).toBe('facebook/react');
    expect(repo.id).toBe(1);
  });

  it('should create valid RepoFile', () => {
    const file: RepoFile = {
      id: 1,
      repositoryId: 1,
      path: 'src/index.ts',
      name: 'index.ts',
      extension: 'ts',
      language: 'TypeScript',
      size: 1000,
      content: 'export const x = 1;',
      sha: 'abc123',
      createdAt: new Date(),
    };

    expect(file.path).toBe('src/index.ts');
    expect(file.language).toBe('TypeScript');
  });

  it('should create valid Symbol', () => {
    const symbol: Symbol = {
      id: 1,
      fileId: 1,
      repositoryId: 1,
      name: 'MyComponent',
      kind: 'function' as SymbolKind,
      startLine: 10,
      endLine: 25,
      signature: 'function MyComponent(): JSX.Element',
      docstring: 'A React component',
    };

    expect(symbol.kind).toBe('function');
    expect(symbol.name).toBe('MyComponent');
  });
});
