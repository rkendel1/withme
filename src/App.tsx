import { useEffect, useState } from 'react';
import {
  FolderGit2,
  FileText,
  Code2,
  MessageSquare,
  Settings as SettingsIcon,
  Menu,
  X,
  Search,
  FolderOpen,
  Layers,
  Download,
  Play,
} from 'lucide-react';
import { useStore } from './hooks/useStore';
import { initDatabase, getAllRepositories, ensureDefaultCollection } from './db';
import { getLLMConfig } from './services/llm';
import { RepositoryList } from './components/RepositoryList';
import { FileExplorer } from './components/FileExplorer';
import { FileViewer } from './components/FileViewer';
import { SymbolBrowser } from './components/SymbolBrowser';
import { QueryInterface } from './components/QueryInterface';
import { Settings } from './components/Settings';
import { Collections } from './components/Collections';
import { ArchitecturePanel } from './components/ArchitecturePanel';
import { RuntimePanel } from './components/RuntimePanel';
import './App.css';

const NAV_ITEMS = [
  { id: 'repositories' as const, label: 'Repositories', icon: FolderGit2 },
  { id: 'collections' as const, label: 'Collections', icon: FolderOpen },
  { id: 'files' as const, label: 'Files', icon: FileText },
  { id: 'symbols' as const, label: 'Symbols', icon: Code2 },
  { id: 'architecture' as const, label: 'Architecture', icon: Layers },
  { id: 'runtime' as const, label: 'Runtime', icon: Play },
  { id: 'query' as const, label: 'Ask', icon: MessageSquare },
  { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
];

function App() {
  const {
    setDbInitialized,
    setRepositories,
    setLLMConfig,
    activePanel,
    setActivePanel,
    isSidebarOpen,
    toggleSidebar,
    selectedRepository,
  } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
        setDbInitialized(true);

        // Ensure default collection exists
        await ensureDefaultCollection();

        const repos = await getAllRepositories();
        setRepositories(repos);

        const llmConfig = await getLLMConfig();
        if (llmConfig) {
          setLLMConfig(llmConfig);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [setDbInitialized, setRepositories, setLLMConfig]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-pulse" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">RepoLens</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Initializing database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 text-red-500">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Initialization Error</h1>
          <p className="text-red-500 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-16'
        } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
        flex flex-col transition-all duration-200`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <Search className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-lg">RepoLens</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors
                           ${
                             isActive
                               ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                               : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                           }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Selected Repo Info */}
        {isSidebarOpen && selectedRepository && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Repository</p>
            <p className="text-sm font-medium truncate">{selectedRepository.fullName}</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Panel */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {activePanel === 'repositories' && <RepositoryList />}
          {activePanel === 'collections' && <Collections />}
          {activePanel === 'files' && <FileExplorer />}
          {activePanel === 'symbols' && <SymbolBrowser />}
          {activePanel === 'architecture' && <ArchitecturePanel />}
          {activePanel === 'runtime' && <RuntimePanel />}
          {activePanel === 'query' && <QueryInterface />}
          {activePanel === 'settings' && <Settings />}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden">
          {activePanel === 'files' ? (
            <FileViewer />
          ) : activePanel === 'query' ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Query responses appear in the panel</p>
              </div>
            </div>
          ) : activePanel === 'architecture' ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Architecture analysis appears in the panel</p>
              </div>
            </div>
          ) : activePanel === 'runtime' ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Runtime execution controls and logs appear in the panel</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center max-w-md px-4">
                <Search className="w-16 h-16 mx-auto mb-4 text-blue-600 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Welcome to RepoLens</h2>
                <p className="text-sm mb-4">
                  Transform Git repositories into queryable databases. Add a repository to get started.
                </p>
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm mb-3">
                    <strong>Quick Start:</strong> Install the browser overlay for one-click ingestion
                  </p>
                  <a
                    href="/userscript/repolens.user.js"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg 
                               hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Install Browser Overlay
                  </a>
                  <p className="text-xs mt-2 text-gray-400">
                    Requires <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer" className="underline">Tampermonkey</a> or similar userscript manager
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
