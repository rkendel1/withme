import { useEffect, useState, useCallback } from 'react';
import {
  Layers,
  Server,
  Database,
  Globe,
  Terminal,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Cpu,
  GitBranch,
  FileCode,
  Loader2,
  Box,
  Network,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';
import {
  getArchitectureSummary,
  getServicesByRepository,
  getLayersByRepository,
  getEntryPointsByRepository,
  getApiEndpointsByRepository,
  getTechnologiesByRepository,
  getDatastoresByRepository,
  getQueuesByRepository,
} from '../db/architecture';
import { analyzeArchitecture, type AnalysisProgress } from '../services/architecture';
import type {
  ArchitectureSummary,
  Service,
  Layer,
  EntryPoint,
  ApiEndpoint,
  Technology,
  Datastore,
  Queue,
  DiagramReference,
} from '../types/architecture';

type SectionId = 'overview' | 'services' | 'layers' | 'entry_points' | 'api_endpoints' | 'technologies' | 'datastores' | 'queues' | 'diagrams';

interface ExpandedSections {
  [key: string]: boolean;
}

export function ArchitecturePanel() {
  const { selectedRepository } = useStore();
  const [summary, setSummary] = useState<ArchitectureSummary | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([]);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramReference[]>([]);
  
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    overview: true,
    services: false,
    layers: false,
    entry_points: false,
    api_endpoints: false,
    technologies: true,
    datastores: false,
    queues: false,
    diagrams: false,
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load architecture data
  const loadArchitectureData = useCallback(async () => {
    if (!selectedRepository) return;

    try {
      setError(null);
      const [
        summaryResult,
        servicesResult,
        layersResult,
        entryPointsResult,
        apiEndpointsResult,
        technologiesResult,
        datastoresResult,
        queuesResult,
      ] = await Promise.all([
        getArchitectureSummary(selectedRepository.id),
        getServicesByRepository(selectedRepository.id),
        getLayersByRepository(selectedRepository.id),
        getEntryPointsByRepository(selectedRepository.id),
        getApiEndpointsByRepository(selectedRepository.id),
        getTechnologiesByRepository(selectedRepository.id),
        getDatastoresByRepository(selectedRepository.id),
        getQueuesByRepository(selectedRepository.id),
      ]);

      setSummary(summaryResult);
      setServices(servicesResult);
      setLayers(layersResult);
      setEntryPoints(entryPointsResult);
      setApiEndpoints(apiEndpointsResult);
      setTechnologies(technologiesResult);
      setDatastores(datastoresResult);
      setQueues(queuesResult);
      // Get diagrams from the summary
      setDiagrams(summaryResult?.diagrams || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load architecture data');
    }
  }, [selectedRepository]);

  useEffect(() => {
    loadArchitectureData();
  }, [loadArchitectureData]);

  // Re-analyze architecture
  const handleReanalyze = async () => {
    if (!selectedRepository || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisProgress(null);
    setError(null);

    try {
      await analyzeArchitecture(selectedRepository, (progress) => {
        setAnalysisProgress(progress);
      });
      await loadArchitectureData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze architecture');
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const toggleSection = (section: SectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!selectedRepository) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a repository to view architecture</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold">Architecture</h2>
          </div>
          <button
            onClick={handleReanalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Re-analyze architecture"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>
        
        {isAnalyzing && analysisProgress && (
          <div className="mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {analysisProgress.message}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-2 text-sm text-red-500">{error}</div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {!summary ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-gray-500 dark:text-gray-400">
              {isAnalyzing ? (
                <Loader2 className="w-8 h-8 mx-auto animate-spin" />
              ) : (
                <>
                  <p className="mb-2">No architecture data available</p>
                  <button
                    onClick={handleReanalyze}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Analyze Now
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Overview Section */}
            <Section
              id="overview"
              title="Overview"
              icon={<Box className="w-4 h-4" />}
              expanded={expandedSections.overview}
              onToggle={() => toggleSection('overview')}
              count={null}
            >
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>
                  <span className="font-medium">Repository: </span>
                  {summary.repositoryName}
                </p>
                {summary.architectureStyle && (
                  <p>
                    <span className="font-medium">Architecture Style: </span>
                    <span className="capitalize">{summary.architectureStyle.replace(/_/g, ' ')}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <p className="text-xs text-gray-500">Services</p>
                    <p className="font-medium">{summary.serviceCount}</p>
                  </div>
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <p className="text-xs text-gray-500">Modules</p>
                    <p className="font-medium">{summary.moduleCount}</p>
                  </div>
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <p className="text-xs text-gray-500">Layers</p>
                    <p className="font-medium">{summary.layerCount}</p>
                  </div>
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <p className="text-xs text-gray-500">Entry Points</p>
                    <p className="font-medium">{summary.entryPointCount}</p>
                  </div>
                </div>
                {summary.languages.length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium">Languages: </span>
                    <span>{summary.languages.join(', ')}</span>
                  </div>
                )}
                {summary.frameworks.length > 0 && (
                  <div>
                    <span className="font-medium">Frameworks: </span>
                    <span>{summary.frameworks.join(', ')}</span>
                  </div>
                )}
              </div>
            </Section>

            {/* Technologies Section */}
            <Section
              id="technologies"
              title="Technologies"
              icon={<Cpu className="w-4 h-4" />}
              expanded={expandedSections.technologies}
              onToggle={() => toggleSection('technologies')}
              count={technologies.length}
            >
              <div className="space-y-1">
                {technologies.length === 0 ? (
                  <p className="text-sm text-gray-500">No technologies detected</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {technologies.map((tech, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        title={tech.version ? `v${tech.version}` : undefined}
                      >
                        {tech.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* Services Section */}
            <Section
              id="services"
              title="Services"
              icon={<Server className="w-4 h-4" />}
              expanded={expandedSections.services}
              onToggle={() => toggleSection('services')}
              count={services.length}
            >
              <div className="space-y-1">
                {services.length === 0 ? (
                  <p className="text-sm text-gray-500">No services detected</p>
                ) : (
                  services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <ServiceIcon type={service.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-gray-500 truncate">{service.description}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Section>

            {/* Layers Section */}
            <Section
              id="layers"
              title="Architecture Layers"
              icon={<Layers className="w-4 h-4" />}
              expanded={expandedSections.layers}
              onToggle={() => toggleSection('layers')}
              count={layers.length}
            >
              <div className="space-y-1">
                {layers.length === 0 ? (
                  <p className="text-sm text-gray-500">No layers detected</p>
                ) : (
                  layers.map((layer, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1 rounded"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getLayerColor(layer.type, index) }}
                      />
                      <span className="text-sm">{layer.name}</span>
                      <span className="text-xs text-gray-500">({layer.type})</span>
                    </div>
                  ))
                )}
              </div>
            </Section>

            {/* Entry Points Section */}
            <Section
              id="entry_points"
              title="Entry Points"
              icon={<Terminal className="w-4 h-4" />}
              expanded={expandedSections.entry_points}
              onToggle={() => toggleSection('entry_points')}
              count={entryPoints.length}
            >
              <div className="space-y-1">
                {entryPoints.length === 0 ? (
                  <p className="text-sm text-gray-500">No entry points detected</p>
                ) : (
                  entryPoints.slice(0, 10).map((ep, index) => (
                    <div
                      key={index}
                      className="p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <p className="text-sm font-medium truncate">{ep.name}</p>
                      <p className="text-xs text-gray-500 truncate">{ep.filePath}</p>
                    </div>
                  ))
                )}
                {entryPoints.length > 10 && (
                  <p className="text-xs text-gray-500 mt-1">
                    +{entryPoints.length - 10} more
                  </p>
                )}
              </div>
            </Section>

            {/* API Endpoints Section */}
            <Section
              id="api_endpoints"
              title="API Endpoints"
              icon={<Globe className="w-4 h-4" />}
              expanded={expandedSections.api_endpoints}
              onToggle={() => toggleSection('api_endpoints')}
              count={apiEndpoints.length}
            >
              <div className="space-y-1">
                {apiEndpoints.length === 0 ? (
                  <p className="text-sm text-gray-500">No API endpoints detected</p>
                ) : (
                  apiEndpoints.slice(0, 10).map((endpoint, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <MethodBadge method={endpoint.method} />
                      <span className="text-sm font-mono truncate">{endpoint.path}</span>
                    </div>
                  ))
                )}
                {apiEndpoints.length > 10 && (
                  <p className="text-xs text-gray-500 mt-1">
                    +{apiEndpoints.length - 10} more
                  </p>
                )}
              </div>
            </Section>

            {/* Datastores Section */}
            <Section
              id="datastores"
              title="Data Stores"
              icon={<Database className="w-4 h-4" />}
              expanded={expandedSections.datastores}
              onToggle={() => toggleSection('datastores')}
              count={datastores.length}
            >
              <div className="space-y-1">
                {datastores.length === 0 ? (
                  <p className="text-sm text-gray-500">No datastores detected</p>
                ) : (
                  datastores.map((ds, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1 rounded"
                    >
                      <Database className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{ds.name}</span>
                      <span className="text-xs px-1 rounded bg-gray-100 dark:bg-gray-700">{ds.type}</span>
                    </div>
                  ))
                )}
              </div>
            </Section>

            {/* Queues Section */}
            <Section
              id="queues"
              title="Message Queues"
              icon={<GitBranch className="w-4 h-4" />}
              expanded={expandedSections.queues}
              onToggle={() => toggleSection('queues')}
              count={queues.length}
            >
              <div className="space-y-1">
                {queues.length === 0 ? (
                  <p className="text-sm text-gray-500">No message queues detected</p>
                ) : (
                  queues.map((queue, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1 rounded"
                    >
                      <GitBranch className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{queue.name}</span>
                      <span className="text-xs px-1 rounded bg-gray-100 dark:bg-gray-700">{queue.type}</span>
                    </div>
                  ))
                )}
              </div>
            </Section>

            {/* Diagrams Section */}
            <Section
              id="diagrams"
              title="Diagrams"
              icon={<Network className="w-4 h-4" />}
              expanded={expandedSections.diagrams}
              onToggle={() => toggleSection('diagrams')}
              count={diagrams.length}
            >
              <div className="space-y-1">
                {diagrams.length === 0 ? (
                  <p className="text-sm text-gray-500">No diagrams available</p>
                ) : (
                  diagrams.map((diagram, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        // Could open a diagram viewer modal here
                        console.log('View diagram:', diagram);
                      }}
                    >
                      <FileCode className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{diagram.title || diagram.type}</span>
                    </div>
                  ))
                )}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

// Section Component
interface SectionProps {
  id: SectionId;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  count: number | null;
  children: React.ReactNode;
}

function Section({ title, icon, expanded, onToggle, count, children }: SectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        {icon}
        <span className="flex-1 font-medium text-sm">{title}</span>
        {count !== null && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
            {count}
          </span>
        )}
      </button>
      {expanded && (
        <div className="p-2 pt-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

// Service Icon Component
function ServiceIcon({ type }: { type: string }) {
  switch (type) {
    case 'rest_api':
      return <Globe className="w-4 h-4 text-green-600" />;
    case 'graphql':
      return <Network className="w-4 h-4 text-pink-600" />;
    case 'worker':
      return <Cpu className="w-4 h-4 text-purple-600" />;
    case 'cli':
      return <Terminal className="w-4 h-4 text-orange-600" />;
    case 'library':
      return <Box className="w-4 h-4 text-blue-600" />;
    case 'microservice':
      return <Server className="w-4 h-4 text-indigo-600" />;
    default:
      return <Server className="w-4 h-4 text-gray-500" />;
  }
}

// Method Badge Component
function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${colors[method.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}>
      {method.toUpperCase()}
    </span>
  );
}

// Helper function to get layer color
function getLayerColor(type: string, index: number): string {
  const colors: Record<string, string> = {
    presentation: '#3B82F6', // blue
    api: '#10B981', // green
    application: '#8B5CF6', // purple
    domain: '#F59E0B', // amber
    infrastructure: '#6366F1', // indigo
    data: '#EF4444', // red
  };

  return colors[type] || `hsl(${index * 40}, 70%, 50%)`;
}
