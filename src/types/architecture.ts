/**
 * Architecture Intelligence Types
 * 
 * These types represent the Repository Digital Twin - a structured graph
 * of software concepts that enables architecture understanding.
 */

// ============================================================================
// Architecture Node Types
// ============================================================================

/** Base interface for all architecture nodes */
export interface ArchitectureNodeBase {
  id: number;
  repositoryId: number;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** Types of architecture nodes in the Digital Twin */
export type ArchitectureNodeType =
  | 'repository'
  | 'directory'
  | 'module'
  | 'package'
  | 'class'
  | 'function'
  | 'interface'
  | 'api_endpoint'
  | 'database'
  | 'queue'
  | 'service'
  | 'worker'
  | 'cron'
  | 'configuration'
  | 'environment_variable'
  | 'secret_reference'
  | 'dependency'
  | 'test'
  | 'infrastructure_resource'
  | 'container'
  | 'deployment'
  | 'documentation'
  | 'layer'
  | 'bounded_context';

/** Architecture node representing a software concept */
export interface ArchitectureNode extends ArchitectureNodeBase {
  type: ArchitectureNodeType;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  parentNodeId: number | null;
}

// ============================================================================
// Architecture Edge Types
// ============================================================================

/** Types of relationships between architecture nodes */
export type ArchitectureEdgeType =
  | 'calls'
  | 'imports'
  | 'implements'
  | 'extends'
  | 'depends_on'
  | 'reads'
  | 'writes'
  | 'listens_to'
  | 'publishes'
  | 'routes_to'
  | 'uses_database'
  | 'uses_queue'
  | 'exposes_endpoint'
  | 'configures'
  | 'deploys'
  | 'generates'
  | 'tests'
  | 'contains'
  | 'belongs_to_layer'
  | 'belongs_to_context';

/** Edge connecting two architecture nodes */
export interface ArchitectureEdge {
  id: number;
  repositoryId: number;
  sourceNodeId: number;
  targetNodeId: number;
  type: ArchitectureEdgeType;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Service Types
// ============================================================================

/** Types of services that can be detected */
export type ServiceType =
  | 'rest_api'
  | 'graphql'
  | 'grpc'
  | 'websocket'
  | 'worker'
  | 'cli'
  | 'library'
  | 'shared_package'
  | 'microservice'
  | 'monolith'
  | 'serverless_function'
  | 'cron_job'
  | 'message_consumer'
  | 'message_producer';

/** A detected service in the repository */
export interface Service {
  id: number;
  repositoryId: number;
  name: string;
  type: ServiceType;
  entryPoint: string | null;
  port: number | null;
  description: string | null;
  technologies: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Layer Types
// ============================================================================

/** Standard architectural layers */
export type LayerType =
  | 'presentation'
  | 'api'
  | 'application'
  | 'domain'
  | 'infrastructure'
  | 'database'
  | 'external'
  | 'shared'
  | 'config'
  | 'test';

/** An architectural layer in the repository */
export interface Layer {
  id: number;
  repositoryId: number;
  name: string;
  type: LayerType;
  order: number;
  patterns: string[];
  description: string | null;
  createdAt: Date;
}

// ============================================================================
// Module/Package Types
// ============================================================================

/** A module or package in the repository */
export interface Module {
  id: number;
  repositoryId: number;
  name: string;
  path: string;
  type: 'module' | 'package' | 'namespace' | 'workspace';
  isEntryPoint: boolean;
  exports: string[];
  description: string | null;
  createdAt: Date;
}

// ============================================================================
// Entry Point Types
// ============================================================================

/** Types of entry points */
export type EntryPointType =
  | 'main'
  | 'route'
  | 'handler'
  | 'controller'
  | 'lambda'
  | 'cli_command'
  | 'cron'
  | 'event_listener'
  | 'docker_entrypoint'
  | 'test_suite';

/** An entry point into the application */
export interface EntryPoint {
  id: number;
  repositoryId: number;
  name: string;
  type: EntryPointType;
  filePath: string;
  functionName: string | null;
  httpMethod: string | null;
  routePath: string | null;
  description: string | null;
  createdAt: Date;
}

// ============================================================================
// API Endpoint Types
// ============================================================================

/** HTTP methods for API endpoints */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** An API endpoint exposed by the service */
export interface ApiEndpoint {
  id: number;
  repositoryId: number;
  serviceId: number | null;
  path: string;
  method: HttpMethod;
  handlerFile: string;
  handlerFunction: string | null;
  parameters: ApiParameter[];
  responseType: string | null;
  description: string | null;
  createdAt: Date;
}

/** A parameter for an API endpoint */
export interface ApiParameter {
  name: string;
  type: string;
  location: 'path' | 'query' | 'body' | 'header';
  required: boolean;
}

// ============================================================================
// Technology & Framework Types
// ============================================================================

/** Categories of technologies */
export type TechnologyCategory =
  | 'language'
  | 'framework'
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'container'
  | 'orchestration'
  | 'ci_cd'
  | 'monitoring'
  | 'logging'
  | 'testing'
  | 'build_tool'
  | 'external_api';

/** A technology detected in the repository */
export interface Technology {
  id: number;
  repositoryId: number;
  name: string;
  category: TechnologyCategory;
  version: string | null;
  confidence: number;
  detectedIn: string[];
  createdAt: Date;
}

// ============================================================================
// Datastore Types
// ============================================================================

/** Types of datastores */
export type DatastoreType =
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'redis'
  | 'elasticsearch'
  | 'dynamodb'
  | 's3'
  | 'sqlite'
  | 'cassandra'
  | 'neo4j'
  | 'firestore'
  | 'unknown';

/** A datastore used by the repository */
export interface Datastore {
  id: number;
  repositoryId: number;
  name: string;
  type: DatastoreType;
  connectionString: string | null;
  usedIn: string[];
  createdAt: Date;
}

// ============================================================================
// Queue Types
// ============================================================================

/** Types of message queues */
export type QueueType =
  | 'kafka'
  | 'rabbitmq'
  | 'sqs'
  | 'redis_pubsub'
  | 'bull'
  | 'celery'
  | 'nats'
  | 'pulsar'
  | 'unknown';

/** A message queue used by the repository */
export interface Queue {
  id: number;
  repositoryId: number;
  name: string;
  type: QueueType;
  topics: string[];
  producers: string[];
  consumers: string[];
  createdAt: Date;
}

// ============================================================================
// Execution Path Types
// ============================================================================

/** A step in an execution path */
export interface ExecutionStep {
  nodeId: number;
  nodeName: string;
  nodeType: ArchitectureNodeType;
  filePath: string | null;
  order: number;
}

/** An execution path through the system */
export interface ExecutionPath {
  id: number;
  repositoryId: number;
  name: string;
  trigger: string;
  steps: ExecutionStep[];
  description: string | null;
  createdAt: Date;
}

// ============================================================================
// Runtime Component Types
// ============================================================================

/** A runtime component in the system */
export interface RuntimeComponent {
  id: number;
  repositoryId: number;
  name: string;
  type: string;
  image: string | null;
  ports: number[];
  environment: Record<string, string>;
  dependencies: string[];
  createdAt: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Types of configuration */
export type ConfigurationType =
  | 'environment'
  | 'secrets'
  | 'feature_flags'
  | 'database'
  | 'logging'
  | 'cache'
  | 'external_service'
  | 'build'
  | 'deployment';

/** A configuration entry */
export interface Configuration {
  id: number;
  repositoryId: number;
  key: string;
  type: ConfigurationType;
  source: string;
  defaultValue: string | null;
  description: string | null;
  createdAt: Date;
}

// ============================================================================
// Architecture Summary Types
// ============================================================================

/** Overall architecture summary for a repository */
export interface ArchitectureSummary {
  repositoryId: number;
  repositoryName: string;
  
