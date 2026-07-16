/**
 * Architecture Database Operations
 * 
 * CRUD operations for the Repository Digital Twin data model.
 */

import { query, execute } from './index';
import type {
  ArchitectureNode,
  ArchitectureNodeType,
  ArchitectureEdge,
  ArchitectureEdgeType,
  Service,
  ServiceType,
  Layer,
  LayerType,
  Module,
  EntryPoint,
  EntryPointType,
  ApiEndpoint,
  HttpMethod,
  Technology,
  TechnologyCategory,
  Datastore,
  DatastoreType,
  Queue,
  QueueType,
  ExecutionPath,
  ExecutionStep,
  RuntimeComponent,
  Configuration,
  ConfigurationType,
  ArchitectureSummary,
  ApiParameter,
} from '../types/architecture';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseRow = Record<string, any>;

// ============================================================================
// Architecture Node Operations
// ============================================================================

export async function createArchitectureNode(
  node: Omit<ArchitectureNode, 'id' | 'createdAt'>
): Promise<ArchitectureNode> {
  const result = await query(
    `INSERT INTO architecture_nodes 
     (repository_id, type, name, description, file_path, start_line, end_line, parent_node_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      node.repositoryId,
      node.type,
      node.name,
      node.description,
      node.filePath,
      node.startLine,
      node.endLine,
      node.parentNodeId,
      JSON.stringify(node.metadata),
    ]
  );
  return mapArchitectureNode(result[0]);
}

export async function getArchitectureNodesByRepository(
  repositoryId: number
): Promise<ArchitectureNode[]> {
  const result = await query(
    'SELECT * FROM architecture_nodes WHERE repository_id = $1 ORDER BY type, name',
    [repositoryId]
  );
  return result.map(mapArchitectureNode);
}

export async function getArchitectureNodesByType(
  repositoryId: number,
  type: ArchitectureNodeType
): Promise<ArchitectureNode[]> {
  const result = await query(
    'SELECT * FROM architecture_nodes WHERE repository_id = $1 AND type = $2 ORDER BY name',
    [repositoryId, type]
  );
  return result.map(mapArchitectureNode);
}

export async function getArchitectureNode(id: number): Promise<ArchitectureNode | null> {
  const result = await query('SELECT * FROM architecture_nodes WHERE id = $1', [id]);
  return result.length > 0 ? mapArchitectureNode(result[0]) : null;
}

export async function deleteArchitectureNodesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM architecture_nodes WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Architecture Edge Operations
// ============================================================================

export async function createArchitectureEdge(
  edge: Omit<ArchitectureEdge, 'id' | 'createdAt'>
): Promise<ArchitectureEdge> {
  const result = await query(
    `INSERT INTO architecture_edges 
     (repository_id, source_node_id, target_node_id, type, weight, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      edge.repositoryId,
      edge.sourceNodeId,
      edge.targetNodeId,
      edge.type,
      edge.weight,
      JSON.stringify(edge.metadata),
    ]
  );
  return mapArchitectureEdge(result[0]);
}

export async function getArchitectureEdgesByRepository(
  repositoryId: number
): Promise<ArchitectureEdge[]> {
  const result = await query(
    'SELECT * FROM architecture_edges WHERE repository_id = $1 ORDER BY type',
    [repositoryId]
  );
  return result.map(mapArchitectureEdge);
}

export async function getArchitectureEdgesByType(
  repositoryId: number,
  type: ArchitectureEdgeType
): Promise<ArchitectureEdge[]> {
  const result = await query(
    'SELECT * FROM architecture_edges WHERE repository_id = $1 AND type = $2',
    [repositoryId, type]
  );
  return result.map(mapArchitectureEdge);
}

export async function getArchitectureEdgesFromNode(
  nodeId: number
): Promise<ArchitectureEdge[]> {
  const result = await query(
    'SELECT * FROM architecture_edges WHERE source_node_id = $1',
    [nodeId]
  );
  return result.map(mapArchitectureEdge);
}

export async function getArchitectureEdgesToNode(
  nodeId: number
): Promise<ArchitectureEdge[]> {
  const result = await query(
    'SELECT * FROM architecture_edges WHERE target_node_id = $1',
    [nodeId]
  );
  return result.map(mapArchitectureEdge);
}

export async function deleteArchitectureEdgesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM architecture_edges WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Service Operations
// ============================================================================

