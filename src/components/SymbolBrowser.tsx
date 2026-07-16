import { useStore } from '../hooks/useStore';
import { Code2, FileCode, Hash, Box, Braces, Type, List, Package } from 'lucide-react';
import type { Symbol, SymbolKind } from '../types';

const SYMBOL_ICONS: Record<SymbolKind, typeof Code2> = {
  function: Code2,
  class: Box,
  method: Braces,
  variable: Hash,
  constant: Hash,
  interface: Type,
  type: Type,
  enum: List,
  module: Package,
  import: FileCode,
};

const SYMBOL_COLORS: Record<SymbolKind, string> = {
  function: '#3b82f6',
  class: '#f59e0b',
  method: '#8b5cf6',
  variable: '#10b981',
  constant: '#06b6d4',
  interface: '#ec4899',
  type: '#ec4899',
  enum: '#f97316',
  module: '#6366f1',
  import: '#6b7280',
};

interface SymbolItemProps {
  symbol: Symbol;
}

function SymbolItem({ symbol }: SymbolItemProps) {
  const Icon = SYMBOL_ICONS[symbol.kind] || Code2;
  const color = SYMBOL_COLORS[symbol.kind] || '#6b7280';

  return (
    <div className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer">
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{symbol.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {symbol.kind}
          </span>
        </div>
        {symbol.signature && (
          <code className="text-xs text-gray-500 dark:text-gray-400 block truncate mt-0.5">
            {symbol.signature}
          </code>
        )}
        {symbol.docstring && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {symbol.docstring}
          </p>
        )}
      </div>
      <span className="text-xs text-gray-400">L{symbol.startLine}</span>
    </div>
  );
}

export function SymbolBrowser() {
  const { symbols, selectedRepository } = useStore();

  if (!selectedRepository) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Select a repository to view symbols</p>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Code2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No symbols found</p>
          <p className="text-sm mt-1">Symbols are extracted from TypeScript and JavaScript files</p>
        </div>
      </div>
    );
  }

  // Group symbols by kind
  const groupedSymbols = symbols.reduce((acc, symbol) => {
    if (!acc[symbol.kind]) {
      acc[symbol.kind] = [];
    }
    acc[symbol.kind].push(symbol);
    return acc;
  }, {} as Record<SymbolKind, Symbol[]>);

  const sortedKinds: SymbolKind[] = ['class', 'interface', 'type', 'function', 'method', 'constant', 'variable', 'enum', 'module', 'import'];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold flex items-center gap-2">
          <Code2 className="w-5 h-5" />
          Symbols
        </h2>
        <p className="text-xs text-gray-500 mt-1">{symbols.length} symbols found</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sortedKinds.map((kind) => {
          const kindSymbols = groupedSymbols[kind];
          if (!kindSymbols || kindSymbols.length === 0) return null;

          const Icon = SYMBOL_ICONS[kind];
          const color = SYMBOL_COLORS[kind];

          return (
            <div key={kind} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Icon className="w-3 h-3" style={{ color }} />
                {kind}s ({kindSymbols.length})
              </h3>
              <div className="space-y-1">
                {kindSymbols.slice(0, 20).map((symbol) => (
                  <SymbolItem key={symbol.id} symbol={symbol} />
                ))}
                {kindSymbols.length > 20 && (
                  <p className="text-xs text-gray-400 pl-2">
                    +{kindSymbols.length - 20} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
