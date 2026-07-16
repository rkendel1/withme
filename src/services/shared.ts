/**
 * Shared constants and utilities for repository services
 */

// File extensions to language mapping
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  swift: 'Swift',
  c: 'C',
  cpp: 'C++',
  h: 'C',
  hpp: 'C++',
  cs: 'C#',
  php: 'PHP',
  md: 'Markdown',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Shell',
};

// Extensions to skip content download (binary or large files)
export const SKIP_CONTENT_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp',
  'woff', 'woff2', 'ttf', 'eot',
  'pdf', 'zip', 'tar', 'gz',
  'mp3', 'mp4', 'wav', 'avi',
  'exe', 'dll', 'so', 'dylib',
  'lock', 'sum',
]);

// Max file size to download content (100KB)
export const MAX_FILE_SIZE = 100 * 1024;

/**
 * Get file extension from path
 */
export function getExtension(path: string): string | null {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return null;
  return path.slice(lastDot + 1).toLowerCase();
}

/**
 * Get file name from path
 */
export function getFileName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

/**
 * Get parent directory path
 */
export function getParentPath(path: string): string | null {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? null : path.slice(0, lastSlash);
}

/**
 * Determine language from extension
 */
export function getLanguage(extension: string | null): string | null {
  if (!extension) return null;
  return EXTENSION_TO_LANGUAGE[extension] || null;
}

/**
 * Extract symbols from TypeScript/JavaScript content
 */
export function extractSymbols(
  content: string,
  fileId: number,
  repositoryId: number
): Array<Omit<import('../types').Symbol, 'id'>> {
  const symbols: Array<Omit<import('../types').Symbol, 'id'>> = [];
  const lines = content.split('\n');

  const patterns = [
    { kind: 'function' as const, regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
    { kind: 'class' as const, regex: /^(?:export\s+)?class\s+(\w+)/ },
    { kind: 'interface' as const, regex: /^(?:export\s+)?interface\s+(\w+)/ },
    { kind: 'type' as const, regex: /^(?:export\s+)?type\s+(\w+)/ },
    { kind: 'constant' as const, regex: /^(?:export\s+)?const\s+(\w+)\s*=/ },
    { kind: 'enum' as const, regex: /^(?:export\s+)?enum\s+(\w+)/ },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const { kind, regex } of patterns) {
      const match = line.match(regex);
      if (match) {
        symbols.push({
          fileId,
          repositoryId,
          name: match[1],
          kind,
          startLine: i + 1,
          endLine: i + 1,
          signature: line,
          docstring: null,
        });
        break;
      }
    }
  }

  return symbols;
}

/**
 * Extract imports from TypeScript/JavaScript content
 */
export function extractImports(
  content: string,
  fileId: number,
  repositoryId: number
): Array<Omit<import('../types').Import, 'id'>> {
  const imports: Array<Omit<import('../types').Import, 'id'>> = [];
  const lines = content.split('\n');

  const namedImportRegex = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
  const defaultImportRegex = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;
  const mixedImportRegex = /^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const mixedMatch = line.match(mixedImportRegex);
    if (mixedMatch) {
      const defaultImport = mixedMatch[1];
      const namedImports = mixedMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
      const source = mixedMatch[3];

      imports.push({
        fileId,
        repositoryId,
        source,
        specifiers: [defaultImport, ...namedImports],
        isDefault: true,
        line: i + 1,
      });
      continue;
    }

    const namedMatch = line.match(namedImportRegex);
    if (namedMatch) {
      const namedImports = namedMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
      const source = namedMatch[2];

      imports.push({
        fileId,
        repositoryId,
        source,
        specifiers: namedImports,
        isDefault: false,
        line: i + 1,
      });
      continue;
    }

    const defaultMatch = line.match(defaultImportRegex);
    if (defaultMatch) {
      imports.push({
        fileId,
        repositoryId,
        source: defaultMatch[2],
        specifiers: [defaultMatch[1]],
        isDefault: true,
        line: i + 1,
      });
    }
  }

  return imports;
}

/**
 * Extract dependencies from package.json
 */
export function extractDependencies(
  content: string,
  repositoryId: number
): Array<Omit<import('../types').Dependency, 'id'>> {
  try {
    const pkg = JSON.parse(content);
    const dependencies: Array<Omit<import('../types').Dependency, 'id'>> = [];

    const addDeps = (deps: Record<string, string> | undefined, type: 'production' | 'development' | 'peer' | 'optional') => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        dependencies.push({
          repositoryId,
          name,
          version,
          type,
          ecosystem: 'npm',
        });
      }
    };

    addDeps(pkg.dependencies, 'production');
    addDeps(pkg.devDependencies, 'development');
    addDeps(pkg.peerDependencies, 'peer');

    return dependencies;
  } catch {
    return [];
  }
}