  // Technology stack
  languages: string[];
  frameworks: string[];
  databases: DatastoreType[];
  queues: QueueType[];
  
  // Structure
  serviceCount: number;
  moduleCount: number;
  layerCount: number;
  entryPointCount: number;
  apiEndpointCount: number;
  
  // Architecture style
  architectureStyle: 'monolith' | 'modular_monolith' | 'microservices' | 'serverless' | 'hybrid';
  
  // Layers
  layers: Layer[];
  
  // Key services
  services: Service[];
  
  // Generated diagrams
  diagrams: DiagramReference[];
  
  // Analysis timestamp
  analyzedAt: Date;
}

/** Reference to a generated diagram */
export interface DiagramReference {
  type: DiagramType;
  title: string;
  content: string;
  format: 'mermaid' | 'plantuml' | 'ascii';
}

/** Types of diagrams that can be generated */
export type DiagramType =
  | 'component'
  | 'dependency'
  | 'call_graph'
  | 'data_flow'
  | 'sequence'
  | 'service_map'
  | 'package_graph'
  | 'layer'
  | 'class'
  | 'entity_relationship';

// ============================================================================
// Architecture Query Types
// ============================================================================

/** Intent types for architecture queries */
export type QueryIntent =
  | 'explain_architecture'
  | 'draw_diagram'
  | 'trace_request'
  | 'show_dependencies'
  | 'explain_service'
  | 'impact_analysis'
  | 'find_entry_points'
  | 'list_technologies'
  | 'show_data_flow'
  | 'explain_layer'
  | 'general';

/** Result of intent detection */
export interface IntentDetectionResult {
  intent: QueryIntent;
  confidence: number;
  entities: Record<string, string>;
  suggestedQueries: string[];
}

/** Architecture query result */
export interface ArchitectureQueryResult {
  intent: QueryIntent;
  answer: string;
  diagram: DiagramReference | null;
  relatedNodes: ArchitectureNode[];
  relatedEdges: ArchitectureEdge[];
  sources: ArchitectureSource[];
  sqlUsed: string | null;
}

/** Source reference for architecture queries */
export interface ArchitectureSource {
  type: 'node' | 'edge' | 'service' | 'layer' | 'file';
  id: number;
  name: string;
  path: string | null;
}
