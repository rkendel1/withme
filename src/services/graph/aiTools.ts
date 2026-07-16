/**
 * Graph AI Tools
 * 
 * Functions that the LLM can use to reason over the Repository Relationship Graph.
 * These provide structured access to graph queries and analysis.
 */

import {
  getGraph,
  getGraphStatistics,
  findShortestPath,
  findDependencies,
  findDependents,
  findCycles,
  hasCycles,
  findEntrypoints,
  findCallChain,
  analyzeImpact,
  getFilteredGraph,
  getNeighborhood,
  searchNodes,
  getNodeDetails,
} from './index';

import type {
  GraphStats,
  GraphNodeType,
} from '../../types/graph';

// ============================================================================
// Tool Response Types
// ============================================================================

interface ToolResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  executionTimeMs: number;
}

async function wrapTool<T>(fn: () => Promise<T>): Promise<ToolResponse<T>> {
  const start = performance.now();
  try {
    const data = await fn();
    return {
      success: true,
      data,
      error: null,
      executionTimeMs: performance.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: performance.now() - start,
    };
  }
}

// ============================================================================
// Graph Query Tools
// ============================================================================

/**
 * Get an overview of the repository graph
 */
export async function graphOverview(
  repositoryId: number
): Promise<ToolResponse<{
  stats: GraphStats;
  entryPoints: string[];
  hasCycles: boolean;
}>> {
  return wrapTool(async () => {
    const stats = await getGraphStatistics(repositoryId);
    const entries = await findEntrypoints(repositoryId);
    const cycles = await hasCycles(repositoryId);
    
    return {
      stats,
      entryPoints: entries.map(e => `${e.type}: ${e.name}`),
      hasCycles: cycles,
    };
  });
}

/**
 * Find the shortest path between two components
 */
export async function graphFindShortestPath(
  repositoryId: number,
  sourceName: string,
  targetName: string
): Promise<ToolResponse<{
  path: string[];
  length: number;
} | null>> {
  return wrapTool(async () => {
    // First, find the nodes by name
    const sourceNodes = await searchNodes(repositoryId, sourceName);
    const targetNodes = await searchNodes(repositoryId, targetName);
    
    if (sourceNodes.length === 0) {
      throw new Error(`Source node "${sourceName}" not found`);
    }
    if (targetNodes.length === 0) {
      throw new Error(`Target node "${targetName}" not found`);
    }
    
    const result = await findShortestPath(
      repositoryId,
      sourceNodes[0].id,
      targetNodes[0].id
    );
    
    if (!result) return null;
    
    return {
      path: result.nodes.map(n => `${n.type}: ${n.name}`),
      length: result.length,
    };
  });
}

/**
 * Find what a component depends on
 */
export async function graphFindDependencies(
  repositoryId: number,
  componentName: string,
  transitive: boolean = true
): Promise<ToolResponse<{
  component: string;
  dependencies: string[];
  count: number;
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const deps = await findDependencies(repositoryId, node.id, transitive);
    
    return {
      component: `${node.type}: ${node.name}`,
      dependencies: deps.map(d => `${d.type}: ${d.name}`),
      count: deps.length,
    };
  });
}

/**
 * Find what depends on a component
 */
export async function graphFindDependents(
  repositoryId: number,
  componentName: string,
  transitive: boolean = true
): Promise<ToolResponse<{
  component: string;
  dependents: string[];
  count: number;
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const deps = await findDependents(repositoryId, node.id, transitive);
    
    return {
      component: `${node.type}: ${node.name}`,
      dependents: deps.map(d => `${d.type}: ${d.name}`),
      count: deps.length,
    };
  });
}

/**
 * Find all circular dependencies in the graph
 */
export async function graphFindCycles(
  repositoryId: number
): Promise<ToolResponse<{
  hasCycles: boolean;
  cycles: string[][];
  count: number;
}>> {
  return wrapTool(async () => {
    const cycles = await findCycles(repositoryId);
    
    return {
      hasCycles: cycles.length > 0,
      cycles: cycles.map(c => c.nodes.map(n => `${n.type}: ${n.name}`)),
      count: cycles.length,
    };
  });
}

/**
 * Find entry points to the codebase
 */
export async function graphFindEntrypoints(
  repositoryId: number
): Promise<ToolResponse<{
  entryPoints: Array<{
    name: string;
    type: string;
    filePath: string | null;
  }>;
  count: number;
}>> {
  return wrapTool(async () => {
    const entries = await findEntrypoints(repositoryId);
    
    return {
      entryPoints: entries.map(e => ({
        name: e.name,
        type: e.type,
        filePath: e.filePath,
      })),
      count: entries.length,
    };
  });
}

/**
 * Trace the call chain from a component
 */
