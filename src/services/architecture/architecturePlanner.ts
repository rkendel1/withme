/**
 * Architecture Planner
 * 
 * Implements intent detection and graph-based query routing
 * to provide architecture-aware answers.
 */

import type {
  QueryIntent,
  IntentDetectionResult,
  ArchitectureQueryResult,
  ArchitectureNode,
  ArchitectureEdge,
  DiagramReference,
  ArchitectureSource,
} from '../../types/architecture';
import type { DiagramContext } from './diagramEngine';
import {
  generateComponentDiagram,
  generateServiceMap,
  generateLayerDiagram,
  generateDataFlowDiagram,
  generateDependencyGraph,
  generateTechStackDiagram,
} from './diagramEngine';

// ============================================================================
// Intent Detection Patterns
// ============================================================================

interface IntentPattern {
  intent: QueryIntent;
  patterns: RegExp[];
  entities?: RegExp[];
  priority: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'explain_architecture',
    patterns: [
      /explain.*architecture/i,
      /architecture.*overview/i,
      /how.*architect/i,
      /describe.*system/i,
      /overall.*structure/i,
      /high.?level.*design/i,
      /what.*architecture/i,
    ],
    priority: 10,
  },
  {
    intent: 'draw_diagram',
    patterns: [
      /draw/i,
      /diagram/i,
      /visuali[sz]e/i,
      /show.*graph/i,
      /generate.*chart/i,
      /create.*diagram/i,
      /map.*out/i,
    ],
    entities: [
      /component/i,
      /service/i,
      /layer/i,
      /dependency/i,
      /data.?flow/i,
      /sequence/i,
    ],
    priority: 9,
  },
  {
    intent: 'trace_request',
    patterns: [
      /trace/i,
      /request.*flow/i,
      /how.*request/i,
      /follow.*path/i,
      /execution.*path/i,
      /call.*chain/i,
      /what.*happens.*when/i,
    ],
    entities: [
      /api/i,
      /endpoint/i,
      /route/i,
      /handler/i,
    ],
    priority: 8,
  },
  {
    intent: 'show_dependencies',
    patterns: [
      /dependenc/i,
      /what.*depend/i,
      /import/i,
      /use[sd]?.*by/i,
      /coupled/i,
      /module.*relationship/i,
    ],
    priority: 7,
  },
  {
    intent: 'explain_service',
    patterns: [
      /explain.*service/i,
      /what.*does.*service/i,
      /how.*service.*work/i,
      /describe.*api/i,
      /what.*is.*component/i,
    ],
    entities: [
      /[A-Z][a-z]+(?:Service|API|Controller|Handler)/,
    ],
    priority: 6,
  },
  {
    intent: 'impact_analysis',
    patterns: [
      /impact/i,
      /what.*break/i,
      /affect/i,
      /if.*remove/i,
      /if.*change/i,
      /ripple.*effect/i,
      /blast.*radius/i,
    ],
    priority: 8,
  },
  {
    intent: 'find_entry_points',
    patterns: [
      /entry.*point/i,
      /main.*function/i,
      /start.*up/i,
      /boot.*strap/i,
      /where.*start/i,
      /how.*launch/i,
    ],
    priority: 5,
  },
  {
    intent: 'list_technologies',
    patterns: [
      /technolog/i,
      /tech.*stack/i,
      /framework/i,
      /what.*use[sd]/i,
      /database/i,
      /tools?/i,
      /libraries/i,
    ],
    priority: 4,
  },
  {
    intent: 'show_data_flow',
    patterns: [
      /data.*flow/i,
      /how.*data/i,
      /information.*flow/i,
      /state.*manage/i,
      /where.*data.*go/i,
    ],
    priority: 6,
  },
  {
    intent: 'explain_layer',
    patterns: [
      /layer/i,
      /presentation/i,
      /domain/i,
      /infrastructure/i,
      /business.*logic/i,
      /separation/i,
    ],
    priority: 5,
  },
];

// ============================================================================
// Intent Detection
// ============================================================================

/**
 * Detect the intent of an architecture query
 */
