/**
 * GraphPanel Component
 * 
 * Main panel for the Repository Relationship Graph with tabs for
 * different views: Overview, Relationships, Dependencies, Impact, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Network,
  GitBranch,
  Layers,
  AlertTriangle,
  Search,
  FileCode,
  RefreshCw,
  ChevronRight,
  Info,
  Activity,
  Target,
} from 'lucide-react';

import { useStore } from '../hooks/useStore';
import { GraphView } from './GraphView';
import {
  buildGraph,
  getGraph,
  getGraphStatistics,
  findDependencies,
  findDependents,
  analyzeImpact,
  findEntrypoints,
  findCycles,
  searchNodes,
  invalidateGraphCache,
} from '../services/graph';
import { getFilesByRepository, getDependenciesByRepository, getSymbolsByRepository } from '../db';
import { getImportsByRepository } from '../db';

import type { GraphNode, GraphEdge, GraphStats, ImpactAnalysis, CycleResult } from '../types/graph';

// ============================================================================
// Types
// ============================================================================

type TabType = 'overview' | 'graph' | 'dependencies' | 'impact' | 'cycles';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <Info className="w-4 h-4" /> },
  { id: 'graph', label: 'Graph', icon: <Network className="w-4 h-4" /> },
  { id: 'dependencies', label: 'Dependencies', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'impact', label: 'Impact', icon: <Target className="w-4 h-4" /> },
  { id: 'cycles', label: 'Cycles', icon: <AlertTriangle className="w-4 h-4" /> },
];

// ============================================================================
// GraphPanel Component
// ============================================================================

export function GraphPanel() {
  const { selectedRepository } = useStore();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  
  // Impact analysis state
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [analyzingImpact, setAnalyzingImpact] = useState(false);
  
  // Cycles state
  const [cycles, setCycles] = useState<CycleResult[]>([]);
  const [checkingCycles, setCheckingCycles] = useState(false);
  
  // Dependencies state
  const [dependencies, setDependencies] = useState<GraphNode[]>([]);
  const [dependents, setDependents] = useState<GraphNode[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  
  // Entry points
  const [entryPoints, setEntryPoints] = useState<GraphNode[]>([]);
  
  // Load graph data when repository changes
  useEffect(() => {
    if (!selectedRepository) {
      setNodes([]);
      setEdges([]);
      setStats(null);
      return;
    }
    
    loadGraphData();
  }, [selectedRepository]);
  
  const loadGraphData = useCallback(async () => {
    if (!selectedRepository) return;
    
    try {
      const { nodes: graphNodes, edges: graphEdges } = await getGraph(selectedRepository.id);
      setNodes(graphNodes);
      setEdges(graphEdges);
      
      const graphStats = await getGraphStatistics(selectedRepository.id);
      setStats(graphStats);
      
      const entries = await findEntrypoints(selectedRepository.id);
      setEntryPoints(entries);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    }
  }, [selectedRepository]);
  
  // Build graph
  const handleBuildGraph = useCallback(async () => {
    if (!selectedRepository) return;
    
    setIsBuilding(true);
    setBuildProgress('Starting...');
    
    try {
      const repoFiles = await getFilesByRepository(selectedRepository.id);
      const repoSymbols = await getSymbolsByRepository(selectedRepository.id);
      const repoImports = await getImportsByRepository(selectedRepository.id);
      const repoDependencies = await getDependenciesByRepository(selectedRepository.id);
      
      invalidateGraphCache();
      
      await buildGraph(
        selectedRepository,
        repoFiles,
        repoSymbols,
        repoImports,
        repoDependencies,
        (progress) => {
          setBuildProgress(progress.message);
        }
      );
      
      await loadGraphData();
    } catch (error) {
      console.error('Failed to build graph:', error);
    } finally {
      setIsBuilding(false);
      setBuildProgress('');
    }
  }, [selectedRepository, loadGraphData]);
  
  // Search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    if (!selectedRepository || !query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const results = await searchNodes(selectedRepository.id, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [selectedRepository]);
  
  // Load dependencies for selected node
  const handleNodeSelect = useCallback(async (node: GraphNode | null) => {
    setSelectedNode(node);
    
    if (!node || !selectedRepository) {
      setDependencies([]);
      setDependents([]);
      setImpactAnalysis(null);
      return;
    }
    
    setLoadingDeps(true);
    
    try {
      const [deps, depts] = await Promise.all([
        findDependencies(selectedRepository.id, node.id, true),
        findDependents(selectedRepository.id, node.id, true),
      ]);
      
      setDependencies(deps);
      setDependents(depts);
    } catch (error) {
      console.error('Failed to load dependencies:', error);
    } finally {
      setLoadingDeps(false);
    }
  }, [selectedRepository]);
  
  // Analyze impact
  const handleAnalyzeImpact = useCallback(async () => {
    if (!selectedNode || !selectedRepository) return;
    
    setAnalyzingImpact(true);
    
    try {
      const impact = await analyzeImpact(selectedRepository.id, selectedNode.id);
      setImpactAnalysis(impact);
    } catch (error) {
      console.error('Impact analysis failed:', error);
    } finally {
      setAnalyzingImpact(false);
    }
  }, [selectedNode, selectedRepository]);
  
  // Check for cycles
  const handleCheckCycles = useCallback(async () => {
    if (!selectedRepository) return;
    
    setCheckingCycles(true);
    
    try {
      const detectedCycles = await findCycles(selectedRepository.id);
      setCycles(detectedCycles);
    } catch (error) {
      console.error('Cycle detection failed:', error);
    } finally {
      setCheckingCycles(false);
    }
  }, [selectedRepository]);
  
  // No repository selected
  if (!selectedRepository) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a repository to view the relationship graph</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        
        <div className="flex-1" />
        
        {/* Build button */}
        <button
          onClick={handleBuildGraph}
          disabled={isBuilding}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isBuilding ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {buildProgress || 'Building...'}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Build Graph
            </>
          )}
        </button>
      </div>
      
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6 overflow-auto h-full">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Graph Overview
            </h2>
            
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Nodes"
                  value={stats.nodeCount}
                  icon={<Layers className="w-5 h-5 text-blue-500" />}
                />
                <StatCard
                  label="Edges"
                  value={stats.edgeCount}
                  icon={<GitBranch className="w-5 h-5 text-green-500" />}
                />
                <StatCard
                  label="Components"
                  value={stats.connectedComponents}
                  icon={<Network className="w-5 h-5 text-purple-500" />}
                />
                <StatCard
                  label="Avg Degree"
                  value={stats.averageDegree.toFixed(2)}
                  icon={<Activity className="w-5 h-5 text-orange-500" />}
                />
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-center text-gray-500">
                <Network className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No graph data available</p>
                <p className="text-sm mt-1">Click "Build Graph" to analyze the repository</p>
              </div>
            )}
            
            {/* Node type distribution */}
            {stats && Object.keys(stats.nodeTypeDistribution).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Node Types
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.nodeTypeDistribution).map(([type, count]) => (
                    <span
                      key={type}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full"
                    >
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Entry points */}
            {entryPoints.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Entry Points ({entryPoints.length})
                </h3>
                <div className="space-y-1">
                  {entryPoints.slice(0, 10).map((node) => (
                    <div
                      key={node.id}
                      onClick={() => handleNodeSelect(node)}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <FileCode className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{node.name}</span>
                      <span className="text-xs text-gray-500">{node.type}</span>
                    </div>
                  ))}
                  {entryPoints.length > 10 && (
                    <p className="text-xs text-gray-500 pl-2">
                      and {entryPoints.length - 10} more...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Graph Tab */}
        {activeTab === 'graph' && (
          <GraphView
            nodes={nodes}
            edges={edges}
            onNodeSelect={handleNodeSelect}
            className="h-full"
          />
        )}
        
        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <div className="flex h-full">
            {/* Node list */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-auto">
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search nodes..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
              
              <div className="px-2">
                {(searchQuery ? searchResults : nodes.slice(0, 50)).map((node) => (
                  <div
                    key={node.id}
                    onClick={() => handleNodeSelect(node)}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      selectedNode?.id === node.id
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-sm truncate flex-1">{node.name}</span>
                    <span className="text-xs text-gray-500">{node.type}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Dependency details */}
            <div className="flex-1 p-4 overflow-auto">
              {selectedNode ? (
                <div>
                  <h3 className="text-lg font-medium mb-4">{selectedNode.name}</h3>
                  
                  {loadingDeps ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading dependencies...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      {/* Dependencies */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Dependencies ({dependencies.length})
                        </h4>
                        <div className="space-y-1">
                          {dependencies.map((dep) => (
                            <div
                              key={dep.id}
                              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                              <span>{dep.name}</span>
                              <span className="text-xs text-gray-500">{dep.type}</span>
                            </div>
                          ))}
                          {dependencies.length === 0 && (
                            <p className="text-sm text-gray-500">No dependencies</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Dependents */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Dependents ({dependents.length})
                        </h4>
                        <div className="space-y-1">
                          {dependents.map((dep) => (
                            <div
                              key={dep.id}
                              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-400 rotate-180" />
                              <span>{dep.name}</span>
                              <span className="text-xs text-gray-500">{dep.type}</span>
                            </div>
                          ))}
                          {dependents.length === 0 && (
                            <p className="text-sm text-gray-500">No dependents</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Select a node to view dependencies</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Impact Tab */}
        {activeTab === 'impact' && (
          <div className="p-6 overflow-auto h-full">
            {selectedNode ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">
                    Impact Analysis: {selectedNode.name}
                  </h3>
                  <button
                    onClick={handleAnalyzeImpact}
                    disabled={analyzingImpact}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
                  >
                    {analyzingImpact ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4" />
                        Analyze Impact
                      </>
                    )}
                  </button>
                </div>
                
                {impactAnalysis ? (
                  <div className="space-y-6">
                    {/* Blast radius */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {impactAnalysis.blastRadius}
                      </div>
                      <div className="text-sm text-orange-700 dark:text-orange-300">
                        Components in blast radius
                      </div>
                    </div>
                    
                    {/* Affected services */}
                    {impactAnalysis.affectedServices.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Affected Services</h4>
                        <div className="flex flex-wrap gap-2">
                          {impactAnalysis.affectedServices.map((service) => (
                            <span
                              key={service.id}
                              className="px-2 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded"
                            >
                              {service.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Breaking changes */}
                    {impactAnalysis.potentialBreakingChanges.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Potential Breaking Changes</h4>
                        <div className="space-y-2">
                          {impactAnalysis.potentialBreakingChanges.map((change, i) => (
                            <div
                              key={i}
                              className={`p-3 rounded ${
                                change.severity === 'critical'
                                  ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                                  : change.severity === 'high'
                                  ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500'
                                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                              }`}
                            >
                              <div className="font-medium">{change.node.name}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {change.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Suggested tests */}
                    {impactAnalysis.suggestedTests.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Suggested Tests</h4>
                        <ul className="space-y-1">
                          {impactAnalysis.suggestedTests.map((test, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                              • {test}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Click "Analyze Impact" to see the impact analysis</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Select a node from the Graph or Dependencies tab</p>
                  <p className="text-sm mt-1">to analyze its impact</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Cycles Tab */}
        {activeTab === 'cycles' && (
          <div className="p-6 overflow-auto h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Dependency Cycles</h3>
              <button
                onClick={handleCheckCycles}
                disabled={checkingCycles}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50"
              >
                {checkingCycles ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Check for Cycles
                  </>
                )}
              </button>
            </div>
            
            {cycles.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {cycles.length}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    Dependency cycles detected
                  </div>
                </div>
                
                {cycles.map((cycle, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg"
                  >
                    <h4 className="text-sm font-medium mb-2">Cycle {i + 1}</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {cycle.nodes.map((node, j) => (
                        <span key={j} className="flex items-center">
                          <span className="px-2 py-1 text-sm bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            {node.name}
                          </span>
                          {j < cycle.nodes.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : checkingCycles ? null : (
              <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg text-center">
                <div className="text-lg font-medium text-green-600 dark:text-green-400">
                  No cycles detected
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  The dependency graph is acyclic
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
    </div>
  );
}

export default GraphPanel;
