/**
 * Tests for Architecture Detection and Analysis
 */

import { describe, it, expect } from 'vitest';

// Import detection functions for testing
import { detectTechnologies, detectDatastores, detectQueues, type DetectionContext } from '../services/architecture/technologyDetector';
import { detectServices, detectApiEndpoints, detectArchitectureStyle } from '../services/architecture/serviceDetector';
import { detectLayers, classifyFileLayer } from '../services/architecture/layerDetector';
import { detectEntryPoints } from '../services/architecture/entryPointDetector';
import { detectIntent } from '../services/architecture/architecturePlanner';
import type { RepoFile, Dependency } from '../types';
import type { Service } from '../types/architecture';

// Helper to create mock RepoFile
function createMockFile(path: string, content: string | null = null): RepoFile {
  return {
    id: 1,
    repositoryId: 1,
    path,
    name: path.split('/').pop() || path,
    extension: path.split('.').pop() || null,
    language: null,
    size: content?.length || 0,
    content,
    sha: null,
    createdAt: new Date(),
  };
}

// Helper to create mock Dependency
function createMockDependency(
  name: string, 
  version: string, 
  type: 'production' | 'development' = 'production'
): Dependency {
  return {
    id: 1,
    repositoryId: 1,
    name,
    version,
    type,
    ecosystem: 'npm',
  };
}

// Helper to create DetectionContext
function createContext(files: RepoFile[], deps: Dependency[]): DetectionContext {
  return { files, dependencies: deps };
}

describe('Technology Detector', () => {
  describe('detectTechnologies', () => {
    it('should detect React from dependencies', () => {
      const context = createContext([], [createMockDependency('react', '18.2.0')]);
      
      const result = detectTechnologies(context, 1);
      
      expect(result.some(t => t.name === 'React')).toBe(true);
    });

    it('should detect TypeScript from dependencies', () => {
      const context = createContext([], [createMockDependency('typescript', '5.0.0', 'development')]);
      
      const result = detectTechnologies(context, 1);
      
      expect(result.some(t => t.name === 'TypeScript')).toBe(true);
    });

    it('should detect Express from dependencies', () => {
      const context = createContext([], [createMockDependency('express', '4.18.0')]);
      
      const result = detectTechnologies(context, 1);
      
      expect(result.some(t => t.name === 'Express')).toBe(true);
    });

    it('should detect Docker from Dockerfile', () => {
      const context = createContext([createMockFile('Dockerfile', 'FROM node:18')], []);
      
      const result = detectTechnologies(context, 1);
      
      expect(result.some(t => t.name === 'Docker')).toBe(true);
    });
  });

  describe('detectDatastores', () => {
    it('should detect PostgreSQL from dependencies', () => {
      const context = createContext([], [createMockDependency('pg', '8.0.0')]);
      
      const result = detectDatastores(context, 1);
      
      expect(result.some(d => d.type === 'postgresql')).toBe(true);
    });

    it('should detect Redis from dependencies', () => {
      const context = createContext([], [createMockDependency('redis', '4.0.0')]);
      
      const result = detectDatastores(context, 1);
      
      expect(result.some(d => d.type === 'redis')).toBe(true);
    });

    it('should detect MongoDB from dependencies', () => {
      const context = createContext([], [createMockDependency('mongoose', '7.0.0')]);
      
      const result = detectDatastores(context, 1);
      
      expect(result.some(d => d.type === 'mongodb')).toBe(true);
    });
  });

  describe('detectQueues', () => {
    it('should detect RabbitMQ from dependencies', () => {
      const context = createContext([], [createMockDependency('amqplib', '0.10.0')]);
      
      const result = detectQueues(context, 1);
      
      expect(result.some(q => q.type === 'rabbitmq')).toBe(true);
    });

    it('should detect Kafka from dependencies', () => {
      const context = createContext([], [createMockDependency('kafkajs', '2.0.0')]);
      
      const result = detectQueues(context, 1);
      
      expect(result.some(q => q.type === 'kafka')).toBe(true);
    });
  });
});

