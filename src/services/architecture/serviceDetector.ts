/**
 * Service Detector
 * 
 * Detects REST APIs, GraphQL, Workers, CLIs, and other service types
 * from repository files and patterns.
 */

import type {
  Service,
  ServiceType,
  ApiEndpoint,
  HttpMethod,
  ApiParameter,
} from '../../types/architecture';
import type { RepoFile, Dependency } from '../../types';

// ============================================================================
// Service Detection Patterns
// ============================================================================

interface ServicePattern {
  type: ServiceType;
  name: string;
  indicators: {
    files?: RegExp[];
    dependencies?: string[];
    content?: RegExp[];
    entryPoints?: RegExp[];
  };
}

const SERVICE_PATTERNS: ServicePattern[] = [
  // REST APIs
  {
    type: 'rest_api',
    name: 'Express API',
    indicators: {
      dependencies: ['express'],
      content: [/app\.(get|post|put|delete|patch)\s*\(/, /router\.(get|post|put|delete|patch)\s*\(/],
      entryPoints: [/server\.(ts|js)$/, /app\.(ts|js)$/, /index\.(ts|js)$/],
    },
  },
  {
    type: 'rest_api',
    name: 'Fastify API',
    indicators: {
      dependencies: ['fastify'],
      content: [/fastify\.(get|post|put|delete|patch)\s*\(/, /\.route\s*\(/],
    },
  },
  {
    type: 'rest_api',
    name: 'Hono API',
    indicators: {
      dependencies: ['hono'],
      content: [/app\.(get|post|put|delete|patch)\s*\(/, /new Hono\(/],
    },
  },
  {
    type: 'rest_api',
    name: 'NestJS API',
    indicators: {
      dependencies: ['@nestjs/core'],
      content: [/@Controller\(/, /@Get\(/, /@Post\(/, /@Put\(/, /@Delete\(/],
      files: [/\.controller\.(ts|js)$/],
    },
  },
  {
    type: 'rest_api',
    name: 'Koa API',
    indicators: {
      dependencies: ['koa'],
      content: [/router\.(get|post|put|delete)\s*\(/, /new Koa\(/],
    },
  },
  
  // GraphQL
  {
    type: 'graphql',
    name: 'GraphQL Server',
    indicators: {
      dependencies: ['graphql', 'apollo-server', '@apollo/server', 'graphql-yoga', 'mercurius'],
      content: [/type Query/, /type Mutation/, /gql`/, /buildSchema\(/],
      files: [/\.graphql$/, /schema\.(ts|js)$/, /resolvers?\.(ts|js)$/],
    },
  },
  
  // gRPC
  {
    type: 'grpc',
    name: 'gRPC Service',
    indicators: {
      dependencies: ['@grpc/grpc-js', 'grpc'],
      files: [/\.proto$/],
      content: [/loadPackageDefinition\(/, /Server\(\)/],
    },
  },
  
  // WebSocket
  {
    type: 'websocket',
    name: 'WebSocket Server',
    indicators: {
      dependencies: ['ws', 'socket.io', '@socket.io/admin-ui'],
      content: [/WebSocketServer\(/, /new WebSocket\.Server\(/, /io\.(on|emit)\(/],
    },
  },
  
  // Workers
  {
    type: 'worker',
    name: 'Background Worker',
    indicators: {
      content: [/process\.on\(['"]message['"]/, /parentPort/, /workerData/],
      files: [/worker\.(ts|js)$/, /workers?\//],
    },
  },
  {
    type: 'worker',
    name: 'Cloudflare Worker',
    indicators: {
      files: [/wrangler\.toml$/],
      content: [/export default\s*\{[\s\S]*fetch\s*\(/, /addEventListener\(['"]fetch['"]/],
    },
  },
  
  // Serverless Functions
  {
    type: 'serverless_function',
    name: 'AWS Lambda',
    indicators: {
      files: [/serverless\.ya?ml$/, /template\.ya?ml$/],
      content: [/exports\.handler/, /export const handler/, /Handler.*APIGatewayEvent/],
    },
  },
  {
    type: 'serverless_function',
    name: 'Vercel Functions',
    indicators: {
      files: [/api\/.*\.(ts|js)$/, /vercel\.json$/],
      content: [/export default.*req.*res/],
    },
  },
  {
    type: 'serverless_function',
    name: 'Netlify Functions',
    indicators: {
      files: [/netlify\.toml$/, /netlify\/functions\//],
      content: [/exports\.handler.*event.*context/],
    },
  },
  
  // CLI Tools
  {
    type: 'cli',
    name: 'CLI Application',
    indicators: {
      dependencies: ['commander', 'yargs', 'inquirer', 'ora', 'chalk', 'meow', 'cac'],
      content: [/\.command\s*\(/, /\.option\s*\(/, /process\.argv/, /yargs\(/],
      files: [/cli\.(ts|js)$/, /bin\//],
    },
  },
  
  // Cron Jobs
  {
    type: 'cron_job',
    name: 'Scheduled Task',
    indicators: {
      dependencies: ['node-cron', 'cron', 'node-schedule', 'agenda'],
      content: [/cron\.schedule\s*\(/, /schedule\.scheduleJob\s*\(/, /Cron\(/],
    },
  },
  
  // Message Consumers
  {
    type: 'message_consumer',
    name: 'Queue Consumer',
    indicators: {
      content: [/\.consume\s*\(/, /\.subscribe\s*\(/, /process\s*\(/],
      files: [/consumer\.(ts|js)$/, /subscribers?\//],
    },
  },
  
  // Message Producers
  {
    type: 'message_producer',
    name: 'Queue Producer',
    indicators: {
      content: [/\.publish\s*\(/, /\.send\s*\(/, /\.produce\s*\(/],
      files: [/producer\.(ts|js)$/, /publishers?\//],
    },
  },
  
  // Libraries
  {
    type: 'library',
    name: 'Library Package',
    indicators: {
      files: [/lib\/index\.(ts|js)$/, /src\/index\.(ts|js)$/],
      content: [/export\s+(const|function|class|type|interface)/],
    },
  },
];

// ============================================================================
// API Endpoint Detection Patterns
// ============================================================================

interface EndpointPattern {
  framework: string;
  patterns: {
    regex: RegExp;
    methodGroup: number;
    pathGroup: number;
  }[];
}

const ENDPOINT_PATTERNS: EndpointPattern[] = [
  {
    framework: 'express',
    patterns: [
      { regex: /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
    ],
  },
  {
    framework: 'fastify',
    patterns: [
      { regex: /(?:fastify|server|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
      { regex: /\.route\s*\(\s*\{[^}]*method:\s*['"`](\w+)['"`][^}]*url:\s*['"`]([^'"`]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
    ],
  },
  {
    framework: 'hono',
    patterns: [
      { regex: /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
    ],
  },
  {
    framework: 'nestjs',
    patterns: [
      { regex: /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]?([^'"`)]*)/g, methodGroup: 1, pathGroup: 2 },
    ],
  },
  {
    framework: 'koa',
    patterns: [
      { regex: /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g, methodGroup: 1, pathGroup: 2 },
    ],
  },
];

// ============================================================================
// Detection Functions
// ============================================================================

export interface ServiceDetectionContext {
  files: RepoFile[];
  dependencies: Dependency[];
}

/**
 * Detect services in the repository
 */
export function detectServices(
  context: ServiceDetectionContext,
  repositoryId: number
): Omit<Service, 'id' | 'createdAt'>[] {
  const detected: Omit<Service, 'id' | 'createdAt'>[] = [];
  const depNames = new Set(context.dependencies.map(d => d.name.toLowerCase()));
  const seenServices = new Set<string>();
  
  for (const pattern of SERVICE_PATTERNS) {
    let found = false;
    let entryPoint: string | null = null;
    const technologies: string[] = [];
    
    // Check dependencies
    if (pattern.indicators.dependencies) {
      for (const dep of pattern.indicators.dependencies) {
        if (depNames.has(dep.toLowerCase())) {
          found = true;
          technologies.push(dep);
          break;
        }
      }
    }
    
    // Check file patterns
    if (pattern.indicators.files) {
      for (const file of context.files) {
        for (const filePattern of pattern.indicators.files) {
          if (filePattern.test(file.path)) {
            found = true;
            if (pattern.indicators.entryPoints) {
              for (const entryPattern of pattern.indicators.entryPoints) {
                if (entryPattern.test(file.path)) {
                  entryPoint = file.path;
                  break;
                }
              }
            }
            break;
          }
        }
      }
    }
    
    // Check content patterns
    if (pattern.indicators.content) {
      for (const file of context.files) {
        if (!file.content) continue;
        for (const contentPattern of pattern.indicators.content) {
          if (contentPattern.test(file.content)) {
            found = true;
            if (!entryPoint && pattern.indicators.entryPoints) {
              for (const entryPattern of pattern.indicators.entryPoints) {
                if (entryPattern.test(file.path)) {
                  entryPoint = file.path;
                  break;
                }
              }
            }
            break;
          }
        }
      }
    }
    
    // Only add unique services
    const serviceKey = `${pattern.type}:${pattern.name}`;
    if (found && !seenServices.has(serviceKey)) {
      seenServices.add(serviceKey);
      detected.push({
        repositoryId,
        name: pattern.name,
        type: pattern.type,
        entryPoint,
        port: null,
        description: null,
        technologies,
        metadata: {},
      });
    }
  }
  
  // Detect Next.js as a special case (both frontend and API)
  if (depNames.has('next')) {
    // Check for API routes
    const hasApiRoutes = context.files.some(f =>
      /pages\/api\//.test(f.path) || /app\/api\//.test(f.path)
    );
    
    if (hasApiRoutes && !seenServices.has('rest_api:Next.js API')) {
      detected.push({
        repositoryId,
        name: 'Next.js API',
        type: 'rest_api',
        entryPoint: 'pages/api or app/api',
        port: 3000,
        description: 'Next.js API Routes',
        technologies: ['next'],
        metadata: {},
      });
    }
  }
  
  return detected;
}

/**
 * Detect API endpoints in the repository
 */
export function detectApiEndpoints(
  files: RepoFile[],
  repositoryId: number,
  serviceId: number | null = null
): Omit<ApiEndpoint, 'id' | 'createdAt'>[] {
  const endpoints: Omit<ApiEndpoint, 'id' | 'createdAt'>[] = [];
  const seenEndpoints = new Set<string>();
  
  for (const file of files) {
    if (!file.content) continue;
    
    // Skip non-code files
    if (!file.extension || !['ts', 'tsx', 'js', 'jsx'].includes(file.extension)) {
      continue;
    }
    
    for (const frameworkPattern of ENDPOINT_PATTERNS) {
      for (const pattern of frameworkPattern.patterns) {
        // Reset regex
        pattern.regex.lastIndex = 0;
        let match;
        
        while ((match = pattern.regex.exec(file.content)) !== null) {
          const method = match[pattern.methodGroup].toUpperCase() as HttpMethod;
          let path = match[pattern.pathGroup] || '/';
          
          // Clean up path
          path = path.trim();
          if (!path.startsWith('/')) {
            path = '/' + path;
          }
          
          const key = `${method}:${path}`;
          if (!seenEndpoints.has(key)) {
            seenEndpoints.add(key);
            endpoints.push({
              repositoryId,
              serviceId,
              path,
              method,
              handlerFile: file.path,
              handlerFunction: null,
              parameters: extractParameters(path),
              responseType: null,
              description: null,
            });
          }
        }
      }
    }
    
    // Detect Next.js API routes
    if (/pages\/api\//.test(file.path) || /app\/api\//.test(file.path)) {
      const routePath = extractNextJsRoutePath(file.path);
      if (routePath) {
        // Detect methods from content
        const methods: HttpMethod[] = [];
        if (/export\s+(async\s+)?function\s+GET/i.test(file.content) || /req\.method\s*===?\s*['"]GET/i.test(file.content)) {
          methods.push('GET');
        }
        if (/export\s+(async\s+)?function\s+POST/i.test(file.content) || /req\.method\s*===?\s*['"]POST/i.test(file.content)) {
          methods.push('POST');
        }
        if (/export\s+(async\s+)?function\s+PUT/i.test(file.content) || /req\.method\s*===?\s*['"]PUT/i.test(file.content)) {
          methods.push('PUT');
        }
        if (/export\s+(async\s+)?function\s+DELETE/i.test(file.content) || /req\.method\s*===?\s*['"]DELETE/i.test(file.content)) {
          methods.push('DELETE');
        }
        if (/export\s+(async\s+)?function\s+PATCH/i.test(file.content) || /req\.method\s*===?\s*['"]PATCH/i.test(file.content)) {
          methods.push('PATCH');
        }
        
        // Default to GET if no specific method detected
        if (methods.length === 0) {
          methods.push('GET');
        }
        
        for (const method of methods) {
          const key = `${method}:${routePath}`;
          if (!seenEndpoints.has(key)) {
            seenEndpoints.add(key);
            endpoints.push({
              repositoryId,
              serviceId,
              path: routePath,
              method,
              handlerFile: file.path,
              handlerFunction: null,
              parameters: extractParameters(routePath),
              responseType: null,
              description: null,
            });
          }
        }
      }
    }
  }
  
  return endpoints;
}

/**
 * Extract route path from Next.js file path
 */
function extractNextJsRoutePath(filePath: string): string | null {
  // pages/api/users/[id].ts -> /api/users/:id
  // app/api/users/[id]/route.ts -> /api/users/:id
  
  let routePath: string | null = null;
  
  // Pages router
  const pagesMatch = filePath.match(/pages(\/api\/.+)\.(ts|js|tsx|jsx)$/);
  if (pagesMatch) {
    routePath = pagesMatch[1];
  }
  
  // App router
  const appMatch = filePath.match(/app(\/api\/.+)\/route\.(ts|js|tsx|jsx)$/);
  if (appMatch) {
    routePath = appMatch[1];
  }
  
  if (routePath) {
    // Convert [param] to :param
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');
    // Remove /index suffix
    routePath = routePath.replace(/\/index$/, '') || '/';
  }
  
  return routePath;
}

/**
 * Extract parameters from a route path
 */
function extractParameters(path: string): ApiParameter[] {
  const params: ApiParameter[] = [];
  const paramRegex = /:(\w+)/g;
  let match;
  
  while ((match = paramRegex.exec(path)) !== null) {
    params.push({
      name: match[1],
      type: 'string',
      location: 'path',
      required: true,
    });
  }
  
  return params;
}

/**
 * Detect architecture style
 */
export function detectArchitectureStyle(
  services: Service[],
  files: RepoFile[]
): 'monolith' | 'modular_monolith' | 'microservices' | 'serverless' | 'hybrid' {
  // Check for serverless indicators
  const hasServerless = services.some(s => s.type === 'serverless_function');
  const hasLambda = files.some(f =>
    /serverless\.ya?ml$/.test(f.path) ||
    /template\.ya?ml$/.test(f.path) ||
    /netlify\.toml$/.test(f.path)
  );
  
  if (hasServerless || hasLambda) {
    const hasTraditionalServices = services.some(s =>
      ['rest_api', 'graphql', 'grpc'].includes(s.type)
    );
    return hasTraditionalServices ? 'hybrid' : 'serverless';
  }
  
  // Check for microservices indicators
  const hasDocker = files.some(f => /Dockerfile$/.test(f.path));
  const hasDockerCompose = files.some(f => /docker-compose\.ya?ml$/.test(f.path));
  const hasK8s = files.some(f => /k8s\/|kubernetes\//.test(f.path));
  const serviceCount = services.filter(s =>
    ['rest_api', 'graphql', 'grpc', 'worker'].includes(s.type)
  ).length;
  
  if ((hasDocker || hasDockerCompose || hasK8s) && serviceCount > 2) {
    return 'microservices';
  }
  
  // Check for modular monolith
  const hasModules = files.some(f =>
    /\/modules\//.test(f.path) ||
    /\/domains\//.test(f.path) ||
    /\/features\//.test(f.path)
  );
  const hasWorkspaces = files.some(f =>
    /packages\//.test(f.path) ||
    /apps\//.test(f.path)
  );
  
  if (hasModules || hasWorkspaces) {
    return 'modular_monolith';
  }
  
  return 'monolith';
}
