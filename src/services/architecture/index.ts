/**
 * Architecture Analyzer
 * 
 * Main orchestrator for the Architecture Intelligence Pipeline.
 * Coordinates all detection and analysis components to build
 * the Repository Digital Twin.
 */

import type {
  ArchitectureSummary,
  ArchitectureNode,
} from '../../types/architecture';
import type { Repository, RepoFile } from '../../types';

// Database operations
import {
  createArchitectureNode,
  createArchitectureEdge,
  createService,
  createLayer,
  createModule,
  createEntryPoint,
  createApiEndpoint,
  createTechnology,
  createDatastore,
  createQueue,
  createRuntimeComponent,
  createConfiguration,
  saveArchitectureSummary,
  clearArchitectureData,
  getArchitectureNodesByRepository,
  getArchitectureEdgesByRepository,
  getServicesByRepository,
  getLayersByRepository,
  getModulesByRepository,
  getEntryPointsByRepository,
  getApiEndpointsByRepository,
  getTechnologiesByRepository,
  getDatastoresByRepository,
  getQueuesByRepository,
  getExecutionPathsByRepository,
  getArchitectureSummary,
} from '../../db/architecture';

import { getFilesByRepository, getDependenciesByRepository } from '../../db';

// Detectors
import {
  detectTechnologies,
  detectDatastores,
  detectQueues,
  detectLanguages,
} from './technologyDetector';

import {
  detectServices,
  detectApiEndpoints,
  detectArchitectureStyle,
} from './serviceDetector';

import {
  detectLayers,
  classifyFileLayer,
} from './layerDetector';

import {
  detectEntryPoints,
} from './entryPointDetector';

// Diagram Engine
import {
  generateAllDiagrams,
  type DiagramContext,
} from './diagramEngine';

// ============================================================================
// Analysis Progress Callback
// ============================================================================

export interface AnalysisProgress {
  phase: 'starting' | 'technologies' | 'services' | 'layers' | 'entry_points' | 
         'api_endpoints' | 'nodes' | 'edges' | 'diagrams' | 'summary' | 'complete';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: AnalysisProgress) => void;

// ============================================================================
// Architecture Analyzer
// ============================================================================

/**
 * Analyze a repository and build the Architecture Digital Twin
 */
export async function analyzeArchitecture(
  repository: Repository,
  onProgress?: ProgressCallback
): Promise<ArchitectureSummary> {
  const repositoryId = repository.id;
  
  onProgress?.({
    phase: 'starting',
    current: 0,
    total: 10,
    message: 'Starting architecture analysis...',
  });
  
  // Clear existing architecture data
  await clearArchitectureData(repositoryId);
  
  // Load repository data
  const files = await getFilesByRepository(repositoryId);
  const dependencies = await getDependenciesByRepository(repositoryId);
  
  const context = { files, dependencies };
  
  // Phase 1: Detect Technologies
  onProgress?.({
    phase: 'technologies',
    current: 1,
    total: 10,
    message: 'Detecting technologies...',
  });
  
  const technologies = [
    ...detectTechnologies(context, repositoryId),
    ...detectLanguages(files, repositoryId),
  ];
  
  for (const tech of technologies) {
    await createTechnology(tech);
  }
  
  const datastores = detectDatastores(context, repositoryId);
  for (const ds of datastores) {
    await createDatastore(ds);
  }
  
  const queues = detectQueues(context, repositoryId);
  for (const queue of queues) {
    await createQueue(queue);
  }
  
  // Phase 2: Detect Services
  onProgress?.({
    phase: 'services',
    current: 2,
    total: 10,
    message: 'Detecting services...',
  });
  
  const services = detectServices(context, repositoryId);
  const savedServices = [];
  for (const service of services) {
    const saved = await createService(service);
    savedServices.push(saved);
  }
  
  // Phase 3: Detect Layers
  onProgress?.({
    phase: 'layers',
    current: 3,
    total: 10,
    message: 'Detecting architectural layers...',
  });
  
  const layers = detectLayers(files, repositoryId);
  for (const layer of layers) {
    await createLayer(layer);
  }
  
  // Phase 4: Detect Entry Points
  onProgress?.({
    phase: 'entry_points',
    current: 4,
    total: 10,
    message: 'Detecting entry points...',
  });
  
  const entryPoints = detectEntryPoints(context, repositoryId);
  for (const ep of entryPoints) {
    await createEntryPoint(ep);
  }
  
  // Phase 5: Detect API Endpoints
  onProgress?.({
    phase: 'api_endpoints',
    current: 5,
    total: 10,
    message: 'Detecting API endpoints...',
  });
  
  const apiEndpoints = detectApiEndpoints(files, repositoryId);
  for (const endpoint of apiEndpoints) {
    await createApiEndpoint(endpoint);
  }
  
  // Phase 6: Build Architecture Nodes
  onProgress?.({
    phase: 'nodes',
    current: 6,
    total: 10,
    message: 'Building architecture graph nodes...',
  });
  
  await buildArchitectureNodes(repositoryId, files, savedServices, layers);
  
  // Phase 7: Build Architecture Edges
  onProgress?.({
    phase: 'edges',
    current: 7,
    total: 10,
    message: 'Building architecture graph edges...',
  });
  
  await buildArchitectureEdges(repositoryId, files);
  
  // Phase 8: Detect Runtime Components
  await detectRuntimeComponents(repositoryId, files);
  
  // Phase 9: Detect Configuration
  await detectConfiguration(repositoryId, files);
  
  // Phase 10: Generate Diagrams
  onProgress?.({
    phase: 'diagrams',
    current: 8,
    total: 10,
    message: 'Generating architecture diagrams...',
  });
  
  const diagramContext = await buildDiagramContext(repositoryId);
  const diagrams = generateAllDiagrams(diagramContext);
  
  // Phase 11: Build Summary
  onProgress?.({
    phase: 'summary',
    current: 9,
    total: 10,
    message: 'Building architecture summary...',
  });
  
  const savedTechnologies = await getTechnologiesByRepository(repositoryId);
  const savedDatastores = await getDatastoresByRepository(repositoryId);
  const savedQueues = await getQueuesByRepository(repositoryId);
  const savedLayers = await getLayersByRepository(repositoryId);
  
  const architectureStyle = detectArchitectureStyle(savedServices, files);
  
  const summary: ArchitectureSummary = {
    repositoryId,
    repositoryName: repository.fullName,
    languages: savedTechnologies
      .filter(t => t.category === 'language')
      .map(t => t.name),
    frameworks: savedTechnologies
      .filter(t => t.category === 'framework')
      .map(t => t.name),
    databases: savedDatastores.map(d => d.type),
    queues: savedQueues.map(q => q.type),
    serviceCount: savedServices.length,
    moduleCount: (await getModulesByRepository(repositoryId)).length,
    layerCount: savedLayers.length,
    entryPointCount: (await getEntryPointsByRepository(repositoryId)).length,
    apiEndpointCount: (await getApiEndpointsByRepository(repositoryId)).length,
    architectureStyle,
    layers: savedLayers,
    services: savedServices,
    diagrams,
    analyzedAt: new Date(),
  };
  
  await saveArchitectureSummary(repositoryId, summary);
  
  onProgress?.({
    phase: 'complete',
    current: 10,
    total: 10,
    message: 'Architecture analysis complete!',
  });
  
  return summary;
}

