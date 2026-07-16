/**
 * Relationship Extractors
 * 
 * Extract nodes and edges from repository files to build the
 * Repository Relationship Graph.
 */

import type { RepoFile, Symbol, Import, Dependency } from '../../types';
import type { NewGraphNode, GraphNodeType, GraphEdgeType } from '../../types/graph';

// ============================================================================
// Code Relationship Extractor
// ============================================================================

interface ExtractedNode {
  node: NewGraphNode;
  sourceRef?: string; // Used to link edges later
}

interface ExtractedEdge {
  sourceRef: string;
  targetRef: string;
  type: GraphEdgeType;
  weight: number;
  metadata: Record<string, unknown>;
}

export interface ExtractionResult {
  nodes: ExtractedNode[];
  edges: ExtractedEdge[];
}

/**
 * Extract code relationships from TypeScript/JavaScript files
 */
export function extractCodeRelationships(
  files: RepoFile[],
  symbols: Symbol[],
  imports: Import[],
  repositoryId: number
): ExtractionResult {
  const nodes: ExtractedNode[] = [];
  const edges: ExtractedEdge[] = [];
  
  // Create file nodes
  for (const file of files) {
    const extension = file.extension || '';
    if (!['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java'].includes(extension)) {
      continue;
    }
    
    nodes.push({
      node: {
        repositoryId,
        type: 'file',
        name: file.name,
        description: null,
        filePath: file.path,
        startLine: null,
        endLine: null,
        language: file.language,
        metadata: { extension, size: file.size },
        tags: [],
        metrics: {},
        embedding: null,
      },
      sourceRef: `file:${file.path}`,
    });
  }
  
  // Create symbol nodes
  for (const symbol of symbols) {
    const file = files.find(f => f.id === symbol.fileId);
    if (!file) continue;
    
    let nodeType: GraphNodeType;
    switch (symbol.kind) {
      case 'function':
        nodeType = 'function';
        break;
      case 'class':
        nodeType = 'class';
        break;
      case 'interface':
        nodeType = 'interface';
        break;
      case 'method':
        nodeType = 'method';
        break;
      case 'type':
        nodeType = 'interface';
        break;
      default:
        nodeType = 'variable';
    }
    
    nodes.push({
      node: {
        repositoryId,
        type: nodeType,
        name: symbol.name,
        description: symbol.docstring,
        filePath: file.path,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        language: file.language,
        metadata: { kind: symbol.kind, signature: symbol.signature },
        tags: [],
        metrics: {},
        embedding: null,
      },
      sourceRef: `symbol:${file.path}:${symbol.name}`,
    });
    
    // Create contains edge from file to symbol
    edges.push({
      sourceRef: `file:${file.path}`,
      targetRef: `symbol:${file.path}:${symbol.name}`,
      type: 'contains',
      weight: 1,
      metadata: {},
    });
  }
  
  // Create import edges
  for (const imp of imports) {
    const sourceFile = files.find(f => f.id === imp.fileId);
    if (!sourceFile) continue;
    
    // Try to resolve the import to a file in the repository
    const targetPath = resolveImportPath(sourceFile.path, imp.source, files);
    
    if (targetPath) {
      edges.push({
        sourceRef: `file:${sourceFile.path}`,
        targetRef: `file:${targetPath}`,
        type: 'imports',
        weight: 1,
        metadata: { 
          source: imp.source, 
          specifiers: imp.specifiers,
          isDefault: imp.isDefault,
        },
      });
    } else if (!imp.source.startsWith('.')) {
      // External dependency
      nodes.push({
        node: {
          repositoryId,
          type: 'external_service',
          name: imp.source.split('/')[0],
          description: `External module: ${imp.source}`,
          filePath: null,
          startLine: null,
          endLine: null,
          language: null,
          metadata: { isExternal: true, fullPath: imp.source },
          tags: ['external'],
          metrics: {},
          embedding: null,
        },
        sourceRef: `external:${imp.source.split('/')[0]}`,
      });
      
      edges.push({
        sourceRef: `file:${sourceFile.path}`,
        targetRef: `external:${imp.source.split('/')[0]}`,
        type: 'depends_on',
        weight: 1,
        metadata: { source: imp.source },
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Resolve an import path to a file path
 */
function resolveImportPath(
  fromPath: string,
  importPath: string,
  files: RepoFile[]
): string | null {
  if (!importPath.startsWith('.')) return null;
  
  const fromDir = fromPath.split('/').slice(0, -1).join('/');
  const parts = importPath.split('/');
  const dirParts = fromDir.split('/').filter(p => p);
  
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      dirParts.pop();
    } else {
      dirParts.push(part);
    }
  }
  
  const resolvedPath = dirParts.join('/');
  
  // Try with different extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  
  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    if (files.some(f => f.path === fullPath)) {
      return fullPath;
    }
  }
  
  return null;
}

// ============================================================================
// Infrastructure Relationship Extractor
// ============================================================================

/**
 * Extract infrastructure relationships from Docker, Kubernetes, etc.
 */
export function extractInfrastructureRelationships(
  files: RepoFile[],
  repositoryId: number
): ExtractionResult {
  const nodes: ExtractedNode[] = [];
  const edges: ExtractedEdge[] = [];
  
  for (const file of files) {
    // Docker files
    if (file.name === 'Dockerfile' || file.name.startsWith('Dockerfile.')) {
      const serviceName = file.name === 'Dockerfile' 
        ? 'main' 
        : file.name.replace('Dockerfile.', '');
      
      nodes.push({
        node: {
          repositoryId,
          type: 'container',
          name: serviceName,
          description: `Docker container for ${serviceName}`,
          filePath: file.path,
          startLine: null,
          endLine: null,
          language: 'dockerfile',
          metadata: parseDockerfile(file.content || ''),
          tags: ['docker', 'infrastructure'],
          metrics: {},
          embedding: null,
        },
        sourceRef: `container:${serviceName}`,
      });
    }
    
    // Docker Compose
    if (file.name === 'docker-compose.yml' || file.name === 'docker-compose.yaml') {
      const services = parseDockerCompose(file.content || '');
      
      for (const service of services) {
        nodes.push({
          node: {
            repositoryId,
            type: 'container',
            name: service.name,
            description: `Docker Compose service: ${service.name}`,
            filePath: file.path,
            startLine: null,
            endLine: null,
            language: 'yaml',
            metadata: service.metadata,
            tags: ['docker-compose', 'infrastructure'],
            metrics: {},
            embedding: null,
          },
          sourceRef: `compose:${service.name}`,
        });
        
        // Add dependency edges between services
        for (const dep of service.dependsOn) {
          edges.push({
            sourceRef: `compose:${service.name}`,
            targetRef: `compose:${dep}`,
            type: 'depends_on',
            weight: 1,
            metadata: {},
          });
        }
      }
    }
    
    // Kubernetes manifests
    if (file.extension === 'yaml' || file.extension === 'yml') {
      const k8sResources = parseKubernetesManifest(file.content || '', file.path);
      
      for (const resource of k8sResources) {
        nodes.push({
          node: {
            repositoryId,
            type: resource.type as GraphNodeType,
            name: resource.name,
            description: resource.description,
            filePath: file.path,
            startLine: null,
            endLine: null,
            language: 'yaml',
            metadata: resource.metadata,
            tags: ['kubernetes', 'infrastructure'],
            metrics: {},
            embedding: null,
          },
          sourceRef: `k8s:${resource.kind}:${resource.name}`,
        });
      }
    }
    
    // GitHub Actions
    if (file.path.startsWith('.github/workflows/') && 
        (file.extension === 'yml' || file.extension === 'yaml')) {
      const workflow = parseGitHubAction(file.content || '', file.name);
      
      nodes.push({
        node: {
          repositoryId,
          type: 'worker',
          name: workflow.name,
          description: `GitHub Actions workflow: ${workflow.name}`,
          filePath: file.path,
          startLine: null,
          endLine: null,
          language: 'yaml',
          metadata: workflow.metadata,
          tags: ['github-actions', 'ci-cd'],
          metrics: {},
          embedding: null,
        },
        sourceRef: `workflow:${workflow.name}`,
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Parse Dockerfile content
 */
function parseDockerfile(content: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  
  const fromMatch = content.match(/FROM\s+([^\s]+)/);
  if (fromMatch) metadata.baseImage = fromMatch[1];
  
  const exposeMatches = [...content.matchAll(/EXPOSE\s+(\d+)/g)];
  metadata.ports = exposeMatches.map(m => parseInt(m[1]));
  
  const envMatches = [...content.matchAll(/ENV\s+(\w+)=?/g)];
  metadata.envVars = envMatches.map(m => m[1]);
  
  return metadata;
}

interface DockerComposeService {
  name: string;
  metadata: Record<string, unknown>;
  dependsOn: string[];
}

/**
 * Parse Docker Compose content
 */
function parseDockerCompose(content: string): DockerComposeService[] {
  const services: DockerComposeService[] = [];
  
  // Simple YAML parsing for services
  const serviceMatches = [...content.matchAll(/^\s{2}(\w+):/gm)];
  let inServices = false;
  
  for (const match of serviceMatches) {
    const name = match[1];
    if (name === 'services') {
      inServices = true;
      continue;
    }
    if (!inServices || ['version', 'networks', 'volumes'].includes(name)) {
      continue;
    }
    
    // Find depends_on for this service
    const serviceStart = match.index || 0;
    const serviceContent = content.slice(serviceStart);
    const dependsOnMatch = serviceContent.match(/depends_on:\s*\n((?:\s+-\s+\w+\n?)+)/);
    const dependsOn: string[] = [];
    
    if (dependsOnMatch) {
      const deps = dependsOnMatch[1].matchAll(/\s+-\s+(\w+)/g);
      for (const dep of deps) {
        dependsOn.push(dep[1]);
      }
    }
    
    services.push({
      name,
      metadata: {},
      dependsOn,
    });
  }
  
  return services;
}

interface K8sResource {
  kind: string;
  type: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse Kubernetes manifest
 */
function parseKubernetesManifest(content: string, _filePath: string): K8sResource[] {
  const resources: K8sResource[] = [];
  
  // Check if this looks like a Kubernetes manifest
  const kindMatch = content.match(/kind:\s*(\w+)/);
  const nameMatch = content.match(/name:\s*["']?([^"'\s\n]+)/);
  
  if (kindMatch && nameMatch) {
    const kind = kindMatch[1];
    const name = nameMatch[1];
    
    let type: string;
    switch (kind.toLowerCase()) {
      case 'deployment':
      case 'statefulset':
      case 'daemonset':
        type = 'deployment';
        break;
      case 'service':
        type = 'api_endpoint';
        break;
      case 'configmap':
      case 'secret':
        type = 'configuration';
        break;
      case 'cronjob':
        type = 'cron';
        break;
      default:
        type = 'deployment';
    }
    
    resources.push({
      kind,
      type,
      name,
      description: `Kubernetes ${kind}: ${name}`,
      metadata: { kind },
    });
  }
  
  return resources;
}

interface GitHubWorkflow {
  name: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse GitHub Actions workflow
 */
function parseGitHubAction(content: string, fileName: string): GitHubWorkflow {
  const nameMatch = content.match(/name:\s*["']?([^"'\n]+)/);
  const name = nameMatch ? nameMatch[1].trim() : fileName.replace('.yml', '').replace('.yaml', '');
  
  const triggerMatches = [...content.matchAll(/on:\s*\n((?:\s+\w+.*\n?)+)/g)];
  const triggers: string[] = [];
  
  if (triggerMatches.length > 0) {
    const triggerBlock = triggerMatches[0][1];
    const individualTriggers = triggerBlock.matchAll(/\s+(\w+):/g);
    for (const t of individualTriggers) {
      triggers.push(t[1]);
    }
  }
  
  return {
    name,
    metadata: { triggers },
  };
}

// ============================================================================
// Runtime Relationship Extractor
// ============================================================================

/**
 * Extract runtime relationships (routes, event handlers, etc.)
 */
export function extractRuntimeRelationships(
  files: RepoFile[],
  repositoryId: number
): ExtractionResult {
  const nodes: ExtractedNode[] = [];
  const edges: ExtractedEdge[] = [];
  
  for (const file of files) {
    if (!file.content) continue;
    
    const extension = file.extension || '';
    if (!['ts', 'tsx', 'js', 'jsx'].includes(extension)) continue;
    
    // Extract HTTP routes
    const routes = extractHttpRoutes(file.content, file.path);
    for (const route of routes) {
      nodes.push({
        node: {
          repositoryId,
          type: 'api_endpoint',
          name: `${route.method} ${route.path}`,
          description: route.description,
          filePath: file.path,
          startLine: route.line,
          endLine: route.line,
          language: file.language,
          metadata: { method: route.method, path: route.path, handler: route.handler },
          tags: ['http', 'api'],
          metrics: {},
          embedding: null,
        },
        sourceRef: `route:${route.method}:${route.path}`,
      });
      
      // Link route to file
      edges.push({
        sourceRef: `file:${file.path}`,
        targetRef: `route:${route.method}:${route.path}`,
        type: 'contains',
        weight: 1,
        metadata: {},
      });
    }
    
    // Extract event handlers/listeners
    const handlers = extractEventHandlers(file.content, file.path);
    for (const handler of handlers) {
      nodes.push({
        node: {
          repositoryId,
          type: 'worker',
          name: handler.event,
          description: `Event handler for ${handler.event}`,
          filePath: file.path,
          startLine: handler.line,
          endLine: handler.line,
          language: file.language,
          metadata: { event: handler.event, type: handler.type },
          tags: ['event', handler.type],
          metrics: {},
          embedding: null,
        },
        sourceRef: `handler:${file.path}:${handler.event}`,
      });
    }
    
    // Extract database operations
    const dbOps = extractDatabaseOperations(file.content, file.path);
    for (const op of dbOps) {
      edges.push({
        sourceRef: `file:${file.path}`,
        targetRef: `database:${op.database}`,
        type: op.operation === 'read' ? 'reads' : 'writes',
        weight: 1,
        metadata: { operation: op.operation, table: op.table },
      });
    }
  }
  
  return { nodes, edges };
}

interface HttpRoute {
  method: string;
  path: string;
  handler: string;
  line: number;
  description: string;
}

/**
 * Extract HTTP routes from code
 */
function extractHttpRoutes(content: string, filePath: string): HttpRoute[] {
  const routes: HttpRoute[] = [];
  const lines = content.split('\n');
  
  // Express/Fastify style routes
  const expressPatterns = [
    /\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)/gi,
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)/gi,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of expressPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          handler: filePath,
          line: i + 1,
          description: `${match[1].toUpperCase()} ${match[2]}`,
        });
      }
    }
    
    // Next.js API routes
    if (filePath.includes('/api/') && line.includes('export')) {
      const methodMatch = line.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/i);
      if (methodMatch) {
        const apiPath = filePath
          .replace(/.*\/api\//, '/api/')
          .replace(/\.(ts|js)x?$/, '')
          .replace(/\/route$/, '')
          .replace(/\/\[([^\]]+)\]/g, '/:$1');
        
        routes.push({
          method: methodMatch[2].toUpperCase(),
          path: apiPath,
          handler: filePath,
          line: i + 1,
          description: `${methodMatch[2].toUpperCase()} ${apiPath}`,
        });
      }
    }
  }
  
  return routes;
}

interface EventHandler {
  event: string;
  type: string;
  line: number;
}

/**
 * Extract event handlers from code
 */
function extractEventHandlers(content: string, _filePath: string): EventHandler[] {
  const handlers: EventHandler[] = [];
  const lines = content.split('\n');
  
  const patterns = [
    { regex: /\.on\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'event-emitter' },
    { regex: /addEventListener\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'dom-event' },
    { regex: /\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]/g, type: 'subscription' },
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const { regex, type } of patterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        handlers.push({
          event: match[1],
          type,
          line: i + 1,
        });
      }
    }
  }
  
  return handlers;
}

interface DatabaseOperation {
  database: string;
  operation: 'read' | 'write';
  table: string | null;
}

/**
 * Extract database operations from code
 */
function extractDatabaseOperations(content: string, _filePath: string): DatabaseOperation[] {
  const operations: DatabaseOperation[] = [];
  
  // SQL patterns
  const selectMatch = content.match(/SELECT\s+.*\s+FROM\s+(\w+)/gi);
  if (selectMatch) {
    operations.push({ database: 'sql', operation: 'read', table: null });
  }
  
  const insertMatch = content.match(/INSERT\s+INTO\s+(\w+)/gi);
  const updateMatch = content.match(/UPDATE\s+(\w+)/gi);
  const deleteMatch = content.match(/DELETE\s+FROM\s+(\w+)/gi);
  
  if (insertMatch || updateMatch || deleteMatch) {
    operations.push({ database: 'sql', operation: 'write', table: null });
  }
  
  // MongoDB patterns
  if (content.includes('.find(') || content.includes('.findOne(') || content.includes('.aggregate(')) {
    operations.push({ database: 'mongodb', operation: 'read', table: null });
  }
  
  if (content.includes('.insert') || content.includes('.update') || content.includes('.delete')) {
    operations.push({ database: 'mongodb', operation: 'write', table: null });
  }
  
  // Redis patterns
  if (content.includes('redis.get') || content.includes('.hget') || content.includes('.mget')) {
    operations.push({ database: 'redis', operation: 'read', table: null });
  }
  
  if (content.includes('redis.set') || content.includes('.hset') || content.includes('.mset')) {
    operations.push({ database: 'redis', operation: 'write', table: null });
  }
  
  return operations;
}

// ============================================================================
// Documentation Relationship Extractor
// ============================================================================

/**
 * Extract documentation relationships
 */
export function extractDocumentationRelationships(
  files: RepoFile[],
  repositoryId: number
): ExtractionResult {
  const nodes: ExtractedNode[] = [];
  const edges: ExtractedEdge[] = [];
  
  for (const file of files) {
    if (!file.content) continue;
    
    const extension = file.extension || '';
    if (!['md', 'mdx', 'rst', 'txt'].includes(extension)) continue;
    
    // Skip files that are too small
    if (file.content.length < 50) continue;
    
    nodes.push({
      node: {
        repositoryId,
        type: 'documentation',
        name: file.name,
        description: extractDocSummary(file.content),
        filePath: file.path,
        startLine: null,
        endLine: null,
        language: 'markdown',
        metadata: { 
          isReadme: file.name.toLowerCase() === 'readme.md',
          isADR: file.path.toLowerCase().includes('adr'),
          isRFC: file.path.toLowerCase().includes('rfc'),
        },
        tags: ['documentation'],
        metrics: { wordCount: file.content.split(/\s+/).length },
        embedding: null,
      },
      sourceRef: `doc:${file.path}`,
    });
    
    // Extract code references from documentation
    const codeRefs = extractCodeReferences(file.content);
    for (const ref of codeRefs) {
      edges.push({
        sourceRef: `doc:${file.path}`,
        targetRef: `file:${ref}`,
        type: 'documents',
        weight: 1,
        metadata: {},
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Extract a summary from documentation content
 */
function extractDocSummary(content: string): string {
  // Remove markdown headers
  const lines = content.split('\n')
    .filter(line => !line.startsWith('#'))
    .filter(line => line.trim().length > 0);
  
  const summary = lines.slice(0, 3).join(' ').trim();
  return summary.length > 200 ? summary.slice(0, 197) + '...' : summary;
}

/**
 * Extract code file references from markdown
 */
function extractCodeReferences(content: string): string[] {
  const refs: string[] = [];
  
  // Match file paths in code blocks
  const codeBlockRefs = [...content.matchAll(/```\w*\s*\n[^`]*\/([a-zA-Z0-9_\-./]+\.(ts|js|py|go|rs|java))/g)];
  for (const match of codeBlockRefs) {
    refs.push(match[1]);
  }
  
  // Match inline code with file paths
  const inlineRefs = [...content.matchAll(/`([a-zA-Z0-9_\-./]+\.(ts|js|py|go|rs|java))`/g)];
  for (const match of inlineRefs) {
    refs.push(match[1]);
  }
  
  return [...new Set(refs)];
}

// ============================================================================
// Dependency Relationship Extractor
// ============================================================================

/**
 * Extract dependency relationships from package files
 */
export function extractDependencyRelationships(
  dependencies: Dependency[],
  repositoryId: number
): ExtractionResult {
  const nodes: ExtractedNode[] = [];
  const edges: ExtractedEdge[] = [];
  
  // Create a root package node
  nodes.push({
    node: {
      repositoryId,
      type: 'package',
      name: 'root',
      description: 'Root package',
      filePath: 'package.json',
      startLine: null,
      endLine: null,
      language: null,
      metadata: {},
      tags: ['root'],
      metrics: { dependencyCount: dependencies.length },
      embedding: null,
    },
    sourceRef: 'package:root',
  });
  
  for (const dep of dependencies) {
    nodes.push({
      node: {
        repositoryId,
        type: 'external_service',
        name: dep.name,
        description: `${dep.ecosystem} dependency: ${dep.name}`,
        filePath: null,
        startLine: null,
        endLine: null,
        language: null,
        metadata: { 
          version: dep.version, 
          ecosystem: dep.ecosystem,
          type: dep.type,
        },
        tags: ['dependency', dep.ecosystem, dep.type],
        metrics: {},
        embedding: null,
      },
      sourceRef: `dep:${dep.ecosystem}:${dep.name}`,
    });
    
    edges.push({
      sourceRef: 'package:root',
      targetRef: `dep:${dep.ecosystem}:${dep.name}`,
      type: 'depends_on',
      weight: dep.type === 'production' ? 1 : 0.5,
      metadata: { version: dep.version, depType: dep.type },
    });
  }
  
  return { nodes, edges };
}
