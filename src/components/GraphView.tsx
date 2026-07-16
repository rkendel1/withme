/**
 * GraphView Component
 * 
 * Interactive graph visualization using Cytoscape.js with ELK.js layouts.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  GitBranch,
  Box,
  FileCode,
  Search,
  X,
  ChevronDown,
  Info,
} from 'lucide-react';

import type {
  GraphNode,
  GraphEdge,
  LayoutType,
  GraphViewConfig,
} from '../types/graph';

import {
  toCytoscapeElements,
  getCytoscapeStylesheet,
} from '../services/graph';

// ============================================================================
// Types
// ============================================================================

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect?: (node: GraphNode | null) => void;
  onEdgeSelect?: (edge: GraphEdge | null) => void;
  config?: Partial<GraphViewConfig>;
  className?: string;
}

interface LayoutConfig {
  name: string;
  icon: React.ReactNode;
  elkOptions?: Record<string, string>;
}

// ============================================================================
// Layout Configurations
// ============================================================================

const LAYOUTS: Record<LayoutType, LayoutConfig> = {
  force_directed: {
    name: 'Force Directed',
    icon: <GitBranch className="w-4 h-4" />,
  },
  hierarchical: {
    name: 'Hierarchical',
    icon: <Layers className="w-4 h-4" />,
    elkOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    },
  },
  architecture: {
    name: 'Architecture',
    icon: <Box className="w-4 h-4" />,
    elkOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
  },
  dependency: {
    name: 'Dependency',
    icon: <FileCode className="w-4 h-4" />,
    elkOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
  },
  service_map: {
    name: 'Service Map',
    icon: <GitBranch className="w-4 h-4" />,
    elkOptions: {
      'elk.algorithm': 'stress',
      'elk.stress.desiredEdgeLength': '200',
    },
  },
  circular: {
    name: 'Circular',
    icon: <RotateCcw className="w-4 h-4" />,
  },
  grid: {
    name: 'Grid',
    icon: <Maximize2 className="w-4 h-4" />,
  },
};

// ============================================================================
// ELK Layout Integration
// ============================================================================

async function applyElkLayout(
  cy: Core,
  layoutType: LayoutType
): Promise<void> {
  const layoutConfig = LAYOUTS[layoutType];
  
  if (!layoutConfig.elkOptions) {
    // Use Cytoscape's built-in layouts
    if (layoutType === 'circular') {
      cy.layout({ name: 'circle', padding: 50 }).run();
    } else if (layoutType === 'grid') {
      cy.layout({ name: 'grid', padding: 50 }).run();
    } else {
      // Force-directed using cose
      cy.layout({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: () => 400000,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 100,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 1000,
        padding: 50,
      }).run();
    }
    return;
  }
  
  // Use ELK for hierarchical layouts
  const elk = new ELK();
  
  const nodes = cy.nodes().map(node => ({
    id: node.id(),
    width: 40,
    height: 40,
  }));
  
  const edges = cy.edges().map(edge => ({
    id: edge.id(),
    sources: [edge.source().id()],
    targets: [edge.target().id()],
  }));
  
  const graph = {
    id: 'root',
    layoutOptions: layoutConfig.elkOptions,
    children: nodes,
    edges: edges,
  };
  
  try {
    const layout = await elk.layout(graph);
    
    cy.batch(() => {
      if (layout.children) {
        for (const node of layout.children) {
          const cyNode = cy.getElementById(node.id);
          if (cyNode.length > 0) {
            cyNode.position({
              x: (node.x || 0) + (node.width || 0) / 2,
              y: (node.y || 0) + (node.height || 0) / 2,
            });
          }
        }
      }
    });
    
    cy.fit(undefined, 50);
  } catch (error) {
    console.error('ELK layout failed:', error);
    // Fallback to cose layout
    cy.layout({ name: 'cose', animate: false }).run();
  }
}

// ============================================================================
// GraphView Component
// ============================================================================

export function GraphView({
  nodes,
  edges,
  onNodeSelect,
  onEdgeSelect,
  config = {},
  className = '',
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  
  const [layoutType, setLayoutType] = useState<LayoutType>(config.layout || 'force_directed');
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    
    const elements = toCytoscapeElements(nodes, edges);
    
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: getCytoscapeStylesheet(),
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.3,
    });
    
    cyRef.current = cy;
    
    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const nodeId = parseInt(evt.target.id());
      const node = nodes.find(n => n.id === nodeId);
      setSelectedNode(node || null);
      onNodeSelect?.(node || null);
    });
    
    cy.on('tap', 'edge', (evt) => {
      const edgeId = parseInt(evt.target.id().replace('e', ''));
      const edge = edges.find(e => e.id === edgeId);
      onEdgeSelect?.(edge || null);
    });
    
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        onNodeSelect?.(null);
        onEdgeSelect?.(null);
      }
    });
    
    // Apply initial layout
    applyElkLayout(cy, layoutType);
    
    return () => {
      cy.destroy();
    };
  }, [nodes, edges]);
  
  // Apply layout when layout type changes
  const handleLayoutChange = useCallback(async (newLayout: LayoutType) => {
    setLayoutType(newLayout);
    setShowLayoutMenu(false);
    
    if (cyRef.current) {
      setIsLoading(true);
      await applyElkLayout(cyRef.current, newLayout);
      setIsLoading(false);
    }
  }, []);
  
  // Search functionality
  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    if (!text) {
      cy.elements().removeClass('faded').removeClass('highlighted');
      return;
    }
    
    const matchingNodes = cy.nodes().filter((node: NodeSingular) => {
      const label = node.data('label')?.toLowerCase() || '';
      return label.includes(text.toLowerCase());
    });
    
    cy.elements().addClass('faded');
    matchingNodes.removeClass('faded').addClass('highlighted');
    matchingNodes.connectedEdges().removeClass('faded');
    
    if (matchingNodes.length > 0) {
      cy.fit(matchingNodes, 100);
    }
  }, []);
  
  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  }, []);
  
  const handleFit = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  }, []);
  
  const handleReset = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.reset();
      applyElkLayout(cyRef.current, layoutType);
    }
  }, [layoutType]);
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {/* Layout selector */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {LAYOUTS[layoutType].icon}
              <span>{LAYOUTS[layoutType].name}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showLayoutMenu && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 min-w-[160px]">
                {(Object.keys(LAYOUTS) as LayoutType[]).map((layout) => (
                  <button
                    key={layout}
                    onClick={() => handleLayoutChange(layout)}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      layout === layoutType ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    {LAYOUTS[layout].icon}
                    <span>{LAYOUTS[layout].name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Zoom controls */}
          <div className="flex items-center border-l border-gray-300 dark:border-gray-600 pl-2 ml-2">
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFit}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchText}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search nodes..."
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchText('');
                  handleSearch('');
                }}
                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
          
          {/* Stats */}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 px-2">
            <span>{nodes.length} nodes</span>
            <span>•</span>
            <span>{edges.length} edges</span>
          </div>
        </div>
      </div>
      
      {/* Graph container */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}
        
        <div
          ref={containerRef}
          className="absolute inset-0 bg-gray-50 dark:bg-gray-900"
        />
        
        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300`}>
                  {selectedNode.type}
                </span>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedNode.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  onNodeSelect?.(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {selectedNode.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {selectedNode.description}
              </p>
            )}
            
            {selectedNode.filePath && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 font-mono">
                {selectedNode.filePath}
                {selectedNode.startLine && `:${selectedNode.startLine}`}
              </p>
            )}
            
            {Object.keys(selectedNode.metrics).length > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {Object.entries(selectedNode.metrics).map(([key, value]) => (
                  <span
                    key={key}
                    className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                  >
                    {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No graph data available</p>
              <p className="text-sm mt-1">Analyze a repository to build the relationship graph</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GraphView;
