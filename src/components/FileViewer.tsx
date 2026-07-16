import { useStore } from '../hooks/useStore';
import { FileText, Copy, Check, Bot, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { explainFile } from '../services/llm';

export function FileViewer() {
  const { selectedFile, selectedRepository, llmConfig, addQueryResult } = useStore();
  const [copied, setCopied] = useState(false);
  const [explaining, setExplaining] = useState(false);

  const handleCopy = useCallback(() => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile]);

  const handleExplain = useCallback(async () => {
    if (!selectedFile?.content || !selectedRepository || !llmConfig) return;

    setExplaining(true);
    try {
      const result = await explainFile(selectedRepository, selectedFile.path, selectedFile.content);
      addQueryResult(result);
    } catch (error) {
      console.error('Failed to explain file:', error);
    } finally {
      setExplaining(false);
    }
  }, [selectedFile, selectedRepository, llmConfig, addQueryResult]);

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium text-sm truncate">{selectedFile.path}</span>
          {selectedFile.language && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
              {selectedFile.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {llmConfig && selectedFile.content && (
            <button
              onClick={handleExplain}
              disabled={explaining}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 
                         text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50
                         disabled:opacity-50"
            >
              {explaining ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Bot className="w-3 h-3" />
              )}
              Explain
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!selectedFile.content}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 
                       text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600
                       disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedFile.content ? (
          <pre className="p-4 text-sm font-mono leading-relaxed">
            <code>
              {selectedFile.content.split('\n').map((line, index) => (
                <div key={index} className="flex">
                  <span className="select-none text-gray-400 w-12 text-right pr-4 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                </div>
              ))}
            </code>
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Content not available</p>
              <p className="text-sm mt-1">
                {selectedFile.size > 100 * 1024
                  ? 'File is too large to display'
                  : 'Binary or non-text file'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 flex items-center justify-between">
        <span>{selectedFile.size.toLocaleString()} bytes</span>
        {selectedFile.sha && (
          <span className="font-mono truncate max-w-[200px]">SHA: {selectedFile.sha.slice(0, 8)}</span>
        )}
      </div>
    </div>
  );
}