/**
 * Get the architecture summary for a repository
 */
export async function getArchitectureAnalysis(
  repositoryId: number
): Promise<ArchitectureSummary | null> {
  return getArchitectureSummary(repositoryId);
}

/**
 * Check if a repository has been analyzed
 */
export async function hasArchitectureAnalysis(
  repositoryId: number
): Promise<boolean> {
  const summary = await getArchitectureSummary(repositoryId);
  return summary !== null;
}

// ============================================================================
// Node Building
// ============================================================================

async function buildArchitectureNodes(
  repositoryId: number,
  files: RepoFile[],
  services: Awaited<ReturnType<typeof createService>>[],
  layers: Awaited<ReturnType<typeof detectLayers>>
): Promise<void> {
  // Create service nodes
  for (const service of services) {
    await createArchitectureNode({
      repositoryId,
      type: 'service',
      name: service.name,
      description: service.description,
      filePath: service.entryPoint,
      startLine: null,
      endLine: null,
      parentNodeId: null,
      metadata: { serviceId: service.id, serviceType: service.type },
    });
  }
  
  // Create layer nodes
  for (const layer of layers) {
    await createArchitectureNode({
      repositoryId,
      type: 'layer',
      name: layer.name,
      description: layer.description,
      filePath: null,
      startLine: null,
      endLine: null,
      parentNodeId: null,
      metadata: { layerType: layer.type, order: layer.order },
    });
  }
  
  // Create module nodes from directories with code files
  const directories = new Set<string>();
  for (const file of files) {
    if (!file.extension) continue;
    if (!['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java'].includes(file.extension)) continue;
    
    const parts = file.path.split('/');
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/');
      directories.add(dir);
    }
  }
  
  for (const dir of directories) {
    const name = dir.split('/').pop() || dir;
    const layer = classifyFileLayer(dir);
    
    await createModule({
      repositoryId,
      name,
      path: dir,
      type: 'module',
      isEntryPoint: /^(src|app|pages|api)$/.test(name),
      exports: [],
      description: layer ? `Part of the ${layer} layer` : null,
    });
  }
}

// ============================================================================
// Edge Building
// ============================================================================

