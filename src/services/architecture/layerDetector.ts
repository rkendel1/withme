/**
 * Layer Detector
 * 
 * Detects architectural layers in the repository based on
 * directory structure and file patterns.
 */

import type { Layer, LayerType } from '../../types/architecture';
import type { RepoFile } from '../../types';

// ============================================================================
// Layer Detection Patterns
// ============================================================================

interface LayerPattern {
  type: LayerType;
  name: string;
  order: number;
  patterns: RegExp[];
  description: string;
}

const LAYER_PATTERNS: LayerPattern[] = [
  // Presentation Layer
  {
    type: 'presentation',
    name: 'Presentation',
    order: 1,
    patterns: [
      /^src\/(components|views|pages|screens|ui)\//,
      /^(components|views|pages|screens|ui)\//,
      /^app\/(components|ui)\//,
      /^frontend\//,
      /^client\//,
      /^web\//,
      /\.(tsx|jsx)$/,
    ],
    description: 'UI components, views, and pages',
  },
  
  // API Layer
  {
    type: 'api',
    name: 'API',
    order: 2,
    patterns: [
      /^src\/(api|routes|controllers|handlers|endpoints)\//,
      /^(api|routes|controllers|handlers|endpoints)\//,
      /^pages\/api\//,
      /^app\/api\//,
      /\.controller\.(ts|js)$/,
      /\.handler\.(ts|js)$/,
      /\.route\.(ts|js)$/,
    ],
    description: 'HTTP handlers, controllers, and route definitions',
  },
  
  // Application Layer
  {
    type: 'application',
    name: 'Application',
    order: 3,
    patterns: [
      /^src\/(services|usecases|application|use-cases)\//,
      /^(services|usecases|application|use-cases)\//,
      /\.service\.(ts|js)$/,
      /\.usecase\.(ts|js)$/,
    ],
    description: 'Business logic, services, and use cases',
  },
  
  // Domain Layer
  {
    type: 'domain',
    name: 'Domain',
    order: 4,
    patterns: [
      /^src\/(domain|models|entities|core)\//,
      /^(domain|models|entities|core)\//,
      /\.entity\.(ts|js)$/,
      /\.model\.(ts|js)$/,
      /\.domain\.(ts|js)$/,
    ],
    description: 'Domain models, entities, and core business rules',
  },
  
  // Infrastructure Layer
  {
    type: 'infrastructure',
    name: 'Infrastructure',
    order: 5,
    patterns: [
      /^src\/(infrastructure|infra|adapters|providers|external)\//,
      /^(infrastructure|infra|adapters|providers|external)\//,
      /\.adapter\.(ts|js)$/,
      /\.provider\.(ts|js)$/,
      /\.repository\.(ts|js)$/,
      /\.gateway\.(ts|js)$/,
    ],
    description: 'External integrations, adapters, and infrastructure code',
  },
  
  // Database Layer
  {
    type: 'database',
    name: 'Database',
    order: 6,
    patterns: [
      /^src\/(db|database|repositories|persistence|migrations|prisma|drizzle|sequelize)\//,
      /^(db|database|repositories|persistence|migrations|prisma|drizzle|sequelize)\//,
      /^prisma\//,
      /\.migration\.(ts|js)$/,
      /schema\.prisma$/,
      /\.sql$/,
    ],
    description: 'Database schemas, migrations, and data access',
  },
  
  // Shared/Common Layer
  {
    type: 'shared',
    name: 'Shared',
    order: 7,
    patterns: [
      /^src\/(shared|common|utils|lib|helpers|utilities)\//,
      /^(shared|common|utils|lib|helpers|utilities)\//,
      /\.util\.(ts|js)$/,
      /\.helper\.(ts|js)$/,
    ],
    description: 'Shared utilities, helpers, and common code',
  },
  
  // Configuration Layer
  {
    type: 'config',
    name: 'Configuration',
    order: 8,
    patterns: [
      /^src\/(config|configuration|settings)\//,
      /^(config|configuration|settings)\//,
      /\.config\.(ts|js|json)$/,
      /\.env/,
      /config\.(ts|js|json|ya?ml)$/,
    ],
    description: 'Application configuration and settings',
  },
  
  // Test Layer
  {
    type: 'test',
    name: 'Tests',
    order: 9,
    patterns: [
      /^(test|tests|__tests__|spec|specs)\//,
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /\.e2e\.(ts|js)$/,
    ],
    description: 'Unit tests, integration tests, and e2e tests',
  },
  
  // External Layer
  {
    type: 'external',
    name: 'External',
    order: 10,
    patterns: [
      /^src\/(clients|integrations|third-party|vendors)\//,
      /^(clients|integrations|third-party|vendors)\//,
      /\.client\.(ts|js)$/,
    ],
    description: 'External API clients and third-party integrations',
  },
];

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect architectural layers in the repository
 */