export async function createService(
  service: Omit<Service, 'id' | 'createdAt'>
): Promise<Service> {
  const result = await query(
    `INSERT INTO services 
     (repository_id, name, type, entry_point, port, description, technologies, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (repository_id, name) DO UPDATE SET
       type = EXCLUDED.type,
       entry_point = EXCLUDED.entry_point,
       port = EXCLUDED.port,
       description = EXCLUDED.description,
       technologies = EXCLUDED.technologies,
       metadata = EXCLUDED.metadata
     RETURNING *`,
    [
      service.repositoryId,
      service.name,
      service.type,
      service.entryPoint,
      service.port,
      service.description,
      service.technologies,
      JSON.stringify(service.metadata),
    ]
  );
  return mapService(result[0]);
}

export async function getServicesByRepository(repositoryId: number): Promise<Service[]> {
  const result = await query(
    'SELECT * FROM services WHERE repository_id = $1 ORDER BY name',
    [repositoryId]
  );
  return result.map(mapService);
}

export async function getServicesByType(
  repositoryId: number,
  type: ServiceType
): Promise<Service[]> {
  const result = await query(
    'SELECT * FROM services WHERE repository_id = $1 AND type = $2 ORDER BY name',
    [repositoryId, type]
  );
  return result.map(mapService);
}

export async function deleteServicesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM services WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Layer Operations
// ============================================================================

export async function createLayer(
  layer: Omit<Layer, 'id' | 'createdAt'>
): Promise<Layer> {
  const result = await query(
    `INSERT INTO layers 
     (repository_id, name, type, layer_order, patterns, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repository_id, name) DO UPDATE SET
       type = EXCLUDED.type,
       layer_order = EXCLUDED.layer_order,
       patterns = EXCLUDED.patterns,
       description = EXCLUDED.description
     RETURNING *`,
    [
      layer.repositoryId,
      layer.name,
      layer.type,
      layer.order,
      layer.patterns,
      layer.description,
    ]
  );
  return mapLayer(result[0]);
}

export async function getLayersByRepository(repositoryId: number): Promise<Layer[]> {
  const result = await query(
    'SELECT * FROM layers WHERE repository_id = $1 ORDER BY layer_order',
    [repositoryId]
  );
  return result.map(mapLayer);
}

export async function deleteLayersByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM layers WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Module Operations
// ============================================================================

export async function createModule(
  module: Omit<Module, 'id' | 'createdAt'>
): Promise<Module> {
  const result = await query(
    `INSERT INTO modules 
     (repository_id, name, path, type, is_entry_point, exports, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (repository_id, path) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       is_entry_point = EXCLUDED.is_entry_point,
       exports = EXCLUDED.exports,
       description = EXCLUDED.description
     RETURNING *`,
    [
      module.repositoryId,
      module.name,
      module.path,
      module.type,
      module.isEntryPoint,
      module.exports,
      module.description,
    ]
  );
  return mapModule(result[0]);
}

export async function getModulesByRepository(repositoryId: number): Promise<Module[]> {
  const result = await query(
    'SELECT * FROM modules WHERE repository_id = $1 ORDER BY path',
    [repositoryId]
  );
  return result.map(mapModule);
}

export async function deleteModulesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM modules WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Entry Point Operations
// ============================================================================

export async function createEntryPoint(
  entryPoint: Omit<EntryPoint, 'id' | 'createdAt'>
): Promise<EntryPoint> {
  const result = await query(
    `INSERT INTO entry_points 
     (repository_id, name, type, file_path, function_name, http_method, route_path, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      entryPoint.repositoryId,
      entryPoint.name,
      entryPoint.type,
      entryPoint.filePath,
      entryPoint.functionName,
      entryPoint.httpMethod,
      entryPoint.routePath,
      entryPoint.description,
    ]
  );
  return mapEntryPoint(result[0]);
}

export async function getEntryPointsByRepository(repositoryId: number): Promise<EntryPoint[]> {
  const result = await query(
    'SELECT * FROM entry_points WHERE repository_id = $1 ORDER BY type, name',
    [repositoryId]
  );
  return result.map(mapEntryPoint);
}

export async function getEntryPointsByType(
  repositoryId: number,
  type: EntryPointType
): Promise<EntryPoint[]> {
  const result = await query(
    'SELECT * FROM entry_points WHERE repository_id = $1 AND type = $2 ORDER BY name',
    [repositoryId, type]
  );
  return result.map(mapEntryPoint);
}

export async function deleteEntryPointsByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM entry_points WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// API Endpoint Operations
// ============================================================================

export async function createApiEndpoint(
  endpoint: Omit<ApiEndpoint, 'id' | 'createdAt'>
): Promise<ApiEndpoint> {
  const result = await query(
    `INSERT INTO api_endpoints 
     (repository_id, service_id, path, method, handler_file, handler_function, parameters, response_type, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      endpoint.repositoryId,
      endpoint.serviceId,
      endpoint.path,
      endpoint.method,
      endpoint.handlerFile,
      endpoint.handlerFunction,
      JSON.stringify(endpoint.parameters),
      endpoint.responseType,
      endpoint.description,
    ]
  );
  return mapApiEndpoint(result[0]);
}