export async function graphFindCallChain(
  repositoryId: number,
  componentName: string,
  maxDepth: number = 10
): Promise<ToolResponse<{
  component: string;
  callChain: string[];
  depth: number;
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const chain = await findCallChain(repositoryId, node.id, maxDepth);
    
    return {
      component: `${node.type}: ${node.name}`,
      callChain: chain.nodes.map(n => `${n.type}: ${n.name}`),
      depth: chain.length,
    };
  });
}

/**
 * Analyze the impact of changing a component
 */
export async function graphAnalyzeImpact(
  repositoryId: number,
  componentName: string
): Promise<ToolResponse<{
  component: string;
  blastRadius: number;
  affectedServices: string[];
  breakingChanges: Array<{
    component: string;
    reason: string;
    severity: string;
  }>;
  suggestedTests: string[];
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const impact = await analyzeImpact(repositoryId, node.id);
    
    return {
      component: `${node.type}: ${node.name}`,
      blastRadius: impact.blastRadius,
      affectedServices: impact.affectedServices.map(s => s.name),
      breakingChanges: impact.potentialBreakingChanges.map(bc => ({
        component: `${bc.node.type}: ${bc.node.name}`,
        reason: bc.reason,
        severity: bc.severity,
      })),
      suggestedTests: impact.suggestedTests,
    };
  });
}

/**
 * Get related documentation for a component
 */
export async function graphFindRelatedDocumentation(
  repositoryId: number,
  componentName: string
): Promise<ToolResponse<{
  component: string;
  documentation: Array<{
    name: string;
    path: string | null;
    description: string | null;
  }>;
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const neighborhood = await getNeighborhood(repositoryId, node.id, 2);
    
    // Filter for documentation nodes
    const docs = neighborhood.nodes.filter(n => n.type === 'documentation');
    
    return {
      component: `${node.type}: ${node.name}`,
      documentation: docs.map(d => ({
        name: d.name,
        path: d.filePath,
        description: d.description,
      })),
    };
  });
}

/**
 * Get external dependencies
 */
export async function graphFindExternalDependencies(
  repositoryId: number
): Promise<ToolResponse<{
  dependencies: Array<{
    name: string;
    usedBy: number;
  }>;
  count: number;
}>> {
  return wrapTool(async () => {
    const filtered = await getFilteredGraph(repositoryId, ['external_service']);
    const { edges } = await getGraph(repositoryId);
    
    // Count usage for each external dependency
    const usageCount = new Map<number, number>();
    for (const edge of edges) {
      if (filtered.nodes.some(n => n.id === edge.targetNodeId)) {
        usageCount.set(
          edge.targetNodeId,
          (usageCount.get(edge.targetNodeId) || 0) + 1
        );
      }
    }
    
    const dependencies = filtered.nodes.map(n => ({
      name: n.name,
      usedBy: usageCount.get(n.id) || 0,
    }));
    
    // Sort by usage
    dependencies.sort((a, b) => b.usedBy - a.usedBy);
    
    return {
      dependencies,
      count: dependencies.length,
    };
  });
}

/**
 * Get components by layer
 */
export async function graphFindByLayer(
  repositoryId: number,
  nodeType: GraphNodeType
): Promise<ToolResponse<{
  type: string;
  components: Array<{
    name: string;
    filePath: string | null;
  }>;
  count: number;
}>> {
  return wrapTool(async () => {
    const filtered = await getFilteredGraph(repositoryId, [nodeType]);
    
    return {
      type: nodeType,
      components: filtered.nodes.map(n => ({
        name: n.name,
        filePath: n.filePath,
      })),
      count: filtered.nodes.length,
    };
  });
}

/**
 * Get the runtime flow starting from a component
 */
export async function graphFindRuntimeFlow(
  repositoryId: number,
  componentName: string
): Promise<ToolResponse<{
  component: string;
  flow: Array<{
    step: number;
    component: string;
    type: string;
  }>;
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const chain = await findCallChain(repositoryId, node.id, 15);
    
    // Filter to runtime-relevant types
    const runtimeTypes = ['api_endpoint', 'route', 'worker', 'queue', 'database', 'external_service'];
    const runtimeNodes = chain.nodes.filter(n => 
      runtimeTypes.includes(n.type) || n.id === node.id
    );
    
    return {
      component: `${node.type}: ${node.name}`,
      flow: runtimeNodes.map((n, i) => ({
        step: i + 1,
        component: n.name,
        type: n.type,
      })),
    };
  });
}

/**
 * Search for components by name
 */
export async function graphSearch(
  repositoryId: number,
  query: string,
  limit: number = 20
): Promise<ToolResponse<{
  query: string;
  results: Array<{
    name: string;
    type: string;
    filePath: string | null;
    description: string | null;
  }>;
  count: number;
}>> {
  return wrapTool(async () => {
    const results = await searchNodes(repositoryId, query);
    const limited = results.slice(0, limit);
    
    return {
      query,
      results: limited.map(n => ({
        name: n.name,
        type: n.type,
        filePath: n.filePath,
        description: n.description,
      })),
      count: results.length,
    };
  });
}