export function detectLayers(
  files: RepoFile[],
  repositoryId: number
): Omit<Layer, 'id' | 'createdAt'>[] {
  const layerCounts: Record<string, { count: number; matchedPatterns: Set<string> }> = {};
  
  // Count files matching each layer pattern
  for (const file of files) {
    for (const layerPattern of LAYER_PATTERNS) {
      for (const pattern of layerPattern.patterns) {
        if (pattern.test(file.path)) {
          if (!layerCounts[layerPattern.type]) {
            layerCounts[layerPattern.type] = { count: 0, matchedPatterns: new Set() };
          }
          layerCounts[layerPattern.type].count++;
          layerCounts[layerPattern.type].matchedPatterns.add(pattern.source);
          break; // Only count file once per layer
        }
      }
    }
  }
  
  // Create layers for detected patterns
  const detectedLayers: Omit<Layer, 'id' | 'createdAt'>[] = [];
  
  for (const layerPattern of LAYER_PATTERNS) {
    const layerData = layerCounts[layerPattern.type];
    if (layerData && layerData.count > 0) {
      detectedLayers.push({
        repositoryId,
        name: layerPattern.name,
        type: layerPattern.type,
        order: layerPattern.order,
        patterns: Array.from(layerData.matchedPatterns),
        description: layerPattern.description,
      });
    }
  }
  
  // Sort by order
  detectedLayers.sort((a, b) => a.order - b.order);
  
  return detectedLayers;
}

/**
 * Classify a file into a layer
 */
export function classifyFileLayer(filePath: string): LayerType | null {
  for (const layerPattern of LAYER_PATTERNS) {
    for (const pattern of layerPattern.patterns) {
      if (pattern.test(filePath)) {
        return layerPattern.type;
      }
    }
  }
  return null;
}

/**
 * Get layer for a specific file
 */
export function getFileLayer(
  filePath: string,
  layers: Layer[]
): Layer | null {
  const layerType = classifyFileLayer(filePath);
  if (!layerType) return null;
  
  return layers.find(l => l.type === layerType) || null;
}

/**
 * Analyze layer dependencies
 */
export function analyzeLayerDependencies(
  files: RepoFile[],
  layers: Layer[]
): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();
  
  // Initialize dependencies for each layer
  for (const layer of layers) {
    dependencies.set(layer.type, new Set());
  }
  
  // Analyze imports to find cross-layer dependencies
  for (const file of files) {
    if (!file.content) continue;
    
    const fileLayer = classifyFileLayer(file.path);
    if (!fileLayer) continue;
    
    // Extract imports
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(file.content)) !== null) {
      const importPath = match[1];
      
      // Skip external modules
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;
      
      // Resolve relative path
      const resolvedPath = resolveImportPath(file.path, importPath);
      if (!resolvedPath) continue;
      
      const importLayer = classifyFileLayer(resolvedPath);
      if (importLayer && importLayer !== fileLayer) {
        dependencies.get(fileLayer)?.add(importLayer);
      }
    }
  }
  
  return dependencies;
}