export async function getApiEndpointsByRepository(repositoryId: number): Promise<ApiEndpoint[]> {
  const result = await query(
    'SELECT * FROM api_endpoints WHERE repository_id = $1 ORDER BY path, method',
    [repositoryId]
  );
  return result.map(mapApiEndpoint);
}

export async function getApiEndpointsByService(serviceId: number): Promise<ApiEndpoint[]> {
  const result = await query(
    'SELECT * FROM api_endpoints WHERE service_id = $1 ORDER BY path, method',
    [serviceId]
  );
  return result.map(mapApiEndpoint);
}

export async function deleteApiEndpointsByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM api_endpoints WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Technology Operations
// ============================================================================

export async function createTechnology(
  technology: Omit<Technology, 'id' | 'createdAt'>
): Promise<Technology> {
  const result = await query(
    `INSERT INTO technologies 
     (repository_id, name, category, version, confidence, detected_in)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repository_id, name, category) DO UPDATE SET
       version = EXCLUDED.version,
       confidence = EXCLUDED.confidence,
       detected_in = EXCLUDED.detected_in
     RETURNING *`,
    [
      technology.repositoryId,
      technology.name,
      technology.category,
      technology.version,
      technology.confidence,
      technology.detectedIn,
    ]
  );
  return mapTechnology(result[0]);
}

export async function getTechnologiesByRepository(repositoryId: number): Promise<Technology[]> {
  const result = await query(
    'SELECT * FROM technologies WHERE repository_id = $1 ORDER BY category, name',
    [repositoryId]
  );
  return result.map(mapTechnology);
}

export async function getTechnologiesByCategory(
  repositoryId: number,
  category: TechnologyCategory
): Promise<Technology[]> {
  const result = await query(
    'SELECT * FROM technologies WHERE repository_id = $1 AND category = $2 ORDER BY name',
    [repositoryId, category]
  );
  return result.map(mapTechnology);
}

export async function deleteTechnologiesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM technologies WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Datastore Operations
// ============================================================================

export async function createDatastore(
  datastore: Omit<Datastore, 'id' | 'createdAt'>
): Promise<Datastore> {
  const result = await query(
    `INSERT INTO datastores 
     (repository_id, name, type, connection_string, used_in)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repository_id, name) DO UPDATE SET
       type = EXCLUDED.type,
       connection_string = EXCLUDED.connection_string,
       used_in = EXCLUDED.used_in
     RETURNING *`,
    [
      datastore.repositoryId,
      datastore.name,
      datastore.type,
      datastore.connectionString,
      datastore.usedIn,
    ]
  );
  return mapDatastore(result[0]);
}

export async function getDatastoresByRepository(repositoryId: number): Promise<Datastore[]> {
  const result = await query(
    'SELECT * FROM datastores WHERE repository_id = $1 ORDER BY type, name',
    [repositoryId]
  );
  return result.map(mapDatastore);
}

export async function deleteDatastoresByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM datastores WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Queue Operations
// ============================================================================

export async function createQueue(
  queue: Omit<Queue, 'id' | 'createdAt'>
): Promise<Queue> {
  const result = await query(
    `INSERT INTO queues 
     (repository_id, name, type, topics, producers, consumers)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repository_id, name) DO UPDATE SET
       type = EXCLUDED.type,
       topics = EXCLUDED.topics,
       producers = EXCLUDED.producers,
       consumers = EXCLUDED.consumers
     RETURNING *`,
    [
      queue.repositoryId,
      queue.name,
      queue.type,
      queue.topics,
      queue.producers,
      queue.consumers,
    ]
  );
  return mapQueue(result[0]);
}

export async function getQueuesByRepository(repositoryId: number): Promise<Queue[]> {
  const result = await query(
    'SELECT * FROM queues WHERE repository_id = $1 ORDER BY type, name',
    [repositoryId]
  );
  return result.map(mapQueue);
}

export async function deleteQueuesByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM queues WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Execution Path Operations
// ============================================================================

