/**
 * Entry Point Detector
 * 
 * Detects application entry points including main functions,
 * routes, handlers, Lambda functions, CLI commands, etc.
 */

import type { EntryPoint, EntryPointType } from '../../types/architecture';
import type { RepoFile, Dependency } from '../../types';

// ============================================================================
// Entry Point Detection Patterns
// ============================================================================

interface EntryPointPattern {
  type: EntryPointType;
  filePatterns: RegExp[];
  contentPatterns: RegExp[];
  extractName?: (match: RegExpMatchArray, filePath: string) => string;
  extractFunction?: (content: string) => string | null;
  extractRoute?: (filePath: string, content: string) => { method: string | null; path: string | null };
}

const ENTRY_POINT_PATTERNS: EntryPointPattern[] = [
  // Main entry points
  {
    type: 'main',
    filePatterns: [
      /^(src\/)?index\.(ts|js|tsx|jsx)$/,
      /^(src\/)?main\.(ts|js)$/,
      /^(src\/)?server\.(ts|js)$/,
      /^(src\/)?app\.(ts|js)$/,
    ],
    contentPatterns: [
      /\.listen\s*\(\s*\d+/,
      /createServer\s*\(/,
      /new\s+Hono\s*\(/,
      /fastify\s*\(\s*\)/,
    ],
    extractName: (_match, filePath) => {
      const name = filePath.split('/').pop()?.replace(/\.(ts|js|tsx|jsx)$/, '') || 'main';
      return `Main: ${name}`;
    },
  },
  
  // Express/Fastify/Koa routes
  {
    type: 'route',
    filePatterns: [
      /routes?\.(ts|js)$/,
      /\/routes\/.*\.(ts|js)$/,
    ],
    contentPatterns: [
      /router\.(get|post|put|delete|patch)\s*\(/,
      /app\.(get|post|put|delete|patch)\s*\(/,
    ],
    extractName: (_match, filePath) => {
      const parts = filePath.split('/');
      const fileName = parts.pop()?.replace(/\.(ts|js)$/, '') || 'routes';
      return `Routes: ${fileName}`;
    },
  },
  
  // NestJS Controllers
  {
    type: 'controller',
    filePatterns: [
      /\.controller\.(ts|js)$/,
    ],
    contentPatterns: [
      /@Controller\s*\(/,
    ],
    extractName: (_match, filePath) => {
      const fileName = filePath.split('/').pop()?.replace(/\.controller\.(ts|js)$/, '') || 'controller';
      return `Controller: ${fileName}`;
    },
    extractRoute: (filePath, content) => {
      const match = content.match(/@Controller\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      return {
        method: null,
        path: match ? `/${match[1]}` : '/' + filePath.split('/').pop()?.replace(/\.controller\.(ts|js)$/, ''),
      };
    },
  },
  
  // Next.js Pages/Routes
  {
    type: 'route',
    filePatterns: [
      /^pages\/(?!_|api\/).*\.(tsx|jsx|ts|js)$/,
      /^app\/(?!api\/).*\/page\.(tsx|jsx|ts|js)$/,
    ],
    contentPatterns: [
      /export\s+default/,
    ],
    extractName: (_match, filePath) => {
      let routePath = filePath
        .replace(/^pages\//, '/')
        .replace(/^app\//, '/')
        .replace(/\/page\.(tsx|jsx|ts|js)$/, '')
        .replace(/\.(tsx|jsx|ts|js)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1');
      if (!routePath) routePath = '/';
      return `Page: ${routePath}`;
    },
    extractRoute: (filePath) => {
      let routePath = filePath
        .replace(/^pages\//, '/')
        .replace(/^app\//, '/')
        .replace(/\/page\.(tsx|jsx|ts|js)$/, '')
        .replace(/\.(tsx|jsx|ts|js)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1');
      if (!routePath) routePath = '/';
      return { method: 'GET', path: routePath };
    },
  },
  
  // Next.js API Routes
  {
    type: 'handler',
    filePatterns: [
      /^pages\/api\/.*\.(ts|js)$/,
      /^app\/api\/.*\/route\.(ts|js)$/,
    ],
    contentPatterns: [
      /export\s+(default|async|function)/,
    ],
    extractName: (_match, filePath) => {
      const routePath = filePath
        .replace(/^pages\/api\//, '/api/')
        .replace(/^app\/api\//, '/api/')
        .replace(/\/route\.(ts|js)$/, '')
        .replace(/\.(ts|js)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1');
      return `API: ${routePath}`;
    },
    extractRoute: (filePath) => {
      const routePath = filePath
        .replace(/^pages\/api\//, '/api/')
        .replace(/^app\/api\//, '/api/')
        .replace(/\/route\.(ts|js)$/, '')
        .replace(/\.(ts|js)$/, '')
        .replace(/\/index$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1');
      return { method: null, path: routePath };
    },
  },
  
  // AWS Lambda Handlers
  {
    type: 'lambda',
    filePatterns: [
      /handler\.(ts|js)$/,
      /lambda\.(ts|js)$/,
      /functions\/.*\.(ts|js)$/,
    ],
    contentPatterns: [
      /exports\.handler\s*=/,
      /export\s+(const|async function)\s+handler/,
      /export\s+const\s+\w+:\s*Handler/,
    ],
    extractName: (_match, filePath) => {
      const fileName = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'handler';
      return `Lambda: ${fileName}`;
    },
  },
  
  // CLI Commands
  {
    type: 'cli_command',
    filePatterns: [
      /^(src\/)?cli\.(ts|js)$/,
      /^bin\/.*$/,
      /\/commands?\/.*\.(ts|js)$/,
    ],
    contentPatterns: [
      /\.command\s*\(/,
      /program\.parse/,
      /yargs\./,
      /#!/,
    ],
    extractName: (_match, filePath) => {
      const fileName = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'cli';
      return `CLI: ${fileName}`;
    },
  },
  
  // Cron Jobs
  {
    type: 'cron',
    filePatterns: [
      /cron\.(ts|js)$/,
      /jobs?\/.*\.(ts|js)$/,
      /scheduled?\/.*\.(ts|js)$/,
    ],
    contentPatterns: [
      /cron\.schedule\s*\(/,
      /schedule\.scheduleJob\s*\(/,
      /setInterval\s*\(/,
    ],
    extractName: (_match, filePath) => {
      const fileName = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'cron';
      return `Cron: ${fileName}`;
    },
  },
  
  // Event Listeners
  {
    type: 'event_listener',
    filePatterns: [
      /listeners?\/.*\.(ts|js)$/,
      /subscribers?\/.*\.(ts|js)$/,
      /handlers?\/.*\.(ts|js)$/,
    ],
    contentPatterns: [
      /\.on\s*\(\s*['"][^'"]+['"]/,
      /\.subscribe\s*\(/,
      /addEventListener\s*\(/,
    ],
    extractName: (_match, filePath) => {
      const fileName = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'listener';
      return `Listener: ${fileName}`;
    },
  },
  
  // Docker Entrypoints
  {
    type: 'docker_entrypoint',
    filePatterns: [
      /Dockerfile$/,
    ],
    contentPatterns: [
      /ENTRYPOINT\s*\[/,
      /CMD\s*\[/,
    ],
    extractName: () => 'Docker Entrypoint',
    extractFunction: (content) => {
      const entrypointMatch = content.match(/ENTRYPOINT\s*\[([^\]]+)\]/);
      const cmdMatch = content.match(/CMD\s*\[([^\]]+)\]/);
      return entrypointMatch?.[1] || cmdMatch?.[1] || null;
    },
  },
  
  // Test Suites
  {
    type: 'test_suite',
    filePatterns: [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /\/__tests__\/.*\.(ts|tsx|js|jsx)$/,
    ],
    contentPatterns: [
      /describe\s*\(/,
      /it\s*\(/,
      /test\s*\(/,
    ],
    extractName: (_match, filePath) => {
      const fileName = filePath.split('/').pop()?.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '') || 'test';
      return `Test: ${fileName}`;
    },
  },
];

// ============================================================================
// Detection Functions
// ============================================================================

export interface EntryPointDetectionContext {
  files: RepoFile[];
  dependencies: Dependency[];
}

/**
 * Detect entry points in the repository
 */
export function detectEntryPoints(
  context: EntryPointDetectionContext,
  repositoryId: number
): Omit<EntryPoint, 'id' | 'createdAt'>[] {
  const entryPoints: Omit<EntryPoint, 'id' | 'createdAt'>[] = [];
  const seenEntryPoints = new Set<string>();
  
  for (const file of context.files) {
    // Check each pattern
    for (const pattern of ENTRY_POINT_PATTERNS) {
      // Check if file path matches
      const fileMatches = pattern.filePatterns.some(p => p.test(file.path));
      if (!fileMatches) continue;
      
      // Check if content matches (if content available)
      let contentMatches = pattern.contentPatterns.length === 0;
      if (file.content) {
        contentMatches = pattern.contentPatterns.some(p => p.test(file.content!));
      }
      
      if (!contentMatches) continue;
      
      // Generate entry point
      const match = file.path.match(pattern.filePatterns[0]) || [file.path];
      const name = pattern.extractName
        ? pattern.extractName(match, file.path)
        : file.path;
      
      // Avoid duplicates
      const key = `${pattern.type}:${file.path}`;
      if (seenEntryPoints.has(key)) continue;
      seenEntryPoints.add(key);
      
      let functionName: string | null = null;
      let httpMethod: string | null = null;
      let routePath: string | null = null;
      
      if (file.content) {
        // Extract function name if available
        if (pattern.extractFunction) {
          functionName = pattern.extractFunction(file.content);
        }
        
        // Extract route info if available
        if (pattern.extractRoute) {
          const routeInfo = pattern.extractRoute(file.path, file.content);
          httpMethod = routeInfo.method;
          routePath = routeInfo.path;
        }
      }
      
      entryPoints.push({
        repositoryId,
        name,
        type: pattern.type,
        filePath: file.path,
        functionName,
        httpMethod,
        routePath,
        description: null,
      });
    }
  }
  
  // Sort by type and name
  entryPoints.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
  
  return entryPoints;
}

/**
 * Find the main entry point for the application
 */
export function findMainEntryPoint(
  entryPoints: EntryPoint[]
): EntryPoint | null {
  // Priority: main > server > app > index
  const priorities = ['main', 'server', 'app', 'index'];
  
  for (const priority of priorities) {
    const match = entryPoints.find(
      ep => ep.type === 'main' && ep.filePath.includes(priority)
    );
    if (match) return match;
  }
  
  // Fall back to first main type or any entry point
  return entryPoints.find(ep => ep.type === 'main') || entryPoints[0] || null;
}

/**
 * Group entry points by type
 */
export function groupEntryPointsByType(
  entryPoints: EntryPoint[]
): Map<EntryPointType, EntryPoint[]> {
  const grouped = new Map<EntryPointType, EntryPoint[]>();
  
  for (const ep of entryPoints) {
    if (!grouped.has(ep.type)) {
      grouped.set(ep.type, []);
    }
    grouped.get(ep.type)!.push(ep);
  }
  
  return grouped;
}

/**
 * Extract routes from entry points
 */
export function extractRoutes(
  entryPoints: EntryPoint[]
): Array<{ method: string; path: string; handler: string }> {
  const routes: Array<{ method: string; path: string; handler: string }> = [];
  
  for (const ep of entryPoints) {
    if (ep.routePath) {
      routes.push({
        method: ep.httpMethod || 'ANY',
        path: ep.routePath,
        handler: ep.filePath,
      });
    }
  }
  
  return routes;
}

/**
 * Count entry points by type
 */
export function countEntryPointsByType(
  entryPoints: EntryPoint[]
): Record<EntryPointType, number> {
  const counts: Partial<Record<EntryPointType, number>> = {};
  
  for (const ep of entryPoints) {
    counts[ep.type] = (counts[ep.type] || 0) + 1;
  }
  
  return counts as Record<EntryPointType, number>;
}