/**
 * Resolve a relative import path
 */
function resolveImportPath(fromPath: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null;
  
  const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
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

/**
 * Detect architecture violations (e.g., presentation layer importing from database)
 */
export function detectLayerViolations(
  layerDependencies: Map<string, Set<string>>
): Array<{ from: LayerType; to: LayerType; severity: 'warning' | 'error' }> {
  const violations: Array<{ from: LayerType; to: LayerType; severity: 'warning' | 'error' }> = [];
  
  // Define allowed dependencies (upper layers can depend on lower)
  const layerOrder: Record<LayerType, number> = {
    presentation: 1,
    api: 2,
    application: 3,
    domain: 4,
    infrastructure: 5,
    database: 6,
    shared: 10, // Can be used by any layer
    config: 10,
    test: 10,
    external: 10,
  };
  
  // Check for violations
  for (const [fromLayer, toLayersSet] of layerDependencies.entries()) {
    const fromOrder = layerOrder[fromLayer as LayerType];
    
    for (const toLayer of toLayersSet) {
      const toOrder = layerOrder[toLayer as LayerType];
      
      // Skip shared/config/test layers
      if (toOrder >= 10) continue;
      
      // Violation: depending on a lower layer (except adjacent)
      if (fromOrder > toOrder && Math.abs(fromOrder - toOrder) > 1) {
        violations.push({
          from: fromLayer as LayerType,
          to: toLayer as LayerType,
          severity: 'warning',
        });
      }
      
      // Severe violation: presentation directly accessing database
      if (fromLayer === 'presentation' && toLayer === 'database') {
        violations.push({
          from: fromLayer as LayerType,
          to: toLayer as LayerType,
          severity: 'error',
        });
      }
      
      // Domain should not depend on infrastructure
      if (fromLayer === 'domain' && toLayer === 'infrastructure') {
        violations.push({
          from: fromLayer as LayerType,
          to: toLayer as LayerType,
          severity: 'error',
        });
      }
    }
  }
  
  return violations;
}

/**
 * Generate layer diagram in Mermaid format
 */
export function generateLayerDiagram(
  layers: Layer[],
  dependencies: Map<string, Set<string>>
): string {
  const lines: string[] = ['graph TD'];
  
  // Add layer nodes
  for (const layer of layers) {
    const id = layer.type.replace(/_/g, '');
    const label = layer.name;
    lines.push(`    ${id}[${label}]`);
  }
  
  lines.push('');
  
  // Add dependencies
  for (const [from, toSet] of dependencies.entries()) {
    const fromId = from.replace(/_/g, '');
    for (const to of toSet) {
      const toId = to.replace(/_/g, '');
      lines.push(`    ${fromId} --> ${toId}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Get layer statistics
 */
export function getLayerStatistics(
  files: RepoFile[],
  layers: Layer[]
): Map<string, { fileCount: number; lineCount: number; percentage: number }> {
  const stats = new Map<string, { fileCount: number; lineCount: number; percentage: number }>();
  
  // Initialize stats
  for (const layer of layers) {
    stats.set(layer.type, { fileCount: 0, lineCount: 0, percentage: 0 });
  }
  
  let totalFiles = 0;
  
  // Count files per layer
  for (const file of files) {
    const layerType = classifyFileLayer(file.path);
    if (layerType && stats.has(layerType)) {
      const layerStats = stats.get(layerType)!;
      layerStats.fileCount++;
      layerStats.lineCount += file.content?.split('\n').length || 0;
      totalFiles++;
    }
  }
  
  // Calculate percentages
  for (const [, layerStats] of stats) {
    layerStats.percentage = totalFiles > 0 ? (layerStats.fileCount / totalFiles) * 100 : 0;
  }
  
  return stats;
}
