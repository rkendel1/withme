/**
 * Runtime Detection Service
 * 
 * Detects the runtime environment, package managers, frameworks, and
 * generates runtime profiles from repository analysis.
 */

import type { RepoFile, Dependency } from '../../types';
import type {
  RuntimeLanguage,
  PackageManager,
  RuntimeFramework,
  RuntimeDetectionResult,
} from '../../types/runtime';

// ============================================================================
// Detection Interfaces
// ============================================================================

interface LanguagePattern {
  language: RuntimeLanguage;
  extensions: string[];
  files: string[];
  priority: number;
}

interface PackageManagerPattern {
  manager: PackageManager;
  lockFile: string;
  configFile: string;
  runtime: RuntimeLanguage[];
  installCommand: string;
  startCommand: string;
}

interface FrameworkPattern {
  framework: RuntimeFramework;
  runtime: RuntimeLanguage;
  indicators: {
    dependencies?: string[];
    files?: string[];
    content?: RegExp[];
  };
  defaultPort: number;
  startCommand: string;
  buildCommand?: string;
}

// ============================================================================
// Detection Patterns
// ============================================================================

const LANGUAGE_PATTERNS: LanguagePattern[] = [
  {
    language: 'node',
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
    files: ['package.json'],
    priority: 10,
  },
  {
    language: 'python',
    extensions: ['.py', '.pyw'],
    files: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
    priority: 9,
  },
  {
    language: 'rust',
    extensions: ['.rs'],
    files: ['Cargo.toml'],
    priority: 8,
  },
  {
    language: 'go',
    extensions: ['.go'],
    files: ['go.mod', 'go.sum'],
    priority: 8,
  },
  {
    language: 'java',
    extensions: ['.java'],
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    priority: 7,
  },
  {
    language: 'dotnet',
    extensions: ['.cs', '.fs', '.vb'],
    files: ['*.csproj', '*.fsproj', '*.sln'],
    priority: 7,
  },
  {
    language: 'ruby',
    extensions: ['.rb'],
    files: ['Gemfile', 'Rakefile'],
    priority: 6,
  },
  {
    language: 'php',
    extensions: ['.php'],
    files: ['composer.json'],
    priority: 6,
  },
];