async function buildArchitectureEdges(
  repositoryId: number,
  files: RepoFile[]
): Promise<void> {
  const nodes = await getArchitectureNodesByRepository(repositoryId);
  const nodesByPath = new Map<string, ArchitectureNode>();
  
  for (const node of nodes) {
    if (node.filePath) {
      nodesByPath.set(node.filePath, node);
    }
  }
  
  // Build import edges from file content
  for (const file of files) {
    if (!file.content) continue;
    if (!file.extension || !['ts', 'tsx', 'js', 'jsx'].includes(file.extension)) continue;
    
    const fileDir = file.path.split('/').slice(0, -1).join('/');
    const sourceNode = findNodeForPath(nodes, fileDir);
    if (!sourceNode) continue;
    
    // Extract imports
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1];
      
      // Skip external modules
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;
      
      // Resolve the import path
      const resolvedPath = resolveImportPath(fileDir, importPath);
      if (!resolvedPath) continue;
      
      const targetNode = findNodeForPath(nodes, resolvedPath);
      if (targetNode && targetNode.id !== sourceNode.id) {
        await createArchitectureEdge({
          repositoryId,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          type: 'imports',
          weight: 1,
          metadata: { importPath },
        });
      }
    }
  }
}

function findNodeForPath(
  nodes: ArchitectureNode[],
  path: string
): ArchitectureNode | undefined {
  // Find exact match or parent directory match
  for (const node of nodes) {
    if (node.filePath === path) return node;
  }
  
  // Try to find a module node matching the directory
  const dir = path.includes('/') ? path.split('/').slice(0, -1).join('/') : path;
  for (const node of nodes) {
    if (node.type === 'module' && node.filePath === dir) return node;
  }
  
  return undefined;
}

function resolveImportPath(fromDir: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null;
  
  const parts = importPath.split('/');
  const dirParts = fromDir.split('/');
  
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      dirParts.pop();
    } else {
      dirParts.push(part);
    }
  }
  
  return dirParts.join('/');
}

// ============================================================================
// Runtime Component Detection
// ============================================================================

async function detectRuntimeComponents(
  repositoryId: number,
  files: RepoFile[]
): Promise<void> {
  // Look for Docker files
  for (const file of files) {
    if (file.name === 'Dockerfile' || file.name.startsWith('Dockerfile.')) {
      const name = file.name === 'Dockerfile' ? 'main' : file.name.replace('Dockerfile.', '');
      
      let image: string | null = null;
      const ports: number[] = [];
      
      if (file.content) {
        const fromMatch = file.content.match(/FROM\s+([^\s]+)/);
        if (fromMatch) image = fromMatch[1];
        
        const exposeMatches = file.content.matchAll(/EXPOSE\s+(\d+)/g);
        for (const match of exposeMatches) {
          ports.push(parseInt(match[1]));
        }
      }
      
      await createRuntimeComponent({
        repositoryId,
        name,
        type: 'container',
        image,
        ports,
        environment: {},
        dependencies: [],
      });
    }
    
    // Look for docker-compose
    if (file.name === 'docker-compose.yml' || file.name === 'docker-compose.yaml') {
      if (file.content) {
        const serviceMatches = file.content.matchAll(/^\s{2}(\w+):/gm);
        for (const match of serviceMatches) {
          const serviceName = match[1];
          if (!['version', 'services', 'networks', 'volumes'].includes(serviceName)) {
            await createRuntimeComponent({
              repositoryId,
              name: serviceName,
              type: 'docker-compose-service',
              image: null,
              ports: [],
              environment: {},
              dependencies: [],
            });
          }
        }
      }
    }
  }
}

// ============================================================================
// Configuration Detection
// ============================================================================

async function detectConfiguration(
  repositoryId: number,
  files: RepoFile[]
): Promise<void> {
  for (const file of files) {
    // .env files
    if (file.name.startsWith('.env') && file.content) {
      const lines = file.content.split('\n');
      for (const line of lines) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
          const [, key, value] = match;
          
          // Determine config type
          let type: 'environment' | 'secrets' | 'database' | 'external_service' = 'environment';
          if (/SECRET|KEY|TOKEN|PASSWORD|PRIVATE/i.test(key)) {
            type = 'secrets';
          } else if (/DATABASE|DB_|PG_|MONGO|REDIS/i.test(key)) {
            type = 'database';
          } else if (/API_|URL|ENDPOINT/i.test(key)) {
            type = 'external_service';
          }
          
          await createConfiguration({
            repositoryId,
            key,
            type,
            source: file.path,
            defaultValue: value.includes('$') ? null : (value || null),
            description: null,
          });
        }
      }
    }
  }
}

// ============================================================================
// Diagram Context Building
// ============================================================================

async function buildDiagramContext(
  repositoryId: number
): Promise<DiagramContext> {
  return {
    services: await getServicesByRepository(repositoryId),
    layers: await getLayersByRepository(repositoryId),
    modules: await getModulesByRepository(repositoryId),
    entryPoints: await getEntryPointsByRepository(repositoryId),
    apiEndpoints: await getApiEndpointsByRepository(repositoryId),
    nodes: await getArchitectureNodesByRepository(repositoryId),
    edges: await getArchitectureEdgesByRepository(repositoryId),
    technologies: await getTechnologiesByRepository(repositoryId),
    executionPaths: await getExecutionPathsByRepository(repositoryId),
  };
}

// ============================================================================
// Export Helper Functions
// ============================================================================

export {
  detectTechnologies,
  detectDatastores,
  detectQueues,
  detectServices,
  detectApiEndpoints,
  detectLayers,
  detectEntryPoints,
  generateAllDiagrams,
};
