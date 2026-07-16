import { useState, useMemo } from 'react';
import { FileText, Folder, FolderOpen, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import type { RepoFile } from '../types';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  file?: RepoFile;
  children?: TreeNode[];
}

function buildTree(files: RepoFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  // Sort files by path
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const parts = file.path.split('/');
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        // It's a file
        currentLevel.push({
          name: part,
          path: currentPath,
          type: 'file',
          file,
        });
      } else {
        // It's a directory
        let dir = dirMap.get(currentPath);
        if (!dir) {
          dir = {
            name: part,
            path: currentPath,
            type: 'directory',
            children: [],
          };
          dirMap.set(currentPath, dir);
          currentLevel.push(dir);
        }
        currentLevel = dir.children!;
      }
    }
  }

  // Sort each level: directories first, then files
  const sortLevel = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(node => {
      if (node.children) {
        return { ...node, children: sortLevel(node.children) };
      }
      return node;
    });
  };

  return sortLevel(root);
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedFile: RepoFile | null;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (file: RepoFile) => void;
}

function TreeNodeItem({
  node,
  depth,
  selectedFile,
  expandedDirs,
  onToggleDir,
  onSelectFile,
}: TreeNodeItemProps) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = node.file && selectedFile?.id === node.file.id;

  const getFileIcon = (extension: string | null) => {
    const iconClass = 'w-4 h-4';
    const color = getLanguageColor(extension);
    return <FileText className={iconClass} style={{ color }} />;
  };

  if (node.type === 'directory') {
    return (
      <div>
        <div
          onClick={() => onToggleDir(node.path)}
          className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500" />
          )}
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => node.file && onSelectFile(node.file)}
      className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded
                 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      {getFileIcon(node.file?.extension || null)}
      <span className="text-sm truncate">{node.name}</span>
    </div>
  );
}

function getLanguageColor(extension: string | null): string {
  const colors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f7df1e',
    jsx: '#61dafb',
    py: '#3776ab',
    rb: '#cc342d',
    go: '#00add8',
    rs: '#dea584',
    java: '#b07219',
    kt: '#a97bff',
    swift: '#f05138',
    c: '#555555',
    cpp: '#f34b7d',
    cs: '#178600',
    php: '#4f5d95',
    md: '#083fa1',
    json: '#292929',
    yaml: '#cb171e',
    yml: '#cb171e',
    html: '#e34c26',
    css: '#563d7c',
    scss: '#c6538c',
    sql: '#e38c00',
    sh: '#89e051',
    bash: '#89e051',
  };
  return colors[extension || ''] || '#6b7280';
}

export function FileExplorer() {
  const { files, selectedFile, setSelectedFile, selectedRepository } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(files), [files]);

  const filteredFiles = useMemo(() => {
    if (!searchTerm) return files;
    const term = searchTerm.toLowerCase();
    return files.filter(
      (f) => f.name.toLowerCase().includes(term) || f.path.toLowerCase().includes(term)
    );
  }, [files, searchTerm]);

  const handleToggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allDirs = new Set<string>();
    const collectDirs = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          allDirs.add(node.path);
          if (node.children) collectDirs(node.children);
        }
      }
    };
    collectDirs(tree);
    setExpandedDirs(allDirs);
  };

  const handleCollapseAll = () => {
    setExpandedDirs(new Set());
  };

  if (!selectedRepository) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Select a repository to view files</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            onClick={handleExpandAll}
            className="text-blue-600 hover:underline"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="text-blue-600 hover:underline"
          >
            Collapse All
          </button>
          <span className="text-gray-400 ml-auto">{files.length} files</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {searchTerm ? (
          <div>
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setSelectedFile(file)}
                className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded
                           ${selectedFile?.id === file.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
              >
                <FileText className="w-4 h-4" style={{ color: getLanguageColor(file.extension) }} />
                <span className="text-sm truncate">{file.path}</span>
              </div>
            ))}
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              onToggleDir={handleToggleDir}
              onSelectFile={setSelectedFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