export async function createExecutionPath(
  path: Omit<ExecutionPath, 'id' | 'createdAt'>
): Promise<ExecutionPath> {
  const result = await query(
    `INSERT INTO execution_paths 
     (repository_id, name, trigger, steps, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      path.repositoryId,
      path.name,
      path.trigger,
      JSON.stringify(path.steps),
      path.description,
    ]
  );
  return mapExecutionPath(result[0]);
}

export async function getExecutionPathsByRepository(repositoryId: number): Promise<ExecutionPath[]> {
  const result = await query(
    'SELECT * FROM execution_paths WHERE repository_id = $1 ORDER BY name',
    [repositoryId]
  );
  return result.map(mapExecutionPath);
}

export async function deleteExecutionPathsByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM execution_paths WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Runtime Component Operations
// ============================================================================

export async function createRuntimeComponent(
  component: Omit<RuntimeComponent, 'id' | 'createdAt'>
): Promise<RuntimeComponent> {
  const result = await query(
    `INSERT INTO runtime_components 
     (repository_id, name, type, image, ports, environment, dependencies)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (repository_id, name) DO UPDATE SET
       type = EXCLUDED.type,
       image = EXCLUDED.image,
       ports = EXCLUDED.ports,
       environment = EXCLUDED.environment,
       dependencies = EXCLUDED.dependencies
     RETURNING *`,
    [
      component.repositoryId,
      component.name,
      component.type,
      component.image,
      component.ports,
      JSON.stringify(component.environment),
      component.dependencies,
    ]
  );
  return mapRuntimeComponent(result[0]);
}

export async function getRuntimeComponentsByRepository(repositoryId: number): Promise<RuntimeComponent[]> {
  const result = await query(
    'SELECT * FROM runtime_components WHERE repository_id = $1 ORDER BY name',
    [repositoryId]
  );
  return result.map(mapRuntimeComponent);
}

export async function deleteRuntimeComponentsByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM runtime_components WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Configuration Operations
// ============================================================================

export async function createConfiguration(
  config: Omit<Configuration, 'id' | 'createdAt'>
): Promise<Configuration> {
  const result = await query(
    `INSERT INTO configuration 
     (repository_id, key, type, source, default_value, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repository_id, key, source) DO UPDATE SET
       type = EXCLUDED.type,
       default_value = EXCLUDED.default_value,
       description = EXCLUDED.description
     RETURNING *`,
    [
      config.repositoryId,
      config.key,
      config.type,
      config.source,
      config.defaultValue,
      config.description,
    ]
  );
  return mapConfiguration(result[0]);
}

export async function getConfigurationByRepository(repositoryId: number): Promise<Configuration[]> {
  const result = await query(
    'SELECT * FROM configuration WHERE repository_id = $1 ORDER BY type, key',
    [repositoryId]
  );
  return result.map(mapConfiguration);
}

export async function getConfigurationByType(
  repositoryId: number,
  type: ConfigurationType
): Promise<Configuration[]> {
  const result = await query(
    'SELECT * FROM configuration WHERE repository_id = $1 AND type = $2 ORDER BY key',
    [repositoryId, type]
  );
  return result.map(mapConfiguration);
}

export async function deleteConfigurationByRepository(repositoryId: number): Promise<void> {
  await execute('DELETE FROM configuration WHERE repository_id = $1', [repositoryId]);
}

// ============================================================================
// Architecture Summary Operations
// ============================================================================

export async function saveArchitectureSummary(
  repositoryId: number,
  summary: ArchitectureSummary
): Promise<void> {
  await execute(
    `INSERT INTO architecture_summaries (repository_id, summary, analyzed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (repository_id) DO UPDATE SET
       summary = EXCLUDED.summary,
       analyzed_at = NOW()`,
    [repositoryId, JSON.stringify(summary)]
  );
}

export async function getArchitectureSummary(
  repositoryId: number
): Promise<ArchitectureSummary | null> {
  const result = await query(
    'SELECT * FROM architecture_summaries WHERE repository_id = $1',
    [repositoryId]
  );
  if (result.length === 0) return null;
  return result[0].summary as ArchitectureSummary;
}

// ============================================================================
// Clear All Architecture Data
// ============================================================================

export async function clearArchitectureData(repositoryId: number): Promise<void> {
  // Delete in correct order to avoid FK constraint violations
  await deleteExecutionPathsByRepository(repositoryId);
  await deleteApiEndpointsByRepository(repositoryId);
  await deleteArchitectureEdgesByRepository(repositoryId);
  await deleteArchitectureNodesByRepository(repositoryId);
  await deleteServicesByRepository(repositoryId);
  await deleteLayersByRepository(repositoryId);
  await deleteModulesByRepository(repositoryId);
  await deleteEntryPointsByRepository(repositoryId);
  await deleteTechnologiesByRepository(repositoryId);
  await deleteDatastoresByRepository(repositoryId);
  await deleteQueuesByRepository(repositoryId);
  await deleteRuntimeComponentsByRepository(repositoryId);
  await deleteConfigurationByRepository(repositoryId);
}

// ============================================================================
// Mappers
// ============================================================================

function mapArchitectureNode(row: DatabaseRow): ArchitectureNode {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    type: row.type as ArchitectureNodeType,
    name: row.name as string,
    description: row.description as string | null,
    filePath: row.file_path as string | null,
    startLine: row.start_line as number | null,
    endLine: row.end_line as number | null,
    parentNodeId: row.parent_node_id as number | null,
    metadata: (row.metadata || {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  };
}

function mapArchitectureEdge(row: DatabaseRow): ArchitectureEdge {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    sourceNodeId: row.source_node_id as number,
    targetNodeId: row.target_node_id as number,
    type: row.type as ArchitectureEdgeType,
    weight: row.weight as number,
    metadata: (row.metadata || {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  };
}

function mapService(row: DatabaseRow): Service {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    type: row.type as ServiceType,
    entryPoint: row.entry_point as string | null,
    port: row.port as number | null,
    description: row.description as string | null,
    technologies: (row.technologies || []) as string[],
    metadata: (row.metadata || {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  };
}

function mapLayer(row: DatabaseRow): Layer {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    type: row.type as LayerType,
    order: row.layer_order as number,
    patterns: (row.patterns || []) as string[],
    description: row.description as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapModule(row: DatabaseRow): Module {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    path: row.path as string,
    type: row.type as Module['type'],
    isEntryPoint: row.is_entry_point as boolean,
    exports: (row.exports || []) as string[],
    description: row.description as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapEntryPoint(row: DatabaseRow): EntryPoint {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    type: row.type as EntryPointType,
    filePath: row.file_path as string,
    functionName: row.function_name as string | null,
    httpMethod: row.http_method as string | null,
    routePath: row.route_path as string | null,
    description: row.description as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapApiEndpoint(row: DatabaseRow): ApiEndpoint {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    serviceId: row.service_id as number | null,
    path: row.path as string,
    method: row.method as HttpMethod,
    handlerFile: row.handler_file as string,
    handlerFunction: row.handler_function as string | null,
    parameters: (row.parameters || []) as ApiParameter[],
    responseType: row.response_type as string | null,
    description: row.description as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapTechnology(row: DatabaseRow): Technology {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    category: row.category as TechnologyCategory,
    version: row.version as string | null,
    confidence: row.confidence as number,
    detectedIn: (row.detected_in || []) as string[],
    createdAt: new Date(row.created_at as string),
  };
}

function mapDatastore(row: DatabaseRow): Datastore {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    type: row.type as DatastoreType,
    connectionString: row.connection_string as string | null,
    usedIn: (row.used_in || []) as string[],
    createdAt: new Date(row.created_at as string),
  };
}

function mapQueue(row: DatabaseRow): Queue {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    type: row.type as QueueType,
    topics: (row.topics || []) as string[],
    producers: (row.producers || []) as string[],
    consumers: (row.consumers || []) as string[],
    createdAt: new Date(row.created_at as string),
  };
}

function mapExecutionPath(row: DatabaseRow): ExecutionPath {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    trigger: row.trigger as string,
    steps: (row.steps || []) as ExecutionStep[],
    description: row.description as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapRuntimeComponent(row: DatabaseRow): RuntimeComponent {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    name: row.name as string,
    type: row.type as string,
    image: row.image as string | null,
    ports: (row.ports || []) as number[],
    environment: (row.environment || {}) as Record<string, string>,
    dependencies: (row.dependencies || []) as string[],
    createdAt: new Date(row.created_at as string),
  };
}

function mapConfiguration(row: DatabaseRow): Configuration {
  return {
    id: row.id as number,
    repositoryId: row.repository_id as number,
    key: row.key as string,
    type: row.type as ConfigurationType,
    source: row.source as string,
    defaultValue: row.default_value as string | null,
    description: row.description as string | null,
    createdAt: new Date(row.created_at as string),
  };
}