export function detectIntent(query: string): IntentDetectionResult {
  let bestMatch: {
    intent: QueryIntent;
    confidence: number;
    patterns: string[];
    entities: Record<string, string>;
    suggestedQueries: string[];
  } | null = null;
  
  const normalizedQuery = query.toLowerCase();
  
  for (const intentPattern of INTENT_PATTERNS) {
    let matchCount = 0;
    const matchedPatterns: string[] = [];
    
    for (const pattern of intentPattern.patterns) {
      if (pattern.test(normalizedQuery)) {
        matchCount++;
        matchedPatterns.push(pattern.source);
      }
    }
    
    if (matchCount > 0) {
      const confidence = Math.min(
        0.3 + (matchCount * 0.2) + (intentPattern.priority * 0.05),
        1.0
      );
      
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          intent: intentPattern.intent,
          confidence,
          patterns: matchedPatterns,
          entities: {},
          suggestedQueries: [],
        };
        
        // Extract entities if defined
        if (intentPattern.entities) {
          for (const entityPattern of intentPattern.entities) {
            const match = query.match(entityPattern);
            if (match) {
              bestMatch.entities[entityPattern.source] = match[0];
            }
          }
        }
      }
    }
  }
  
  const result: IntentDetectionResult = bestMatch || {
    intent: 'general' as QueryIntent,
    confidence: 0.5,
    patterns: [],
    entities: {},
    suggestedQueries: [],
  };
  
  return {
    intent: result.intent,
    confidence: result.confidence,
    entities: result.entities,
    suggestedQueries: generateSuggestedQueries(result.intent),
  };
}

/**
 * Generate suggested follow-up queries based on intent
 */
function generateSuggestedQueries(intent: QueryIntent): string[] {
  const suggestions: Record<QueryIntent, string[]> = {
    explain_architecture: [
      'Draw a component diagram',
      'Show the service map',
      'What layers does this architecture have?',
    ],
    draw_diagram: [
      'Show dependencies between modules',
      'Generate a sequence diagram for the main flow',
      'Visualize the tech stack',
    ],
    trace_request: [
      'What services does this request touch?',
      'Show the database queries involved',
      'What can fail in this flow?',
    ],
    show_dependencies: [
      'What are the external dependencies?',
      'Which modules are most coupled?',
      'Show circular dependencies',
    ],
    explain_service: [
      'What endpoints does this service expose?',
      'What databases does it use?',
      'Show related services',
    ],
    impact_analysis: [
      'What tests cover this code?',
      'Who depends on this?',
      'Show the blast radius',
    ],
    find_entry_points: [
      'How do I run the application?',
      'What CLI commands are available?',
      'Show all API endpoints',
    ],
    list_technologies: [
      'What version of Node.js is used?',
      'Show database technologies',
      'What testing frameworks are used?',
    ],
    show_data_flow: [
      'How does authentication work?',
      'Where is data validated?',
      'Show the caching layer',
    ],
    explain_layer: [
      'What belongs to the domain layer?',
      'Are there any layer violations?',
      'Show layer dependencies',
    ],
    general: [
      'Explain the architecture',
      'Draw a component diagram',
      'What technologies are used?',
    ],
  };
  
  return suggestions[intent] || suggestions.general;
}

// ============================================================================
// Query Planning
// ============================================================================

export interface QueryPlan {
  intent: QueryIntent;
  shouldUseGraph: boolean;
  graphQueries: string[];
  contextNeeded: string[];
  diagramType?: string;
}

/**
 * Create a query plan based on detected intent
 */