/**
 * Get detailed information about a component
 */
export async function graphGetComponentDetails(
  repositoryId: number,
  componentName: string
): Promise<ToolResponse<{
  name: string;
  type: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  language: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  incomingEdges: number;
  outgoingEdges: number;
}>> {
  return wrapTool(async () => {
    const nodes = await searchNodes(repositoryId, componentName);
    
    if (nodes.length === 0) {
      throw new Error(`Component "${componentName}" not found`);
    }
    
    const node = nodes[0];
    const details = await getNodeDetails(node.id);
    
    if (!details.node) {
      throw new Error(`Component "${componentName}" details not found`);
    }
    
    return {
      name: details.node.name,
      type: details.node.type,
      filePath: details.node.filePath,
      startLine: details.node.startLine,
      endLine: details.node.endLine,
      language: details.node.language,
      description: details.node.description,
      metadata: details.node.metadata,
      incomingEdges: details.incoming.length,
      outgoingEdges: details.outgoing.length,
    };
  });
}

// ============================================================================
// Tool Registry for LLM
// ============================================================================

export const GRAPH_TOOLS = {
  graphOverview: {
    name: 'graphOverview',
    description: 'Get an overview of the repository relationship graph including statistics, entry points, and cycle detection.',
    parameters: {
      repositoryId: 'number - The repository ID',
    },
    fn: graphOverview,
  },
  graphFindShortestPath: {
    name: 'graphFindShortestPath',
    description: 'Find the shortest path between two components in the codebase.',
    parameters: {
      repositoryId: 'number - The repository ID',
      sourceName: 'string - Name of the source component',
      targetName: 'string - Name of the target component',
    },
    fn: graphFindShortestPath,
  },
  graphFindDependencies: {
    name: 'graphFindDependencies',
    description: 'Find all dependencies of a component (what it depends on).',
    parameters: {
      repositoryId: 'number - The repository ID',
      componentName: 'string - Name of the component',
      transitive: 'boolean - Include transitive dependencies (default: true)',
    },
    fn: graphFindDependencies,
  },
  graphFindDependents: {
    name: 'graphFindDependents',
    description: 'Find all dependents of a component (what depends on it).',
    parameters: {
      repositoryId: 'number - The repository ID',
      componentName: 'string - Name of the component',
      transitive: 'boolean - Include transitive dependents (default: true)',
    },
    fn: graphFindDependents,
  },
  graphFindCycles: {
    name: 'graphFindCycles',
    description: 'Find all circular dependencies in the codebase.',
    parameters: {
      repositoryId: 'number - The repository ID',
    },
    fn: graphFindCycles,
  },
  graphFindEntrypoints: {
    name: 'graphFindEntrypoints',
    description: 'Find all entry points to the codebase (components with no incoming dependencies).',
    parameters: {
      repositoryId: 'number - The repository ID',
    },
    fn: graphFindEntrypoints,
  },
  graphFindCallChain: {
    name: 'graphFindCallChain',
    description: 'Trace the call chain from a component to see what it calls.',
    parameters: {
      repositoryId: 'number - The repository ID',
      componentName: 'string - Name of the component',
      maxDepth: 'number - Maximum depth to trace (default: 10)',
    },
    fn: graphFindCallChain,
  },
  graphAnalyzeImpact: {
    name: 'graphAnalyzeImpact',
    description: 'Analyze the impact of changing a component, including blast radius, affected services, and suggested tests.',
    parameters: {
      repositoryId: 'number - The repository ID',
      componentName: 'string - Name of the component',
    },
    fn: graphAnalyzeImpact,
  },
  graphFindRelatedDocumentation: {
    name: 'graphFindRelatedDocumentation',
    description: 'Find documentation related to a component.',
    parameters: {
      repositoryId: 'number - The repository ID',
      componentName: 'string - Name of the component',
    },
    fn: graphFindRelatedDocumentation,
  },
  graphFindExternalDependencies: {
    name: 'graphFindExternalDependencies',
    description: 'List all external dependencies and their usage count.',
    parameters: {
      repositoryId: 'number - The repository ID',
    },
    fn: graphFindExternalDependencies,
  },
  graphSearch: {
    name: 'graphSearch',
    description: 'Search for components by name.',
    parameters: {
      repositoryId: 'number - The repository ID',
      query: 'string - Search query',
      limit: 'number - Maximum results (default: 20)',
    },
    fn: graphSearch,
  },
  graphGetComponentDetails: {
    name: 'graphGetComponentDetails',
    description: 'Get detailed information about a specific component.',
    parameters: {
      repositoryId: 'number - The repository ID',
      componentName: 'string - Name of the component',
    },
    fn: graphGetComponentDetails,
  },
};
