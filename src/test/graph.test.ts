/**
 * Graph Service Tests
 */

import { describe, it, expect } from 'vitest';

import type {
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphEdgeType,
} from '../types/graph';

import {
  buildGraphologyGraph,
  findShortestPath,
  findDependencies,
  findDependents,
  findCycles,
  hasCycles,
  findEntrypoints,
  findLeafNodes,
  findConnectedComponents,
  computeCentralityMetrics,
  analyzeImpact,
  computeGraphStats,
  extractSubgraph,
} from '../services/graph/algorithms';

import {
  extractCodeRelationships,
  extractInfrastructureRelationships,
  extractRuntimeRelationships,
  extractDocumentationRelationships,
  extractDependencyRelationships,
} from '../services/graph/extractors';

// ============================================================================
// Test Data
// ============================================================================

function createTestNode(
  id: number,
  type: GraphNodeType,
  name: string
): GraphNode {
  return {
    id,
    uuid: `uuid-${id}`,
    repositoryId: 1,
    type,
    name,
    description: null,
    filePath: null,
    startLine: null,
    endLine: null,
    language: null,
    metadata: {},
    tags: [],
    metrics: {},
    embedding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createTestEdge(
  id: number,
  sourceNodeId: number,
  targetNodeId: number,
  type: GraphEdgeType
): GraphEdge {
  return {
    id,
    repositoryId: 1,
    sourceNodeId,
    targetNodeId,
    type,
    weight: 1,
    metadata: {},
    createdAt: new Date(),
  };
}

// ============================================================================
// Graph Algorithms Tests
// ============================================================================

describe('Graph Algorithms', () => {
  describe('buildGraphologyGraph', () => {
    it('should build a graph from nodes and edges', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
      ];
      
      const result = buildGraphologyGraph(nodes, edges);
      
      expect(result.graph.order).toBe(3); // 3 nodes
      expect(result.graph.size).toBe(2); // 2 edges
      expect(result.nodeIdMap.size).toBe(3);
    });
    
    it('should handle empty graph', () => {
      const result = buildGraphologyGraph([], []);
      
      expect(result.graph.order).toBe(0);
      expect(result.graph.size).toBe(0);
    });
  });
  
  describe('findShortestPath', () => {
    it('should find shortest path between connected nodes', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
        createTestNode(4, 'file', 'd.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
        createTestEdge(3, 3, 4, 'imports'),
        createTestEdge(4, 1, 4, 'imports'), // Direct path
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const path = findShortestPath(graphologyGraph, 1, 4, nodes, edges);
      
      expect(path).not.toBeNull();
      expect(path!.length).toBe(1); // Direct path is shorter
    });
    
    it('should return null for disconnected nodes', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
      ];
      
      const edges: GraphEdge[] = [];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const path = findShortestPath(graphologyGraph, 1, 2, nodes, edges);
      
      expect(path).toBeNull();
    });
  });
  
  describe('findDependencies', () => {
    it('should find direct dependencies', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 1, 3, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const deps = findDependencies(graphologyGraph, 1, nodes, false);
      
      expect(deps.length).toBe(2);
      expect(deps.map(d => d.name)).toContain('b.ts');
      expect(deps.map(d => d.name)).toContain('c.ts');
    });
    
    it('should find transitive dependencies', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const deps = findDependencies(graphologyGraph, 1, nodes, true);
      
      expect(deps.length).toBe(2); // b.ts and c.ts
    });
  });
  
  describe('findDependents', () => {
    it('should find direct dependents', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 3, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const dependents = findDependents(graphologyGraph, 3, nodes, false);
      
      expect(dependents.length).toBe(2);
      expect(dependents.map(d => d.name)).toContain('a.ts');
      expect(dependents.map(d => d.name)).toContain('b.ts');
    });
  });
  
  describe('findCycles', () => {
    it('should detect cycles', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
        createTestEdge(3, 3, 1, 'imports'), // Creates cycle
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const cycles = findCycles(graphologyGraph, nodes, edges);
      
      expect(cycles.length).toBeGreaterThan(0);
    });
    
    it('should not detect cycles in acyclic graph', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const cycles = findCycles(graphologyGraph, nodes, edges);
      
      expect(cycles.length).toBe(0);
    });
  });
  
  describe('hasCycles', () => {
    it('should return true for cyclic graph', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 1, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      expect(hasCycles(graphologyGraph)).toBe(true);
    });
    
    it('should return false for acyclic graph', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      expect(hasCycles(graphologyGraph)).toBe(false);
    });
  });
  
  describe('findEntrypoints', () => {
    it('should find nodes with no incoming edges', () => {
      const nodes = [
        createTestNode(1, 'file', 'main.ts'),
        createTestNode(2, 'file', 'utils.ts'),
        createTestNode(3, 'file', 'helpers.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 1, 3, 'imports'),
        createTestEdge(3, 2, 3, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const entryPoints = findEntrypoints(graphologyGraph, nodes);
      
      expect(entryPoints.length).toBe(1);
      expect(entryPoints[0].name).toBe('main.ts');
    });
  });
  
  describe('findLeafNodes', () => {
    it('should find nodes with no outgoing edges', () => {
      const nodes = [
        createTestNode(1, 'file', 'main.ts'),
        createTestNode(2, 'file', 'utils.ts'),
        createTestNode(3, 'file', 'constants.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 2, 3, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const leafNodes = findLeafNodes(graphologyGraph, nodes);
      
      expect(leafNodes.length).toBe(1);
      expect(leafNodes[0].name).toBe('constants.ts');
    });
  });
  
  describe('findConnectedComponents', () => {
    it('should find separate components', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'file', 'c.ts'),
        createTestNode(4, 'file', 'd.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 3, 4, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const components = findConnectedComponents(graphologyGraph, nodes);
      
      expect(components.length).toBe(2);
    });
  });
  
  describe('computeCentralityMetrics', () => {
    it('should compute centrality for all nodes', () => {
      const nodes = [
        createTestNode(1, 'file', 'hub.ts'),
        createTestNode(2, 'file', 'a.ts'),
        createTestNode(3, 'file', 'b.ts'),
        createTestNode(4, 'file', 'c.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 2, 1, 'imports'),
        createTestEdge(2, 3, 1, 'imports'),
        createTestEdge(3, 4, 1, 'imports'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const metrics = computeCentralityMetrics(graphologyGraph);
      
      expect(metrics.size).toBe(4);
      
      // Hub should have highest degree
      const hubMetrics = metrics.get(1);
      expect(hubMetrics).toBeDefined();
      expect(hubMetrics!.degree).toBeGreaterThan(0);
    });
  });
  
  describe('extractSubgraph', () => {
    it('should filter by node type', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'function', 'foo'),
        createTestNode(3, 'class', 'Bar'),
        createTestNode(4, 'file', 'b.ts'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'contains'),
        createTestEdge(2, 1, 3, 'contains'),
        createTestEdge(3, 1, 4, 'imports'),
      ];
      
      const result = extractSubgraph(nodes, edges, ['file']);
      
      expect(result.nodes.length).toBe(2);
      expect(result.edges.length).toBe(1); // Only imports between files
    });
  });
  
  describe('analyzeImpact', () => {
    it('should compute blast radius', () => {
      const nodes = [
        createTestNode(1, 'interface', 'IService'),
        createTestNode(2, 'class', 'ServiceA'),
        createTestNode(3, 'class', 'ServiceB'),
        createTestNode(4, 'test', 'ServiceA.test'),
      ];
      
      const edges = [
        createTestEdge(1, 2, 1, 'implements'),
        createTestEdge(2, 3, 1, 'implements'),
        createTestEdge(3, 4, 2, 'tests'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const impact = analyzeImpact(graphologyGraph, 1, nodes, edges);
      
      expect(impact.blastRadius).toBeGreaterThan(0);
    });
  });
  
  describe('computeGraphStats', () => {
    it('should compute graph statistics', () => {
      const nodes = [
        createTestNode(1, 'file', 'a.ts'),
        createTestNode(2, 'file', 'b.ts'),
        createTestNode(3, 'function', 'foo'),
      ];
      
      const edges = [
        createTestEdge(1, 1, 2, 'imports'),
        createTestEdge(2, 1, 3, 'contains'),
      ];
      
      const graphologyGraph = buildGraphologyGraph(nodes, edges);
      const stats = computeGraphStats(graphologyGraph, nodes, edges);
      
      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(stats.nodeTypeDistribution['file']).toBe(2);
      expect(stats.nodeTypeDistribution['function']).toBe(1);
    });
  });
});

// ============================================================================
// Extractor Tests
// ============================================================================

describe('Relationship Extractors', () => {
  describe('extractCodeRelationships', () => {
    it('should extract file nodes from code files', () => {
      const files = [
        {
          id: 1,
          repositoryId: 1,
          path: 'src/index.ts',
          name: 'index.ts',
          extension: 'ts',
          language: 'TypeScript',
          size: 100,
          content: null,
          sha: null,
          createdAt: new Date(),
        },
      ];
      
      const result = extractCodeRelationships(files, [], [], 1);
      
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].node.type).toBe('file');
      expect(result.nodes[0].node.name).toBe('index.ts');
    });
    
    it('should extract symbol nodes', () => {
      const files = [
        {
          id: 1,
          repositoryId: 1,
          path: 'src/index.ts',
          name: 'index.ts',
          extension: 'ts',
          language: 'TypeScript',
          size: 100,
          content: null,
          sha: null,
          createdAt: new Date(),
        },
      ];
      
      const symbols = [
        {
          id: 1,
          fileId: 1,
          repositoryId: 1,
          name: 'MyClass',
          kind: 'class' as const,
          startLine: 1,
          endLine: 10,
          signature: 'class MyClass',
          docstring: null,
        },
      ];
      
      const result = extractCodeRelationships(files, symbols, [], 1);
      
      expect(result.nodes.length).toBe(2); // file + class
      expect(result.edges.length).toBe(1); // contains edge
    });
  });
  
  describe('extractInfrastructureRelationships', () => {
    it('should extract Docker container nodes', () => {
      const files = [
        {
          id: 1,
          repositoryId: 1,
          path: 'Dockerfile',
          name: 'Dockerfile',
          extension: null,
          language: null,
          size: 100,
          content: 'FROM node:18\nEXPOSE 3000',
          sha: null,
          createdAt: new Date(),
        },
      ];
      
      const result = extractInfrastructureRelationships(files, 1);
      
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].node.type).toBe('container');
      expect(result.nodes[0].node.metadata).toHaveProperty('baseImage');
    });
    
    it('should extract GitHub Actions workflow', () => {
      const files = [
        {
          id: 1,
          repositoryId: 1,
          path: '.github/workflows/ci.yml',
          name: 'ci.yml',
          extension: 'yml',
          language: 'YAML',
          size: 100,
          content: 'name: CI\non:\n  push:\n  pull_request:',
          sha: null,
          createdAt: new Date(),
        },
      ];
      
      const result = extractInfrastructureRelationships(files, 1);
      
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].node.type).toBe('worker');
      expect(result.nodes[0].node.tags).toContain('github-actions');
    });
  });
  
  describe('extractRuntimeRelationships', () => {
    it('should extract HTTP routes', () => {
      const files = [
        {
          id: 1,
          repositoryId: 1,
          path: 'src/routes.ts',
          name: 'routes.ts',
          extension: 'ts',
          language: 'TypeScript',
          size: 100,
          content: "app.get('/api/users', handler);",
          sha: null,
          createdAt: new Date(),
        },
      ];
      
      const result = extractRuntimeRelationships(files, 1);
      
      expect(result.nodes.length).toBeGreaterThan(0);
      const routeNode = result.nodes.find(n => n.node.type === 'api_endpoint');
      expect(routeNode).toBeDefined();
      expect(routeNode!.node.name).toBe('GET /api/users');
    });
  });
  
  describe('extractDocumentationRelationships', () => {
    it('should extract documentation nodes', () => {
      const files = [
        {
          id: 1,
          repositoryId: 1,
          path: 'README.md',
          name: 'README.md',
          extension: 'md',
          language: 'Markdown',
          size: 1000,
          content: '# Project\n\nThis is a description of the project that explains what it does.',
          sha: null,
          createdAt: new Date(),
        },
      ];
      
      const result = extractDocumentationRelationships(files, 1);
      
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].node.type).toBe('documentation');
      expect(result.nodes[0].node.metadata).toHaveProperty('isReadme');
    });
  });
  
  describe('extractDependencyRelationships', () => {
    it('should extract dependency nodes', () => {
      const dependencies = [
        {
          id: 1,
          repositoryId: 1,
          name: 'react',
          version: '18.2.0',
          type: 'production' as const,
          ecosystem: 'npm',
        },
        {
          id: 2,
          repositoryId: 1,
          name: 'typescript',
          version: '5.0.0',
          type: 'development' as const,
          ecosystem: 'npm',
        },
      ];
      
      const result = extractDependencyRelationships(dependencies, 1);
      
      expect(result.nodes.length).toBe(3); // root + 2 deps
      expect(result.edges.length).toBe(2); // 2 depends_on edges
    });
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('Graph Types', () => {
  it('should have correct node type values', () => {
    const validTypes: GraphNodeType[] = [
      'repository', 'directory', 'package', 'module', 'file',
      'namespace', 'class', 'interface', 'trait', 'function',
      'method', 'variable', 'configuration', 'environment_variable',
      'api_endpoint', 'route', 'database', 'table', 'queue',
      'worker', 'cron', 'container', 'deployment', 'external_service',
      'documentation', 'test', 'issue', 'pull_request',
    ];
    
    expect(validTypes.length).toBe(28);
  });
  
  it('should have correct edge type values', () => {
    const validTypes: GraphEdgeType[] = [
      'imports', 'exports', 'calls', 'references', 'implements',
      'extends', 'depends_on', 'owns', 'contains', 'uses',
      'reads', 'writes', 'publishes', 'subscribes', 'connects_to',
      'authenticates', 'configures', 'deploys', 'tests', 'generates',
      'documents', 'related_to',
    ];
    
    expect(validTypes.length).toBe(22);
  });
});