export function createQueryPlan(
  intentResult: IntentDetectionResult
): QueryPlan {
  const plan: QueryPlan = {
    intent: intentResult.intent,
    shouldUseGraph: true,
    graphQueries: [],
    contextNeeded: [],
  };
  
  switch (intentResult.intent) {
    case 'explain_architecture':
      plan.graphQueries = [
        'SELECT * FROM services',
        'SELECT * FROM layers ORDER BY layer_order',
        'SELECT * FROM technologies WHERE category IN (\'framework\', \'database\')',
      ];
      plan.contextNeeded = ['services', 'layers', 'technologies'];
      plan.diagramType = 'component';
      break;
      
    case 'draw_diagram':
      plan.graphQueries = [
        'SELECT * FROM services',
        'SELECT * FROM modules',
        'SELECT * FROM architecture_edges',
      ];
      plan.contextNeeded = ['services', 'modules', 'edges'];
      plan.diagramType = determineDiagramType(intentResult);
      break;
      
    case 'trace_request':
      plan.graphQueries = [
        'SELECT * FROM execution_paths',
        'SELECT * FROM entry_points',
        'SELECT * FROM api_endpoints',
      ];
      plan.contextNeeded = ['executionPaths', 'entryPoints', 'apiEndpoints'];
      plan.diagramType = 'sequence';
      break;
      
    case 'show_dependencies':
      plan.graphQueries = [
        'SELECT * FROM modules',
        'SELECT * FROM architecture_edges WHERE type = \'imports\'',
      ];
      plan.contextNeeded = ['modules', 'edges'];
      plan.diagramType = 'dependency';
      break;
      
    case 'explain_service':
      plan.graphQueries = [
        'SELECT * FROM services',
        'SELECT * FROM api_endpoints',
        'SELECT * FROM technologies',
      ];
      plan.contextNeeded = ['services', 'apiEndpoints', 'technologies'];
      break;
      
    case 'impact_analysis':
      plan.graphQueries = [
        'SELECT * FROM architecture_nodes',
        'SELECT * FROM architecture_edges',
      ];
      plan.contextNeeded = ['nodes', 'edges'];
      break;
      
    case 'find_entry_points':
      plan.graphQueries = [
        'SELECT * FROM entry_points ORDER BY type, name',
        'SELECT * FROM api_endpoints',
      ];
      plan.contextNeeded = ['entryPoints', 'apiEndpoints'];
      break;
      
    case 'list_technologies':
      plan.graphQueries = [
        'SELECT * FROM technologies ORDER BY category, name',
        'SELECT * FROM datastores',
        'SELECT * FROM queues',
      ];
      plan.contextNeeded = ['technologies', 'datastores', 'queues'];
      plan.diagramType = 'component';
      break;
      
    case 'show_data_flow':
      plan.graphQueries = [
        'SELECT * FROM execution_paths',
        'SELECT * FROM architecture_edges WHERE type IN (\'reads\', \'writes\', \'calls\')',
      ];
      plan.contextNeeded = ['executionPaths', 'edges'];
      plan.diagramType = 'data_flow';
      break;
      
    case 'explain_layer':
      plan.graphQueries = [
        'SELECT * FROM layers ORDER BY layer_order',
        'SELECT * FROM architecture_nodes WHERE type = \'layer\'',
      ];
      plan.contextNeeded = ['layers', 'nodes'];
      plan.diagramType = 'layer';
      break;
      
    default:
      plan.shouldUseGraph = false;
      plan.graphQueries = [];
      plan.contextNeeded = [];
  }
  
  return plan;
}

/**
 * Determine the best diagram type based on intent entities
 */
function determineDiagramType(intentResult: IntentDetectionResult): string {
  const entities = Object.values(intentResult.entities).join(' ').toLowerCase();
  
  if (/component|service|system/.test(entities)) return 'component';
  if (/dependency|import|module/.test(entities)) return 'dependency';
  if (/layer|arch/.test(entities)) return 'layer';
  if (/sequence|flow|request/.test(entities)) return 'sequence';
  if (/data|state/.test(entities)) return 'data_flow';
  if (/api|endpoint/.test(entities)) return 'component';
  if (/tech|stack/.test(entities)) return 'component';
  
  return 'component'; // Default
}

// ============================================================================
// Query Execution
// ============================================================================

/**
 * Execute an architecture query
 */
export function executeArchitectureQuery(
  query: string,
  context: DiagramContext
): ArchitectureQueryResult {
  // Detect intent
  const intentResult = detectIntent(query);
  
  // Create query plan
  const plan = createQueryPlan(intentResult);
  
  // Generate answer based on intent
  const answer = generateAnswer(query, intentResult, context);
  
  // Generate appropriate diagram
  let diagram: DiagramReference | null = null;
  if (plan.diagramType) {
    diagram = generateDiagramForIntent(plan.diagramType, context);
  }
  
  // Collect related nodes and edges
  const relatedNodes = findRelatedNodes(query, context.nodes);
  const relatedEdges = findRelatedEdges(relatedNodes, context.edges);
  
  // Build sources
  const sources = buildSources(relatedNodes, context);
  
  return {
    intent: intentResult.intent,
    answer,
    diagram,
    relatedNodes,
    relatedEdges,
    sources,
    sqlUsed: plan.graphQueries.length > 0 ? plan.graphQueries.join(';\n') : null,
  };
}

/**
 * Generate an answer based on intent and context
 */