describe('Service Detector', () => {
  describe('detectServices', () => {
    it('should detect REST API service from Express usage', () => {
      const context = createContext(
        [createMockFile('src/index.ts', `
          import express from 'express';
          const app = express();
          app.get('/api/users', handler);
        `)],
        [createMockDependency('express', '4.18.0')]
      );
      
      const result = detectServices(context, 1);
      
      expect(result.some(s => s.type === 'rest_api')).toBe(true);
    });

    it('should detect GraphQL service from Apollo usage', () => {
      const context = createContext(
        [createMockFile('src/server.ts', `
          import { ApolloServer } from '@apollo/server';
          const server = new ApolloServer({ typeDefs, resolvers });
        `)],
        [createMockDependency('@apollo/server', '4.0.0')]
      );
      
      const result = detectServices(context, 1);
      
      expect(result.some(s => s.type === 'graphql')).toBe(true);
    });

    it('should detect CLI service from Commander usage', () => {
      const context = createContext(
        [createMockFile('src/cli.ts', `
          import { Command } from 'commander';
          const program = new Command();
          program.command('start');
        `)],
        [createMockDependency('commander', '11.0.0')]
      );
      
      const result = detectServices(context, 1);
      
      expect(result.some(s => s.type === 'cli')).toBe(true);
    });
  });

  describe('detectApiEndpoints', () => {
    it('should extract Express routes', () => {
      const files = [
        createMockFile('src/routes.ts', `
          app.get('/api/users', getUsers);
          app.post('/api/users', createUser);
          router.delete('/api/users/:id', deleteUser);
        `),
      ];
      
      const result = detectApiEndpoints(files, 1);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(e => e.method === 'GET' && e.path === '/api/users')).toBe(true);
      expect(result.some(e => e.method === 'POST')).toBe(true);
    });
  });

  describe('detectArchitectureStyle', () => {
    it('should detect monolith for simple apps', () => {
      const services: { type: string; name: string }[] = [{ type: 'rest_api', name: 'API' }];
      const files = [createMockFile('src/index.ts')];
      
      const result = detectArchitectureStyle(services as Service[], files);
      
      expect(result).toBe('monolith');
    });
  });
});

describe('Layer Detector', () => {
  describe('classifyFileLayer', () => {
    it('should classify components as presentation layer', () => {
      expect(classifyFileLayer('src/components/Button.tsx')).toBe('presentation');
    });

    it('should classify pages as presentation layer', () => {
      expect(classifyFileLayer('src/pages/HomePage.tsx')).toBe('presentation');
    });

    it('should classify routes as API layer', () => {
      expect(classifyFileLayer('src/routes/users.ts')).toBe('api');
    });

    it('should classify controllers as API layer', () => {
      expect(classifyFileLayer('src/controllers/UserController.ts')).toBe('api');
    });

    it('should classify services as application layer', () => {
      expect(classifyFileLayer('src/services/UserService.ts')).toBe('application');
    });

    it('should classify models as domain layer', () => {
      expect(classifyFileLayer('src/models/User.ts')).toBe('domain');
    });

    it('should classify entities as domain layer', () => {
      expect(classifyFileLayer('src/entities/User.ts')).toBe('domain');
    });

    it('should classify db folder as database layer', () => {
      expect(classifyFileLayer('src/db/connection.ts')).toBe('database');
    });

    it('should classify repositories as database layer', () => {
      expect(classifyFileLayer('src/repositories/UserRepository.ts')).toBe('database');
    });
  });

  describe('detectLayers', () => {
    it('should detect multiple layers from file structure', () => {
      const files = [
        createMockFile('src/components/Button.tsx'),
        createMockFile('src/routes/api.ts'),
        createMockFile('src/services/UserService.ts'),
        createMockFile('src/models/User.ts'),
        createMockFile('src/db/index.ts'),
      ];
      
      const result = detectLayers(files, 1);
      
      expect(result.length).toBeGreaterThan(0);
      // Should detect presentation, api, application, domain, and infrastructure layers
      const types = result.map(l => l.type);
      expect(types).toContain('presentation');
      expect(types).toContain('api');
    });
  });
});

describe('Entry Point Detector', () => {
  describe('detectEntryPoints', () => {
    it('should return an array for any input', () => {
      const context = createContext([
        createMockFile('src/main.ts', `
          function main() {
            console.log('Starting...');
          }
          main();
        `),
      ], []);
      
      const result = detectEntryPoints(context, 1);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty file list gracefully', () => {
      const context = createContext([], []);
      
      const result = detectEntryPoints(context, 1);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});

describe('Architecture Planner', () => {
  describe('detectIntent', () => {
    it('should detect explain_architecture intent', () => {
      const result = detectIntent('Explain the architecture of this project');
      
      expect(result.intent).toBe('explain_architecture');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect draw_diagram intent', () => {
      const result = detectIntent('Draw a system diagram');
      
      expect(result.intent).toBe('draw_diagram');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect list_technologies intent', () => {
      const result = detectIntent('What technologies are used in this project?');
      
      expect(result.intent).toBe('list_technologies');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect show_dependencies intent', () => {
      const result = detectIntent('Show me the module dependencies');
      
      expect(result.intent).toBe('show_dependencies');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect trace_request intent', () => {
      const result = detectIntent('Trace the request flow for login');
      
      expect(result.intent).toBe('trace_request');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should default to general intent for unrecognized queries', () => {
      const result = detectIntent('random question about something');
      
      expect(result.intent).toBe('general');
    });
  });
});
