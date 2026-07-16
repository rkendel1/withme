/**
 * Diagram Engine
 * 
 * Generates architecture diagrams in Mermaid format including
 * component diagrams, dependency graphs, call graphs, sequence diagrams,
 * and service maps.
 */

import type {
  ArchitectureNode,
  ArchitectureEdge,
  Service,
  Layer,
  Module,
  EntryPoint,
  ApiEndpoint,
  DiagramReference,
  DiagramType,
  ExecutionPath,
  Technology,
} from '../../types/architecture';

// ============================================================================
// Component Diagram
// ============================================================================

/**
 * Generate a component diagram showing services and their relationships
 */
export function generateComponentDiagram(
  services: Service[],
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): DiagramReference {
  const lines: string[] = ['graph TB'];
  
  // Add subgraphs for each service
  if (services.length > 0) {
    for (const service of services) {
      const serviceId = sanitizeId(service.name);
      lines.push(`    subgraph ${serviceId}["${service.name}"]`);
      
      // Find nodes belonging to this service
      const serviceNodes = nodes.filter(n =>
        n.metadata.serviceId === service.id ||
        n.filePath?.includes(service.entryPoint || '')
      );
      
      for (const node of serviceNodes.slice(0, 5)) { // Limit for readability
        const nodeId = `${serviceId}_${sanitizeId(node.name)}`;
        lines.push(`        ${nodeId}["${node.name}"]`);
      }
      
      lines.push('    end');
    }
  } else {
    // Fallback: show top-level nodes by type
    const nodesByType = groupBy(nodes, n => n.type);
    
    for (const [type, typeNodes] of nodesByType.entries()) {
      if (typeNodes.length === 0) continue;
      
      const typeId = sanitizeId(type);
      lines.push(`    subgraph ${typeId}["${formatNodeType(type)}"]`);
      
      for (const node of typeNodes.slice(0, 10)) {
        const nodeId = `${typeId}_${sanitizeId(node.name)}`;
        lines.push(`        ${nodeId}["${node.name}"]`);
      }
      
      lines.push('    end');
    }
  }
  
  // Add edges between components
  const edgeSet = new Set<string>();
  for (const edge of edges.slice(0, 30)) { // Limit edges
    const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = nodes.find(n => n.id === edge.targetNodeId);
    
    if (sourceNode && targetNode) {
      const sourceId = sanitizeId(`${sourceNode.type}_${sourceNode.name}`);
      const targetId = sanitizeId(`${targetNode.type}_${targetNode.name}`);
      const edgeKey = `${sourceId}->${targetId}`;
      
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        lines.push(`    ${sourceId} --> ${targetId}`);
      }
    }
  }
  
  return {
    type: 'component',
    title: 'Component Diagram',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Dependency Graph
// ============================================================================

/**
 * Generate a dependency graph showing module relationships
 */
export function generateDependencyGraph(
  modules: Module[],
  edges: ArchitectureEdge[],
  nodes: ArchitectureNode[]
): DiagramReference {
  const lines: string[] = ['graph LR'];
  
  // Add modules
  for (const module of modules.slice(0, 20)) {
    const moduleId = sanitizeId(module.path);
    const label = module.name;
    const shape = module.isEntryPoint ? `((${label}))` : `[${label}]`;
    lines.push(`    ${moduleId}${shape}`);
  }
  
  // Add dependency edges
  const importEdges = edges.filter(e => e.type === 'imports' || e.type === 'depends_on');
  const edgeSet = new Set<string>();
  
  for (const edge of importEdges.slice(0, 40)) {
    const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = nodes.find(n => n.id === edge.targetNodeId);
    
    if (sourceNode && targetNode) {
      const sourceId = sanitizeId(sourceNode.filePath || sourceNode.name);
      const targetId = sanitizeId(targetNode.filePath || targetNode.name);
      const edgeKey = `${sourceId}-${targetId}`;
      
      if (!edgeSet.has(edgeKey) && sourceId !== targetId) {
        edgeSet.add(edgeKey);
        lines.push(`    ${sourceId} --> ${targetId}`);
      }
    }
  }
  
  return {
    type: 'dependency',
    title: 'Dependency Graph',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Service Map
// ============================================================================

/**
 * Generate a service map showing microservices and their connections
 */
export function generateServiceMap(
  services: Service[],
  technologies: Technology[]
): DiagramReference {
  const lines: string[] = ['graph TB'];
  
  // Group by service type
  const restApis = services.filter(s => s.type === 'rest_api');
  const graphqlServices = services.filter(s => s.type === 'graphql');
  const workers = services.filter(s => s.type === 'worker' || s.type === 'message_consumer');
  const crons = services.filter(s => s.type === 'cron_job');
  
  // Add client
  lines.push('    Client[("Client")]');
  
  // Add API services
  if (restApis.length > 0 || graphqlServices.length > 0) {
    lines.push('    subgraph APIs["API Layer"]');
    for (const service of [...restApis, ...graphqlServices]) {
      const id = sanitizeId(service.name);
      lines.push(`        ${id}["${service.name}"]`);
    }
    lines.push('    end');
    lines.push('    Client --> APIs');
  }
  
  // Add workers
  if (workers.length > 0) {
    lines.push('    subgraph Workers["Background Workers"]');
    for (const service of workers) {
      const id = sanitizeId(service.name);
      lines.push(`        ${id}["${service.name}"]`);
    }
    lines.push('    end');
  }
  
  // Add cron jobs
  if (crons.length > 0) {
    lines.push('    subgraph Scheduled["Scheduled Jobs"]');
    for (const service of crons) {
      const id = sanitizeId(service.name);
      lines.push(`        ${id}["${service.name}"]`);
    }
    lines.push('    end');
  }
  
  // Add databases
  const databases = technologies.filter(t => t.category === 'database');
  if (databases.length > 0) {
    lines.push('    subgraph Data["Data Layer"]');
    for (const db of databases) {
      const id = sanitizeId(db.name);
      lines.push(`        ${id}[("${db.name}")]`);
    }
    lines.push('    end');
    
    // Connect APIs to databases
    if (restApis.length > 0 || graphqlServices.length > 0) {
      lines.push('    APIs --> Data');
    }
    if (workers.length > 0) {
      lines.push('    Workers --> Data');
    }
  }
  
  // Add caches
  const caches = technologies.filter(t => t.category === 'cache');
  if (caches.length > 0) {
    lines.push('    subgraph Cache["Cache Layer"]');
    for (const cache of caches) {
      const id = sanitizeId(cache.name);
      lines.push(`        ${id}[("${cache.name}")]`);
    }
    lines.push('    end');
    
    if (restApis.length > 0 || graphqlServices.length > 0) {
      lines.push('    APIs --> Cache');
    }
  }
  
  // Add queues
  const queues = technologies.filter(t => t.category === 'queue');
  if (queues.length > 0) {
    lines.push('    subgraph Queues["Message Queues"]');
    for (const queue of queues) {
      const id = sanitizeId(queue.name);
      lines.push(`        ${id}[["${queue.name}"]]`);
    }
    lines.push('    end');
    
    if (restApis.length > 0) {
      lines.push('    APIs --> Queues');
    }
    if (workers.length > 0) {
      lines.push('    Queues --> Workers');
    }
  }
  
  return {
    type: 'service_map',
    title: 'Service Map',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Layer Diagram
// ============================================================================

/**
 * Generate a layer diagram showing architectural layers
 */
export function generateLayerDiagram(
  layers: Layer[]
): DiagramReference {
  const lines: string[] = ['graph TD'];
  
  // Sort layers by order
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  
  // Add layer boxes
  for (const layer of sortedLayers) {
    const id = sanitizeId(layer.type);
    lines.push(`    ${id}["${layer.name}"]`);
  }
  
  // Connect layers in order
  for (let i = 0; i < sortedLayers.length - 1; i++) {
    const current = sanitizeId(sortedLayers[i].type);
    const next = sanitizeId(sortedLayers[i + 1].type);
    lines.push(`    ${current} --> ${next}`);
  }
  
  // Add styling
  lines.push('');
  lines.push('    classDef presentation fill:#e1f5fe');
  lines.push('    classDef api fill:#e8f5e9');
  lines.push('    classDef application fill:#fff3e0');
  lines.push('    classDef domain fill:#fce4ec');
  lines.push('    classDef infrastructure fill:#f3e5f5');
  lines.push('    classDef database fill:#e0f2f1');
  
  for (const layer of sortedLayers) {
    const id = sanitizeId(layer.type);
    lines.push(`    class ${id} ${layer.type}`);
  }
  
  return {
    type: 'layer',
    title: 'Architecture Layers',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Data Flow Diagram
// ============================================================================

/**
 * Generate a data flow diagram showing request flow
 */
export function generateDataFlowDiagram(
  entryPoints: EntryPoint[],
  _edges: ArchitectureEdge[],
  nodes: ArchitectureNode[]
): DiagramReference {
  const lines: string[] = ['graph LR'];
  
  // Add client
  lines.push('    Client(("Client"))');
  
  // Add entry points (routes, handlers)
  const routes = entryPoints.filter(ep =>
    ['route', 'handler', 'controller'].includes(ep.type)
  );
  
  if (routes.length > 0) {
    lines.push('    subgraph Handlers["Request Handlers"]');
    for (const route of routes.slice(0, 10)) {
      const id = sanitizeId(route.name);
      const label = route.routePath || route.name;
      lines.push(`        ${id}["${label}"]`);
    }
    lines.push('    end');
    lines.push('    Client --> Handlers');
  }
  
  // Add services
  const serviceNodes = nodes.filter(n => n.type === 'service');
  if (serviceNodes.length > 0) {
    lines.push('    subgraph Services["Services"]');
    for (const service of serviceNodes.slice(0, 10)) {
      const id = sanitizeId(service.name);
      lines.push(`        ${id}["${service.name}"]`);
    }
    lines.push('    end');
    
    if (routes.length > 0) {
      lines.push('    Handlers --> Services');
    }
  }
  
  // Add databases
  const dbNodes = nodes.filter(n => n.type === 'database');
  if (dbNodes.length > 0) {
    lines.push('    subgraph Database["Data"]');
    for (const db of dbNodes) {
      const id = sanitizeId(db.name);
      lines.push(`        ${id}[("${db.name}")]`);
    }
    lines.push('    end');
    
    if (serviceNodes.length > 0) {
      lines.push('    Services --> Database');
    } else if (routes.length > 0) {
      lines.push('    Handlers --> Database');
    }
  }
  
  // Add external services
  const externalNodes = nodes.filter(n =>
    n.type === 'api_endpoint' && n.metadata.external
  );
  if (externalNodes.length > 0) {
    lines.push('    subgraph External["External APIs"]');
    for (const ext of externalNodes.slice(0, 5)) {
      const id = sanitizeId(ext.name);
      lines.push(`        ${id}["${ext.name}"]`);
    }
    lines.push('    end');
    
    if (serviceNodes.length > 0) {
      lines.push('    Services --> External');
    }
  }
  
  return {
    type: 'data_flow',
    title: 'Data Flow Diagram',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Sequence Diagram
// ============================================================================

/**
 * Generate a sequence diagram for a request flow
 */
export function generateSequenceDiagram(
  path: ExecutionPath
): DiagramReference {
  const lines: string[] = ['sequenceDiagram'];
  
  // Add participants
  const participants = new Set<string>();
  participants.add('Client');
  
  for (const step of path.steps) {
    participants.add(step.nodeName);
  }
  
  for (const participant of participants) {
    const id = sanitizeId(participant);
    lines.push(`    participant ${id} as ${participant}`);
  }
  
  lines.push('');
  
  // Add interactions
  let prevStep = 'Client';
  for (const step of path.steps) {
    const stepId = sanitizeId(step.nodeName);
    const prevId = sanitizeId(prevStep);
    
    const action = step.nodeType === 'function' ? 'call' :
                   step.nodeType === 'database' ? 'query' :
                   step.nodeType === 'api_endpoint' ? 'request' :
                   'invoke';
    
    lines.push(`    ${prevId}->>+${stepId}: ${action}`);
    prevStep = step.nodeName;
  }
  
  // Add return path
  const reversedSteps = [...path.steps].reverse();
  for (let i = 0; i < reversedSteps.length - 1; i++) {
    const current = sanitizeId(reversedSteps[i].nodeName);
    const next = sanitizeId(reversedSteps[i + 1].nodeName);
    lines.push(`    ${current}-->>-${next}: response`);
  }
  
  if (reversedSteps.length > 0) {
    const last = sanitizeId(reversedSteps[reversedSteps.length - 1].nodeName);
    lines.push(`    ${last}-->>-Client: response`);
  }
  
  return {
    type: 'sequence',
    title: `Sequence: ${path.name}`,
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// API Endpoint Diagram
// ============================================================================

/**
 * Generate a diagram of API endpoints
 */
export function generateApiDiagram(
  endpoints: ApiEndpoint[]
): DiagramReference {
  const lines: string[] = ['graph LR'];
  
  // Group by path prefix
  const byPrefix = new Map<string, ApiEndpoint[]>();
  
  for (const endpoint of endpoints) {
    const parts = endpoint.path.split('/').filter(Boolean);
    const prefix = parts[0] || 'root';
    
    if (!byPrefix.has(prefix)) {
      byPrefix.set(prefix, []);
    }
    byPrefix.get(prefix)!.push(endpoint);
  }
  
  // Add client
  lines.push('    Client(("Client"))');
  
  // Add endpoint groups
  for (const [prefix, prefixEndpoints] of byPrefix.entries()) {
    const groupId = sanitizeId(prefix);
    lines.push(`    subgraph ${groupId}["/${prefix}"]`);
    
    for (const endpoint of prefixEndpoints.slice(0, 5)) {
      const id = sanitizeId(`${endpoint.method}_${endpoint.path}`);
      const label = `${endpoint.method} ${endpoint.path}`;
      lines.push(`        ${id}["${label}"]`);
    }
    
    lines.push('    end');
    lines.push(`    Client --> ${groupId}`);
  }
  
  return {
    type: 'component',
    title: 'API Endpoints',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Package Graph
// ============================================================================

/**
 * Generate a package/folder structure diagram
 */
export function generatePackageGraph(
  modules: Module[]
): DiagramReference {
  const lines: string[] = ['graph TB'];
  
  // Group modules by parent directory
  const byParent = new Map<string, Module[]>();
  
  for (const module of modules) {
    const parts = module.path.split('/');
    const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    
    if (!byParent.has(parent)) {
      byParent.set(parent, []);
    }
    byParent.get(parent)!.push(module);
  }
  
  // Add groups
  for (const [parent, children] of byParent.entries()) {
    const parentId = sanitizeId(parent);
    
    if (children.length > 1) {
      lines.push(`    subgraph ${parentId}["${parent}"]`);
      for (const child of children.slice(0, 10)) {
        const childId = sanitizeId(child.path);
        lines.push(`        ${childId}["${child.name}"]`);
      }
      lines.push('    end');
    } else {
      const child = children[0];
      const childId = sanitizeId(child.path);
      lines.push(`    ${childId}["${child.name}"]`);
    }
  }
  
  return {
    type: 'package_graph',
    title: 'Package Structure',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Technology Stack Diagram
// ============================================================================

/**
 * Generate a technology stack visualization
 */
export function generateTechStackDiagram(
  technologies: Technology[]
): DiagramReference {
  const lines: string[] = ['graph TB'];
  
  // Group by category
  const byCategory = new Map<string, Technology[]>();
  
  for (const tech of technologies) {
    if (!byCategory.has(tech.category)) {
      byCategory.set(tech.category, []);
    }
    byCategory.get(tech.category)!.push(tech);
  }
  
  // Category order and styling
  const categoryOrder = [
    'language',
    'framework',
    'database',
    'cache',
    'queue',
    'container',
    'ci_cd',
    'testing',
    'monitoring',
    'build_tool',
  ];
  
  const sortedCategories = [...byCategory.entries()].sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a[0]);
    const bIndex = categoryOrder.indexOf(b[0]);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  
  for (const [category, techs] of sortedCategories) {
    const categoryId = sanitizeId(category);
    const categoryName = formatCategory(category);
    
    lines.push(`    subgraph ${categoryId}["${categoryName}"]`);
    for (const tech of techs) {
      const techId = sanitizeId(`${category}_${tech.name}`);
      const label = tech.version ? `${tech.name} ${tech.version}` : tech.name;
      lines.push(`        ${techId}["${label}"]`);
    }
    lines.push('    end');
  }
  
  return {
    type: 'component',
    title: 'Technology Stack',
    content: lines.join('\n'),
    format: 'mermaid',
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sanitize a string for use as a Mermaid ID
 */
function sanitizeId(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50) || 'node';
}

/**
 * Format a node type for display
 */
function formatNodeType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format a category for display
 */
function formatCategory(category: string): string {
  const names: Record<string, string> = {
    language: 'Languages',
    framework: 'Frameworks',
    database: 'Databases',
    cache: 'Caching',
    queue: 'Message Queues',
    container: 'Containers',
    orchestration: 'Orchestration',
    ci_cd: 'CI/CD',
    testing: 'Testing',
    monitoring: 'Monitoring',
    logging: 'Logging',
    build_tool: 'Build Tools',
    storage: 'Storage',
    external_api: 'External APIs',
  };
  
  return names[category] || formatNodeType(category);
}

/**
 * Group items by a key
 */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  return groups;
}

// ============================================================================
// Main Diagram Generator
// ============================================================================

export interface DiagramContext {
  services: Service[];
  layers: Layer[];
  modules: Module[];
  entryPoints: EntryPoint[];
  apiEndpoints: ApiEndpoint[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  technologies: Technology[];
  executionPaths: ExecutionPath[];
}

/**
 * Generate all available diagrams
 */
export function generateAllDiagrams(
  context: DiagramContext
): DiagramReference[] {
  const diagrams: DiagramReference[] = [];
  
  // Component diagram
  if (context.services.length > 0 || context.nodes.length > 0) {
    diagrams.push(generateComponentDiagram(
      context.services,
      context.nodes,
      context.edges
    ));
  }
  
  // Service map
  if (context.services.length > 0) {
    diagrams.push(generateServiceMap(
      context.services,
      context.technologies
    ));
  }
  
  // Layer diagram
  if (context.layers.length > 0) {
    diagrams.push(generateLayerDiagram(context.layers));
  }
  
  // Dependency graph
  if (context.modules.length > 0) {
    diagrams.push(generateDependencyGraph(
      context.modules,
      context.edges,
      context.nodes
    ));
  }
  
  // Data flow diagram
  if (context.entryPoints.length > 0) {
    diagrams.push(generateDataFlowDiagram(
      context.entryPoints,
      context.edges,
      context.nodes
    ));
  }
  
  // API diagram
  if (context.apiEndpoints.length > 0) {
    diagrams.push(generateApiDiagram(context.apiEndpoints));
  }
  
  // Package graph
  if (context.modules.length > 0) {
    diagrams.push(generatePackageGraph(context.modules));
  }
  
  // Tech stack diagram
  if (context.technologies.length > 0) {
    diagrams.push(generateTechStackDiagram(context.technologies));
  }
  
  // Sequence diagrams for execution paths
  for (const path of context.executionPaths.slice(0, 3)) {
    diagrams.push(generateSequenceDiagram(path));
  }
  
  return diagrams;
}

/**
 * Generate a specific diagram type
 */
export function generateDiagram(
  type: DiagramType,
  context: DiagramContext
): DiagramReference | null {
  switch (type) {
    case 'component':
      return generateComponentDiagram(context.services, context.nodes, context.edges);
    case 'service_map':
      return generateServiceMap(context.services, context.technologies);
    case 'layer':
      return context.layers.length > 0 ? generateLayerDiagram(context.layers) : null;
    case 'dependency':
      return generateDependencyGraph(context.modules, context.edges, context.nodes);
    case 'data_flow':
      return generateDataFlowDiagram(context.entryPoints, context.edges, context.nodes);
    case 'package_graph':
      return generatePackageGraph(context.modules);
    case 'sequence':
      return context.executionPaths.length > 0 
        ? generateSequenceDiagram(context.executionPaths[0])
        : null;
    default:
      return null;
  }
}