function generateAnswer(
  _query: string,
  intentResult: IntentDetectionResult,
  context: DiagramContext
): string {
  const parts: string[] = [];
  
  switch (intentResult.intent) {
    case 'explain_architecture':
      parts.push('## Architecture Overview\n');
      
      if (context.services.length > 0) {
        parts.push(`This repository contains **${context.services.length} services**:\n`);
        for (const service of context.services.slice(0, 5)) {
          parts.push(`- **${service.name}** (${service.type})`);
        }
        parts.push('');
      }
      
      if (context.layers.length > 0) {
        parts.push(`### Layers\n`);
        parts.push(`The architecture follows a **${context.layers.length}-layer** structure:\n`);
        for (const layer of context.layers) {
          parts.push(`- **${layer.name}**: ${layer.description || layer.type}`);
        }
        parts.push('');
      }
      
      {
        const frameworks = context.technologies.filter(t => t.category === 'framework');
        if (frameworks.length > 0) {
          parts.push(`### Key Technologies\n`);
          parts.push(frameworks.map(f => `- ${f.name}`).join('\n'));
        }
      }
      break;
      
    case 'list_technologies':
      parts.push('## Technology Stack\n');
      {
        const byCategory = new Map<string, typeof context.technologies>();
        for (const tech of context.technologies) {
          if (!byCategory.has(tech.category)) {
            byCategory.set(tech.category, []);
          }
          byCategory.get(tech.category)!.push(tech);
        }
        
        for (const [category, techs] of byCategory.entries()) {
          parts.push(`### ${formatCategory(category)}\n`);
          for (const tech of techs) {
            const version = tech.version ? ` (${tech.version})` : '';
            parts.push(`- ${tech.name}${version}`);
          }
          parts.push('');
        }
      }
      break;
      
    case 'find_entry_points':
      parts.push('## Entry Points\n');
      {
        const byType = new Map<string, typeof context.entryPoints>();
        for (const ep of context.entryPoints) {
          if (!byType.has(ep.type)) {
            byType.set(ep.type, []);
          }
          byType.get(ep.type)!.push(ep);
        }
        
        for (const [type, eps] of byType.entries()) {
          parts.push(`### ${formatType(type)}\n`);
          for (const ep of eps.slice(0, 10)) {
            const route = ep.routePath ? ` → ${ep.routePath}` : '';
            parts.push(`- **${ep.name}**${route}\n  \`${ep.filePath}\``);
          }
          parts.push('');
        }
      }
      break;
      
    case 'show_dependencies':
      parts.push('## Module Dependencies\n');
      parts.push(`Found **${context.modules.length} modules** with **${context.edges.filter(e => e.type === 'imports').length} dependency relationships**.\n`);
      {
        const entryModules = context.modules.filter(m => m.isEntryPoint);
        if (entryModules.length > 0) {
          parts.push('### Entry Point Modules\n');
          for (const m of entryModules) {
            parts.push(`- **${m.name}** (\`${m.path}\`)`);
          }
        }
      }
      break;
      
    case 'explain_layer':
      parts.push('## Architecture Layers\n');
      
      for (const layer of context.layers) {
        parts.push(`### ${layer.name} Layer\n`);
        parts.push(layer.description || `The ${layer.type} layer.`);
        parts.push(`\n**Patterns**: ${layer.patterns.join(', ') || 'N/A'}\n`);
      }
      break;
      
    default:
      parts.push(`I found information about this repository's architecture.\n`);
      parts.push(`- ${context.services.length} services detected`);
      parts.push(`- ${context.layers.length} architectural layers`);
      parts.push(`- ${context.entryPoints.length} entry points`);
      parts.push(`- ${context.technologies.length} technologies identified`);
  }
  
  return parts.join('\n');
}

/**
 * Generate a diagram for the detected intent
 */
function generateDiagramForIntent(
  diagramType: string,
  context: DiagramContext
): DiagramReference | null {
  switch (diagramType) {
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
    case 'tech_stack':
      return generateTechStackDiagram(context.technologies);
    default:
      return null;
  }
}

/**
 * Find nodes related to the query
 */
function findRelatedNodes(
  query: string,
  nodes: ArchitectureNode[]
): ArchitectureNode[] {
  const words = query.toLowerCase().split(/\s+/);
  
  return nodes.filter(node => {
    const nodeName = node.name.toLowerCase();
    const nodeType = node.type.toLowerCase();
    
    return words.some(word =>
      word.length > 2 && (nodeName.includes(word) || nodeType.includes(word))
    );
  }).slice(0, 10);
}

/**
 * Find edges connected to the given nodes
 */
function findRelatedEdges(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): ArchitectureEdge[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  
  return edges.filter(edge =>
    nodeIds.has(edge.sourceNodeId) || nodeIds.has(edge.targetNodeId)
  ).slice(0, 20);
}

/**
 * Build source references
 */
function buildSources(
  nodes: ArchitectureNode[],
  _context: DiagramContext
): ArchitectureSource[] {
  return nodes.map(node => ({
    type: 'node' as const,
    id: node.id,
    name: node.name,
    path: node.filePath,
  }));
}

// ============================================================================
// Formatting Utilities
// ============================================================================

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
  
  return names[category] || category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
