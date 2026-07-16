import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare, Bot, User, FileText, Code2 } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { queryRepository } from '../services/llm';
import type { QueryResult } from '../types';

export function QueryInterface() {
  const {
    selectedRepository,
    queryHistory,
    isQuerying,
    setQuerying,
    addQueryResult,
    llmConfig,
  } = useStore();

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [queryHistory, scrollToBottom]);

  const handleSubmitInternal = useCallback(async (queryText?: string) => {
    const queryToSubmit = queryText || query;
    if (!queryToSubmit.trim() || !selectedRepository || isQuerying) return;

    setError(null);
    setQuerying(true);

    try {
      const result = await queryRepository(selectedRepository, queryToSubmit.trim());
      addQueryResult(result);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');
    } finally {
      setQuerying(false);
    }
  }, [query, selectedRepository, isQuerying, setQuerying, addQueryResult]);

  // Listen for external query events (from overlay)
  useEffect(() => {
    const handleExternalQuery = (event: CustomEvent<{ query: string }>) => {
      if (event.detail?.query && selectedRepository && !isQuerying) {
        setQuery(event.detail.query);
        // Auto-submit after a brief delay to allow UI to update
        setTimeout(() => {
          handleSubmitInternal(event.detail.query);
        }, 100);
      }
    };

    window.addEventListener('repolens-query', handleExternalQuery as EventListener);
    
    return () => {
      window.removeEventListener('repolens-query', handleExternalQuery as EventListener);
    };
  }, [selectedRepository, isQuerying, handleSubmitInternal]);

  const handleSubmit = useCallback(() => {
    handleSubmitInternal();
  }, [handleSubmitInternal]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  if (!selectedRepository) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a repository to ask questions</p>
        </div>
      </div>
    );
  }

  if (!llmConfig) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>LLM not configured</p>
          <p className="text-sm mt-1">Go to Settings to configure your LLM provider</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Ask Repository
        </h2>
        <p className="text-xs text-gray-500 mt-1">{selectedRepository.fullName}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {queryHistory.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Ask anything about this repository</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>Try asking:</p>
              <ul className="space-y-1 text-left max-w-md mx-auto">
                <li className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded">• "Explain the architecture"</li>
                <li className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded">• "Where is authentication handled?"</li>
                <li className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded">• "List all API endpoints"</li>
                <li className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded">• "What would break if I removed X?"</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {[...queryHistory].reverse().map((result, index) => (
              <QueryResultItem key={index} result={result} />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the repository..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500
                       resize-none"
            rows={2}
            disabled={isQuerying}
          />
          <button
            onClick={handleSubmit}
            disabled={isQuerying || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 self-end"
          >
            {isQuerying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function QueryResultItem({ result }: { result: QueryResult }) {
  return (
    <div className="space-y-3">
      {/* User query */}
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
          <p className="text-sm">{result.query}</p>
        </div>
      </div>

      {/* AI response */}
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm whitespace-pre-wrap">{result.answer}</p>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 mb-2">Sources:</p>
              <div className="flex flex-wrap gap-1">
                {result.sources.slice(0, 5).map((source, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                  >
                    {source.type === 'file' ? (
                      <FileText className="w-3 h-3" />
                    ) : (
                      <Code2 className="w-3 h-3" />
                    )}
                    {source.path || source.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            {new Date(result.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
