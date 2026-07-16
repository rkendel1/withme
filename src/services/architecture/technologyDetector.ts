/**
 * Technology Detector
 * 
 * Detects frameworks, databases, queues, and runtime components
 * from repository files and dependencies.
 */

import type {
  Technology,
  TechnologyCategory,
  Datastore,
  DatastoreType,
  Queue,
  QueueType,
} from '../../types/architecture';
import type { RepoFile, Dependency } from '../../types';

// ============================================================================
// Technology Detection Patterns
// ============================================================================

interface TechnologyPattern {
  name: string;
  category: TechnologyCategory;
  indicators: {
    files?: RegExp[];
    dependencies?: string[];
    content?: RegExp[];
    directories?: string[];
  };
}

const TECHNOLOGY_PATTERNS: TechnologyPattern[] = [
  // Frameworks
  {
    name: 'React',
    category: 'framework',
    indicators: {
      dependencies: ['react', 'react-dom'],
      content: [/from ['"]react['"]/],
    },
  },
  {
    name: 'Next.js',
    category: 'framework',
    indicators: {
      dependencies: ['next'],
      files: [/next\.config\.(js|ts|mjs)$/],
      directories: ['pages', 'app'],
    },
  },
  {
    name: 'Vue.js',
    category: 'framework',
    indicators: {
      dependencies: ['vue'],
      files: [/\.vue$/],
    },
  },
  {
    name: 'Angular',
    category: 'framework',
    indicators: {
      dependencies: ['@angular/core'],
      files: [/angular\.json$/],
    },
  },
  {
    name: 'Express',
    category: 'framework',
    indicators: {
      dependencies: ['express'],
      content: [/require\(['"]express['"]\)/, /from ['"]express['"]/],
    },
  },
  {
    name: 'Fastify',
    category: 'framework',
    indicators: {
      dependencies: ['fastify'],
      content: [/require\(['"]fastify['"]\)/, /from ['"]fastify['"]/],
    },
  },
  {
    name: 'NestJS',
    category: 'framework',
    indicators: {
      dependencies: ['@nestjs/core'],
      files: [/nest-cli\.json$/],
    },
  },
  {
    name: 'Hono',
    category: 'framework',
    indicators: {
      dependencies: ['hono'],
      content: [/from ['"]hono['"]/],
    },
  },
  {
    name: 'Koa',
    category: 'framework',
    indicators: {
      dependencies: ['koa'],
      content: [/require\(['"]koa['"]\)/, /from ['"]koa['"]/],
    },
  },
  {
    name: 'Django',
    category: 'framework',
    indicators: {
      files: [/manage\.py$/, /settings\.py$/],
      content: [/from django/, /import django/],
    },
  },
  {
    name: 'Flask',
    category: 'framework',
    indicators: {
      content: [/from flask import/, /import flask/],
    },
  },
  {
    name: 'FastAPI',
    category: 'framework',
    indicators: {
      content: [/from fastapi import/, /import fastapi/],
    },
  },
  {
    name: 'Spring Boot',
    category: 'framework',
    indicators: {
      files: [/pom\.xml$/, /build\.gradle$/],
      content: [/@SpringBootApplication/, /spring-boot-starter/],
    },
  },
  {
    name: 'Rails',
    category: 'framework',
    indicators: {
      files: [/Gemfile$/, /config\/routes\.rb$/],
      content: [/Rails\.application/],
    },
  },
  
  // Databases
  {
    name: 'PostgreSQL',
    category: 'database',
    indicators: {
      dependencies: ['pg', 'postgres', 'postgresql', '@prisma/client', 'typeorm', 'sequelize'],
      content: [/postgres:\/\//, /postgresql:\/\//, /DATABASE_URL.*postgres/i],
    },
  },
  {
    name: 'MySQL',
    category: 'database',
    indicators: {
      dependencies: ['mysql', 'mysql2'],
      content: [/mysql:\/\//, /DATABASE_URL.*mysql/i],
    },
  },
  {
    name: 'MongoDB',
    category: 'database',
    indicators: {
      dependencies: ['mongodb', 'mongoose'],
      content: [/mongodb:\/\//, /mongodb\+srv:\/\//],
    },
  },
  {
    name: 'SQLite',
    category: 'database',
    indicators: {
      dependencies: ['sqlite3', 'better-sqlite3', 'sql.js'],
      files: [/\.sqlite$/, /\.db$/],
    },
  },
  {
    name: 'Redis',
    category: 'cache',
    indicators: {
      dependencies: ['redis', 'ioredis'],
      content: [/redis:\/\//, /REDIS_URL/],
    },
  },
  {
    name: 'DynamoDB',
    category: 'database',
    indicators: {
      dependencies: ['@aws-sdk/client-dynamodb', 'dynamodb'],
      content: [/DynamoDB/, /dynamodb/],
    },
  },
  {
    name: 'Elasticsearch',
    category: 'database',
    indicators: {
      dependencies: ['@elastic/elasticsearch', 'elasticsearch'],
      content: [/elasticsearch/, /ELASTICSEARCH_URL/i],
    },
  },
  
  // Message Queues
  {
    name: 'Kafka',
    category: 'queue',
    indicators: {
      dependencies: ['kafkajs', 'kafka-node'],
      content: [/Kafka/, /KAFKA_BROKERS/i],
    },
  },
  {
    name: 'RabbitMQ',
    category: 'queue',
    indicators: {
      dependencies: ['amqplib', 'amqp-connection-manager'],
      content: [/amqp:\/\//, /RABBITMQ_URL/i],
    },
  },
  {
    name: 'Bull',
    category: 'queue',
    indicators: {
      dependencies: ['bull', 'bullmq'],
      content: [/new Bull\(/, /new Queue\(/],
    },
  },
  {
    name: 'SQS',
    category: 'queue',
    indicators: {
      dependencies: ['@aws-sdk/client-sqs', 'sqs-consumer'],
      content: [/SQSClient/, /sqs\./],
    },
  },
  
  // Storage
  {
    name: 'AWS S3',
    category: 'storage',
    indicators: {
      dependencies: ['@aws-sdk/client-s3', 'aws-sdk'],
      content: [/S3Client/, /s3\./, /S3_BUCKET/i],
    },
  },
  {
    name: 'Google Cloud Storage',
    category: 'storage',
    indicators: {
      dependencies: ['@google-cloud/storage'],
      content: [/Storage\(\)/, /GCS_BUCKET/i],
    },
  },
  
  // Containers
  {
    name: 'Docker',
    category: 'container',
    indicators: {
      files: [/Dockerfile$/, /docker-compose\.ya?ml$/],
    },
  },
  {
    name: 'Kubernetes',
    category: 'orchestration',
    indicators: {
      files: [/k8s\//, /kubernetes\//, /\.ya?ml$/],
      content: [/apiVersion:.*apps\/v1/, /kind:\s*Deployment/],
    },
  },
  
  // CI/CD
  {
    name: 'GitHub Actions',
    category: 'ci_cd',
    indicators: {
      files: [/\.github\/workflows\/.*\.ya?ml$/],
    },
  },
  {
    name: 'GitLab CI',
    category: 'ci_cd',
    indicators: {
      files: [/\.gitlab-ci\.ya?ml$/],
    },
  },
  {
    name: 'Jenkins',
    category: 'ci_cd',
    indicators: {
      files: [/Jenkinsfile$/],
    },
  },
  {
    name: 'CircleCI',
    category: 'ci_cd',
    indicators: {
      files: [/\.circleci\/config\.ya?ml$/],
    },
  },
  
  // Testing
  {
    name: 'Jest',
    category: 'testing',
    indicators: {
      dependencies: ['jest', '@jest/core'],
      files: [/jest\.config\.(js|ts)$/],
    },
  },
  {
    name: 'Vitest',
    category: 'testing',
    indicators: {
      dependencies: ['vitest'],
      files: [/vitest\.config\.(js|ts)$/],
    },
  },
  {
    name: 'Mocha',
    category: 'testing',
    indicators: {
      dependencies: ['mocha'],
      files: [/\.mocharc\.(js|json|ya?ml)$/],
    },
  },
  {
    name: 'Pytest',
    category: 'testing',
    indicators: {
      files: [/pytest\.ini$/, /conftest\.py$/],
      content: [/import pytest/, /from pytest/],
    },
  },
  
  // Build Tools
  {
    name: 'Vite',
    category: 'build_tool',
    indicators: {
      dependencies: ['vite'],
      files: [/vite\.config\.(js|ts)$/],
    },
  },
  {
    name: 'Webpack',
    category: 'build_tool',
    indicators: {
      dependencies: ['webpack'],
      files: [/webpack\.config\.(js|ts)$/],
    },
  },
  {
    name: 'Rollup',
    category: 'build_tool',
    indicators: {
      dependencies: ['rollup'],
      files: [/rollup\.config\.(js|ts)$/],
    },
  },
  {
    name: 'esbuild',
    category: 'build_tool',
    indicators: {
      dependencies: ['esbuild'],
    },
  },
  {
    name: 'Turbopack',
    category: 'build_tool',
    indicators: {
      dependencies: ['@vercel/turbopack'],
    },
  },
  
  // Monitoring & Logging
  {
    name: 'Sentry',
    category: 'monitoring',
    indicators: {
      dependencies: ['@sentry/node', '@sentry/react', '@sentry/browser'],
      content: [/Sentry\.init/, /SENTRY_DSN/],
    },
  },
  {
    name: 'Datadog',
    category: 'monitoring',
    indicators: {
      dependencies: ['dd-trace', 'datadog-metrics'],
      content: [/DD_API_KEY/, /datadog/i],
    },
  },
  {
    name: 'Prometheus',
    category: 'monitoring',
    indicators: {
      dependencies: ['prom-client'],
      content: [/prometheus/, /metrics/],
    },
  },
  {
    name: 'Winston',
    category: 'logging',
    indicators: {
      dependencies: ['winston'],
      content: [/winston\.createLogger/],
    },
  },
  {
    name: 'Pino',
    category: 'logging',
    indicators: {
      dependencies: ['pino'],
      content: [/pino\(\)/, /from ['"]pino['"]/],
    },
  },
  
  // Languages (detected from file extensions)
  {
    name: 'TypeScript',
    category: 'language',
    indicators: {
      files: [/\.tsx?$/],
      dependencies: ['typescript'],
    },
  },
  {
    name: 'JavaScript',
    category: 'language',
    indicators: {
      files: [/\.jsx?$/],
    },
  },
  {
    name: 'Python',
    category: 'language',
    indicators: {
      files: [/\.py$/],
    },
  },
  {
    name: 'Go',
    category: 'language',
    indicators: {
      files: [/\.go$/, /go\.mod$/],
    },
  },
  {
    name: 'Rust',
    category: 'language',
    indicators: {
      files: [/\.rs$/, /Cargo\.toml$/],
    },
  },
  {
    name: 'Java',
    category: 'language',
    indicators: {
      files: [/\.java$/],
    },
  },
];

// ============================================================================
// Datastore Detection
// ============================================================================

interface DatastorePattern {
  type: DatastoreType;
  indicators: {
    dependencies?: string[];
    content?: RegExp[];
    envVars?: RegExp[];
  };
}

const DATASTORE_PATTERNS: DatastorePattern[] = [
  {
    type: 'postgresql',
    indicators: {
      dependencies: ['pg', 'postgres', '@prisma/client', 'typeorm', 'sequelize', 'knex'],
      content: [/postgres:\/\//, /postgresql:\/\//],
      envVars: [/DATABASE_URL.*postgres/i, /PG_HOST/, /POSTGRES_/],
    },
  },
  {
    type: 'mysql',
    indicators: {
      dependencies: ['mysql', 'mysql2'],
      content: [/mysql:\/\//],
      envVars: [/MYSQL_/, /DATABASE_URL.*mysql/i],
    },
  },
  {
    type: 'mongodb',
    indicators: {
      dependencies: ['mongodb', 'mongoose'],
      content: [/mongodb:\/\//, /mongodb\+srv:\/\//],
      envVars: [/MONGODB_URI/, /MONGO_URL/],
    },
  },
  {
    type: 'redis',
    indicators: {
      dependencies: ['redis', 'ioredis'],
      content: [/redis:\/\//],
      envVars: [/REDIS_URL/, /REDIS_HOST/],
    },
  },
  {
    type: 'elasticsearch',
    indicators: {
      dependencies: ['@elastic/elasticsearch', 'elasticsearch'],
      envVars: [/ELASTICSEARCH_URL/, /ES_HOST/],
    },
  },
  {
    type: 'dynamodb',
    indicators: {
      dependencies: ['@aws-sdk/client-dynamodb', 'dynamodb'],
      content: [/DynamoDBClient/],
    },
  },
  {
    type: 's3',
    indicators: {
      dependencies: ['@aws-sdk/client-s3', 'aws-sdk'],
      content: [/S3Client/, /new S3\(/],
      envVars: [/S3_BUCKET/, /AWS_S3_/],
    },
  },
  {
    type: 'sqlite',
    indicators: {
      dependencies: ['sqlite3', 'better-sqlite3', 'sql.js', '@electric-sql/pglite'],
      content: [/\.sqlite/, /\.db/],
    },
  },
];

// ============================================================================
// Queue Detection
// ============================================================================

interface QueuePattern {
  type: QueueType;
  indicators: {
    dependencies?: string[];
    content?: RegExp[];
    envVars?: RegExp[];
  };
}

const QUEUE_PATTERNS: QueuePattern[] = [
  {
    type: 'kafka',
    indicators: {
      dependencies: ['kafkajs', 'kafka-node'],
      content: [/Kafka\(/, /KafkaClient/],
      envVars: [/KAFKA_BROKERS/, /KAFKA_HOST/],
    },
  },
  {
    type: 'rabbitmq',
    indicators: {
      dependencies: ['amqplib', 'amqp-connection-manager'],
      content: [/amqp:\/\//],
      envVars: [/RABBITMQ_URL/, /AMQP_URL/],
    },
  },
  {
    type: 'sqs',
    indicators: {
      dependencies: ['@aws-sdk/client-sqs', 'sqs-consumer'],
      content: [/SQSClient/],
      envVars: [/SQS_QUEUE_URL/],
    },
  },
  {
    type: 'bull',
    indicators: {
      dependencies: ['bull', 'bullmq'],
      content: [/new Bull\(/, /new Queue\(/],
    },
  },
  {
    type: 'redis_pubsub',
    indicators: {
      dependencies: ['redis', 'ioredis'],
      content: [/\.subscribe\(/, /\.publish\(/],
    },
  },
  {
    type: 'nats',
    indicators: {
      dependencies: ['nats', 'nats.js'],
      content: [/connect\(.*nats/i],
      envVars: [/NATS_URL/],
    },
  },
];

// ============================================================================
// Detection Functions
// ============================================================================

export interface DetectionContext {
  files: RepoFile[];
  dependencies: Dependency[];
}

/**
 * Detect technologies used in the repository
 */
export function detectTechnologies(
  context: DetectionContext,
  repositoryId: number
): Omit<Technology, 'id' | 'createdAt'>[] {
  const detected: Omit<Technology, 'id' | 'createdAt'>[] = [];
  const depNames = new Set(context.dependencies.map(d => d.name.toLowerCase()));
  
  for (const pattern of TECHNOLOGY_PATTERNS) {
    let confidence = 0;
    const detectedIn: string[] = [];
    
    // Check dependencies
    if (pattern.indicators.dependencies) {
      for (const dep of pattern.indicators.dependencies) {
        if (depNames.has(dep.toLowerCase())) {
          confidence += 0.4;
          detectedIn.push(`dependency:${dep}`);
          break;
        }
      }
    }
    
    // Check file patterns
    if (pattern.indicators.files) {
      for (const file of context.files) {
        for (const filePattern of pattern.indicators.files) {
          if (filePattern.test(file.path)) {
            confidence += 0.3;
            detectedIn.push(`file:${file.path}`);
            break;
          }
        }
      }
    }
    
    // Check directory patterns
    if (pattern.indicators.directories) {
      for (const file of context.files) {
        for (const dir of pattern.indicators.directories) {
          if (file.path.startsWith(dir + '/') || file.path === dir) {
            confidence += 0.2;
            detectedIn.push(`directory:${dir}`);
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
            confidence += 0.3;
            detectedIn.push(`content:${file.path}`);
            break;
          }
        }
      }
    }
    
    if (confidence > 0) {
      // Find version from dependencies
      const dep = context.dependencies.find(
        d => pattern.indicators.dependencies?.some(
          pd => d.name.toLowerCase() === pd.toLowerCase()
        )
      );
      
      detected.push({
        repositoryId,
        name: pattern.name,
        category: pattern.category,
        version: dep?.version || null,
        confidence: Math.min(confidence, 1),
        detectedIn,
      });
    }
  }
  
  return detected;
}

/**
 * Detect datastores used in the repository
 */
export function detectDatastores(
  context: DetectionContext,
  repositoryId: number
): Omit<Datastore, 'id' | 'createdAt'>[] {
  const detected: Omit<Datastore, 'id' | 'createdAt'>[] = [];
  const depNames = new Set(context.dependencies.map(d => d.name.toLowerCase()));
  
  for (const pattern of DATASTORE_PATTERNS) {
    const usedIn: string[] = [];
    let found = false;
    
    // Check dependencies
    if (pattern.indicators.dependencies) {
      for (const dep of pattern.indicators.dependencies) {
        if (depNames.has(dep.toLowerCase())) {
          usedIn.push(`dependency:${dep}`);
          found = true;
          break;
        }
      }
    }
    
    // Check content patterns
    if (pattern.indicators.content) {
      for (const file of context.files) {
        if (!file.content) continue;
        for (const contentPattern of pattern.indicators.content) {
          if (contentPattern.test(file.content)) {
            usedIn.push(`file:${file.path}`);
            found = true;
            break;
          }
        }
      }
    }
    
    // Check env var patterns
    if (pattern.indicators.envVars) {
      for (const file of context.files) {
        if (!file.content) continue;
        if (!file.path.includes('.env') && !file.path.includes('config')) continue;
        for (const envPattern of pattern.indicators.envVars) {
          if (envPattern.test(file.content)) {
            usedIn.push(`env:${file.path}`);
            found = true;
            break;
          }
        }
      }
    }
    
    if (found) {
      detected.push({
        repositoryId,
        name: pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1),
        type: pattern.type,
        connectionString: null,
        usedIn,
      });
    }
  }
  
  return detected;
}

/**
 * Detect message queues used in the repository
 */
export function detectQueues(
  context: DetectionContext,
  repositoryId: number
): Omit<Queue, 'id' | 'createdAt'>[] {
  const detected: Omit<Queue, 'id' | 'createdAt'>[] = [];
  const depNames = new Set(context.dependencies.map(d => d.name.toLowerCase()));
  
  for (const pattern of QUEUE_PATTERNS) {
    const producers: string[] = [];
    const consumers: string[] = [];
    let found = false;
    
    // Check dependencies
    if (pattern.indicators.dependencies) {
      for (const dep of pattern.indicators.dependencies) {
        if (depNames.has(dep.toLowerCase())) {
          found = true;
          break;
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
            // Detect if producer or consumer
            if (/\.publish\(|\.send\(|producer/i.test(file.content)) {
              producers.push(file.path);
            }
            if (/\.subscribe\(|\.consume\(|consumer/i.test(file.content)) {
              consumers.push(file.path);
            }
            break;
          }
        }
      }
    }
    
    if (found) {
      detected.push({
        repositoryId,
        name: pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1).replace(/_/g, ' '),
        type: pattern.type,
        topics: [],
        producers,
        consumers,
      });
    }
  }
  
  return detected;
}

/**
 * Extract languages from file extensions
 */
export function detectLanguages(
  files: RepoFile[],
  repositoryId: number
): Omit<Technology, 'id' | 'createdAt'>[] {
  const languageCounts: Record<string, number> = {};
  
  const extensionToLanguage: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    kt: 'Kotlin',
    swift: 'Swift',
    rb: 'Ruby',
    php: 'PHP',
    cs: 'C#',
    cpp: 'C++',
    c: 'C',
    scala: 'Scala',
    clj: 'Clojure',
    ex: 'Elixir',
    erl: 'Erlang',
    hs: 'Haskell',
  };
  
  for (const file of files) {
    const ext = file.extension?.toLowerCase();
    if (ext && extensionToLanguage[ext]) {
      const lang = extensionToLanguage[ext];
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    }
  }
  
  const totalFiles = Object.values(languageCounts).reduce((a, b) => a + b, 0);
  
  return Object.entries(languageCounts).map(([lang, count]) => ({
    repositoryId,
    name: lang,
    category: 'language' as TechnologyCategory,
    version: null,
    confidence: count / totalFiles,
    detectedIn: [`${count} files`],
  }));
}