const PACKAGE_MANAGER_PATTERNS: PackageManagerPattern[] = [
  // Node.js package managers
  {
    manager: 'pnpm',
    lockFile: 'pnpm-lock.yaml',
    configFile: 'package.json',
    runtime: ['node'],
    installCommand: 'pnpm install',
    startCommand: 'pnpm start',
  },
  {
    manager: 'yarn',
    lockFile: 'yarn.lock',
    configFile: 'package.json',
    runtime: ['node'],
    installCommand: 'yarn install',
    startCommand: 'yarn start',
  },
  {
    manager: 'npm',
    lockFile: 'package-lock.json',
    configFile: 'package.json',
    runtime: ['node'],
    installCommand: 'npm install',
    startCommand: 'npm start',
  },
  // Python package managers
  {
    manager: 'poetry',
    lockFile: 'poetry.lock',
    configFile: 'pyproject.toml',
    runtime: ['python'],
    installCommand: 'poetry install',
    startCommand: 'poetry run python main.py',
  },
  {
    manager: 'pipenv',
    lockFile: 'Pipfile.lock',
    configFile: 'Pipfile',
    runtime: ['python'],
    installCommand: 'pipenv install',
    startCommand: 'pipenv run python main.py',
  },
  {
    manager: 'pip',
    lockFile: '',
    configFile: 'requirements.txt',
    runtime: ['python'],
    installCommand: 'pip install -r requirements.txt',
    startCommand: 'python main.py',
  },
  // Rust
  {
    manager: 'cargo',
    lockFile: 'Cargo.lock',
    configFile: 'Cargo.toml',
    runtime: ['rust'],
    installCommand: 'cargo build',
    startCommand: 'cargo run',
  },
  // Go
  {
    manager: 'go_modules',
    lockFile: 'go.sum',
    configFile: 'go.mod',
    runtime: ['go'],
    installCommand: 'go mod download',
    startCommand: 'go run .',
  },
  // Java
  {
    manager: 'maven',
    lockFile: '',
    configFile: 'pom.xml',
    runtime: ['java'],
    installCommand: 'mvn install',
    startCommand: 'mvn spring-boot:run',
  },
  {
    manager: 'gradle',
    lockFile: 'gradle.lockfile',
    configFile: 'build.gradle',
    runtime: ['java'],
    installCommand: 'gradle build',
    startCommand: 'gradle bootRun',
  },
  // .NET
  {
    manager: 'nuget',
    lockFile: 'packages.lock.json',
    configFile: '*.csproj',
    runtime: ['dotnet'],
    installCommand: 'dotnet restore',
    startCommand: 'dotnet run',
  },
  // Ruby
  {
    manager: 'bundler',
    lockFile: 'Gemfile.lock',
    configFile: 'Gemfile',
    runtime: ['ruby'],
    installCommand: 'bundle install',
    startCommand: 'bundle exec ruby app.rb',
  },
  // PHP
  {
    manager: 'composer',
    lockFile: 'composer.lock',
    configFile: 'composer.json',
    runtime: ['php'],
    installCommand: 'composer install',
    startCommand: 'php artisan serve',
  },
];

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  // Node.js frameworks
  {
    framework: 'nextjs',
    runtime: 'node',
    indicators: {
      dependencies: ['next'],
      files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    },
    defaultPort: 3000,
    startCommand: 'next dev',
    buildCommand: 'next build',
  },
  {
    framework: 'vite',
    runtime: 'node',
    indicators: {
      dependencies: ['vite'],
      files: ['vite.config.js', 'vite.config.ts'],
    },
    defaultPort: 5173,
    startCommand: 'vite',
    buildCommand: 'vite build',
  },
  {
    framework: 'react',
    runtime: 'node',
    indicators: {
      dependencies: ['react', 'react-dom'],
    },
    defaultPort: 3000,
    startCommand: 'npm start',
    buildCommand: 'npm run build',
  },
  {
    framework: 'vue',
    runtime: 'node',
    indicators: {
      dependencies: ['vue'],
      files: ['vue.config.js'],
    },
    defaultPort: 8080,
    startCommand: 'npm run serve',
    buildCommand: 'npm run build',
  },
  {
    framework: 'angular',
    runtime: 'node',
    indicators: {
      dependencies: ['@angular/core'],
      files: ['angular.json'],
    },
    defaultPort: 4200,
    startCommand: 'ng serve',
    buildCommand: 'ng build',
  },
  {
    framework: 'express',
    runtime: 'node',
    indicators: {
      dependencies: ['express'],
      content: [/require\(['"]express['"]\)/, /from ['"]express['"]/],
    },
    defaultPort: 3000,
    startCommand: 'node server.js',
  },
  {
    framework: 'fastify',
    runtime: 'node',
    indicators: {
      dependencies: ['fastify'],
    },
    defaultPort: 3000,
    startCommand: 'node server.js',
  },
  {
    framework: 'nestjs',
    runtime: 'node',
    indicators: {
      dependencies: ['@nestjs/core'],
      files: ['nest-cli.json'],
    },
    defaultPort: 3000,
    startCommand: 'nest start',
    buildCommand: 'nest build',
  },
  // Python frameworks
  {
    framework: 'django',
    runtime: 'python',
    indicators: {
      files: ['manage.py'],
      content: [/from django/, /import django/],
    },
    defaultPort: 8000,
    startCommand: 'python manage.py runserver',
  },
  {
    framework: 'fastapi',
    runtime: 'python',
    indicators: {
      content: [/from fastapi/, /import fastapi/],
    },
    defaultPort: 8000,
    startCommand: 'uvicorn main:app --reload',
  },
  {
    framework: 'flask',
    runtime: 'python',
    indicators: {
      content: [/from flask/, /import flask/i],
    },
    defaultPort: 5000,
    startCommand: 'flask run',
  },
  // Ruby
  {
    framework: 'rails',
    runtime: 'ruby',
    indicators: {
      files: ['config/routes.rb', 'bin/rails'],
      content: [/Rails\.application/],
    },
    defaultPort: 3000,
    startCommand: 'rails server',
  },
  // Java
  {
    framework: 'spring_boot',
    runtime: 'java',
    indicators: {
      content: [/@SpringBootApplication/],
    },
    defaultPort: 8080,
    startCommand: 'mvn spring-boot:run',
    buildCommand: 'mvn package',
  },
  // PHP
  {
    framework: 'laravel',
    runtime: 'php',
    indicators: {
      files: ['artisan'],
      content: [/Laravel/],
    },
    defaultPort: 8000,
    startCommand: 'php artisan serve',
  },
  // Rust
  {
    framework: 'actix',
    runtime: 'rust',
    indicators: {
      content: [/actix_web/, /actix-web/],
    },
    defaultPort: 8080,
    startCommand: 'cargo run',
  },
  {
    framework: 'rocket',
    runtime: 'rust',
    indicators: {
      content: [/#\[launch\]/, /rocket::/],
    },
    defaultPort: 8000,
    startCommand: 'cargo run',
  },
  // Go
  {
    framework: 'gin',
    runtime: 'go',
    indicators: {
      content: [/gin\.Default/, /github\.com\/gin-gonic\/gin/],
    },
    defaultPort: 8080,
    startCommand: 'go run .',
  },
  {
    framework: 'fiber',
    runtime: 'go',
    indicators: {
      content: [/fiber\.New/, /github\.com\/gofiber\/fiber/],
    },
    defaultPort: 3000,
    startCommand: 'go run .',
  },
];

// ============================================================================
// Detection Context
// ============================================================================

interface DetectionContext {
  files: RepoFile[];
  dependencies: Dependency[];
  fileNames: Set<string>;
  filePaths: Set<string>;
  extensions: Map<string, number>;
}

function createDetectionContext(
  files: RepoFile[],
  dependencies: Dependency[]
): DetectionContext {
  const fileNames = new Set<string>();
  const filePaths = new Set<string>();
  const extensions = new Map<string, number>();

  for (const file of files) {
    fileNames.add(file.name);
    filePaths.add(file.path);
    if (file.extension) {
      extensions.set(file.extension, (extensions.get(file.extension) || 0) + 1);
    }
  }

  return { files, dependencies, fileNames, filePaths, extensions };
}

// ============================================================================
// Runtime Detection
// ============================================================================

/**
 * Detect the primary runtime language from repository files
 */
export function detectRuntime(context: DetectionContext): {
  runtime: RuntimeLanguage;
  version: string | null;
  confidence: number;
} {
  const scores = new Map<RuntimeLanguage, number>();

  // Score based on file extensions
  for (const pattern of LANGUAGE_PATTERNS) {
    let score = 0;
    for (const ext of pattern.extensions) {
      const count = context.extensions.get(ext) || 0;
      score += count * pattern.priority;
    }
    
    // Bonus for config files
    for (const configFile of pattern.files) {
      if (context.fileNames.has(configFile)) {
        score += 100;
      }
    }
    
    if (score > 0) {
      scores.set(pattern.language, (scores.get(pattern.language) || 0) + score);
    }
  }

  // Find highest scoring runtime
  let bestRuntime: RuntimeLanguage = 'unknown';
  let bestScore = 0;
  let totalScore = 0;

  for (const [runtime, score] of scores) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestRuntime = runtime;
    }
  }

  const confidence = totalScore > 0 ? Math.min(bestScore / totalScore, 1) : 0;

  // Try to detect version from config files
  const version = detectRuntimeVersion(context, bestRuntime);

  return { runtime: bestRuntime, version, confidence };
}

/**
 * Detect runtime version from configuration files
 */
function detectRuntimeVersion(
  context: DetectionContext,
  runtime: RuntimeLanguage
): string | null {
  const packageJson = context.files.find(f => f.name === 'package.json');
  
  if (runtime === 'node' && packageJson?.content) {
    try {
      const pkg = JSON.parse(packageJson.content);
      if (pkg.engines?.node) {
        const match = pkg.engines.node.match(/[\d.]+/);
        return match ? match[0] : null;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Add more version detection for other runtimes as needed
  return null;
}

// ============================================================================
// Package Manager Detection
// ============================================================================

/**
 * Detect the package manager from lock files
 */
export function detectPackageManager(
  context: DetectionContext,
  runtime: RuntimeLanguage
): { manager: PackageManager; lockFile: string | null; installCommand: string; startCommand: string } {
  // First, check for lock files (most reliable)
  for (const pattern of PACKAGE_MANAGER_PATTERNS) {
    if (!pattern.runtime.includes(runtime)) continue;
    
    if (pattern.lockFile && context.fileNames.has(pattern.lockFile)) {
      return {
        manager: pattern.manager,
        lockFile: pattern.lockFile,
        installCommand: pattern.installCommand,
        startCommand: pattern.startCommand,
      };
    }
  }

  // Fall back to config file detection
  for (const pattern of PACKAGE_MANAGER_PATTERNS) {
    if (!pattern.runtime.includes(runtime)) continue;
    
    if (pattern.configFile.includes('*')) {
      // Glob pattern - check for any matching file
      // Replace all asterisks with empty string to get the base pattern
      const basePattern = pattern.configFile.split('*').join('');
      if ([...context.fileNames].some(name => name.endsWith(basePattern))) {
        return {
          manager: pattern.manager,
          lockFile: null,
          installCommand: pattern.installCommand,
          startCommand: pattern.startCommand,
        };
      }
    } else if (context.fileNames.has(pattern.configFile)) {
      return {
        manager: pattern.manager,
        lockFile: null,
        installCommand: pattern.installCommand,
        startCommand: pattern.startCommand,
      };
    }
  }

  return {
    manager: 'unknown',
    lockFile: null,
    installCommand: '',
    startCommand: '',
  };
}

// ============================================================================
// Framework Detection
// ============================================================================

/**
 * Detect the framework being used
 */
export function detectFramework(
  context: DetectionContext,
  runtime: RuntimeLanguage
): { framework: RuntimeFramework | null; version: string | null; port: number; startCommand: string; buildCommand: string | null } {
  const depNames = new Set(context.dependencies.map(d => d.name.toLowerCase()));

  for (const pattern of FRAMEWORK_PATTERNS) {
    if (pattern.runtime !== runtime) continue;

    let detected = false;

    // Check dependencies
    if (pattern.indicators.dependencies) {
      detected = pattern.indicators.dependencies.some(dep => depNames.has(dep.toLowerCase()));
    }

    // Check files
    if (!detected && pattern.indicators.files) {
      detected = pattern.indicators.files.some(file => context.fileNames.has(file));
    }

    // Check content patterns
    if (!detected && pattern.indicators.content) {
      for (const file of context.files) {
        if (!file.content) continue;
        if (pattern.indicators.content.some(regex => regex.test(file.content!))) {
          detected = true;
          break;
        }
      }
    }

    if (detected) {
      // Try to get framework version from dependencies
      let version: string | null = null;
      if (pattern.indicators.dependencies) {
        const dep = context.dependencies.find(d => 
          pattern.indicators.dependencies!.includes(d.name.toLowerCase())
        );
        version = dep?.version || null;
      }

      return {
        framework: pattern.framework,
        version,
        port: pattern.defaultPort,
        startCommand: pattern.startCommand,
        buildCommand: pattern.buildCommand || null,
      };
    }
  }

  return {
    framework: null,
    version: null,
    port: 3000,
    startCommand: '',
    buildCommand: null,
  };
}

// ============================================================================
// Environment Variable Detection
// ============================================================================

/**
 * Detect environment variables from files
 */
export function detectEnvironmentVariables(context: DetectionContext): Record<string, string> {
  const envVars: Record<string, string> = {};

  // Look for .env.example or .env.sample files
  const envExampleFile = context.files.find(f => 
    f.name === '.env.example' || 
    f.name === '.env.sample' ||
    f.name === '.env.template'
  );

  if (envExampleFile?.content) {
    const lines = envExampleFile.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        envVars[match[1]] = match[2] || '';
      }
    }
  }

  return envVars;
}

// ============================================================================
// Port Detection
// ============================================================================

/**
 * Detect ports from configuration and code
 */
export function detectPorts(
  context: DetectionContext,
  framework: RuntimeFramework | null
): number[] {
  const ports = new Set<number>();

  // Get default port from framework
  if (framework) {
    const pattern = FRAMEWORK_PATTERNS.find(p => p.framework === framework);
    if (pattern) {
      ports.add(pattern.defaultPort);
    }
  }

  // Check Dockerfile
  const dockerfile = context.files.find(f => f.name === 'Dockerfile');
  if (dockerfile?.content) {
    const exposeMatches = dockerfile.content.matchAll(/EXPOSE\s+(\d+)/g);
    for (const match of exposeMatches) {
      ports.add(parseInt(match[1]));
    }
  }

  // Check docker-compose.yml
  const dockerCompose = context.files.find(f => 
    f.name === 'docker-compose.yml' || f.name === 'docker-compose.yaml'
  );
  if (dockerCompose?.content) {
    const portMatches = dockerCompose.content.matchAll(/['"]?(\d+):(\d+)['"]?/g);
    for (const match of portMatches) {
      ports.add(parseInt(match[2]));
    }
  }

  // Check package.json for port in scripts
  const packageJson = context.files.find(f => f.name === 'package.json');
  if (packageJson?.content) {
    const portMatch = packageJson.content.match(/--port[=\s]+(\d+)/);
    if (portMatch) {
      ports.add(parseInt(portMatch[1]));
    }
  }

  // Default to 3000 if no ports found
  if (ports.size === 0) {
    ports.add(3000);
  }

  return Array.from(ports).sort((a, b) => a - b);
}

// ============================================================================
// Start Command Detection
// ============================================================================

/**
 * Detect the start command from package.json or other config
 */
export function detectStartCommand(
  context: DetectionContext,
  runtime: RuntimeLanguage,
  packageManager: PackageManager,
  framework: RuntimeFramework | null
): string {
  // Check package.json for Node.js projects
  if (runtime === 'node') {
    const packageJson = context.files.find(f => f.name === 'package.json');
    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        if (pkg.scripts) {
          // Prefer 'dev' script for development
          if (pkg.scripts.dev) {
            const prefix = getPackageManagerRunPrefix(packageManager);
            return `${prefix} dev`;
          }
          if (pkg.scripts.start) {
            const prefix = getPackageManagerRunPrefix(packageManager);
            return `${prefix} start`;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Use framework-specific start command
  if (framework) {
    const pattern = FRAMEWORK_PATTERNS.find(p => p.framework === framework);
    if (pattern) {
      return pattern.startCommand;
    }
  }

  // Fall back to package manager default
  const pmPattern = PACKAGE_MANAGER_PATTERNS.find(p => p.manager === packageManager);
  return pmPattern?.startCommand || '';
}

function getPackageManagerRunPrefix(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm': return 'pnpm';
    case 'yarn': return 'yarn';
    case 'npm': return 'npm run';
    default: return 'npm run';
  }
}

// ============================================================================
// Full Runtime Detection
// ============================================================================

/**
 * Perform full runtime detection on a repository
 */
export function detectRuntimeProfile(
  files: RepoFile[],
  dependencies: Dependency[]
): RuntimeDetectionResult {
  const context = createDetectionContext(files, dependencies);

  // Detect primary runtime
  const { runtime, version, confidence } = detectRuntime(context);

  // Detect package manager
  const {
    manager: packageManager,
    lockFile,
    installCommand: pmInstallCommand,
    startCommand: pmStartCommand,
  } = detectPackageManager(context, runtime);

  // Detect framework
  const {
    framework,
    version: frameworkVersion,
    startCommand: fwStartCommand,
    buildCommand: fwBuildCommand,
  } = detectFramework(context, runtime);

  // Detect environment variables
  const environmentVariables = detectEnvironmentVariables(context);

  // Detect ports
  const ports = detectPorts(context, framework);

  // Detect start command
  const startCommand = detectStartCommand(context, runtime, packageManager, framework) ||
    fwStartCommand ||
    pmStartCommand;

  // Build detected from list
  const detectedFrom: string[] = [];
  if (lockFile) detectedFrom.push(lockFile);
  const configFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'Gemfile', 'composer.json'];
  for (const cf of configFiles) {
    if (context.fileNames.has(cf)) {
      detectedFrom.push(cf);
    }
  }

  return {
    runtime,
    version,
    confidence,
    packageManager,
    lockFile,
    framework,
    frameworkVersion,
    installCommand: pmInstallCommand,
    startCommand,
    buildCommand: fwBuildCommand,
    testCommand: detectTestCommand(context, runtime, packageManager),
    ports,
    environmentVariables,
    detectedFrom,
  };
}

/**
 * Detect test command
 */
function detectTestCommand(
  context: DetectionContext,
  runtime: RuntimeLanguage,
  packageManager: PackageManager
): string | null {
  if (runtime === 'node') {
    const packageJson = context.files.find(f => f.name === 'package.json');
    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          const prefix = getPackageManagerRunPrefix(packageManager);
          return `${prefix} test`;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  if (runtime === 'python') {
    if (context.fileNames.has('pytest.ini') || context.fileNames.has('conftest.py')) {
      return 'pytest';
    }
  }

  if (runtime === 'rust') {
    return 'cargo test';
  }

  if (runtime === 'go') {
    return 'go test ./...';
  }

  return null;
}
