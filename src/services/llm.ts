import type { LLMConfig, QueryResult, QuerySource, Repository } from '../types';
import { query, getRepositoryStats, searchFiles, searchSymbols } from '../db';
import { STORAGE_KEYS } from '../constants';

/**
 * Get LLM configuration from settings
 * Note: API keys are stored in browser localStorage for local-first operation.
 * Users are responsible for securing their browser environment.
 */
export async function getLLMConfig(): Promise<LLMConfig | null> {
  const configStr = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG);
  if (!configStr) return null;
  try {
    return JSON.parse(configStr);
  } catch {
    return null;
  }
}

/**
 * Save LLM configuration to settings
 * Note: API keys are stored in browser localStorage for local-first operation.
 */
export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.LLM_CONFIG, JSON.stringify(config));
}

/**
 * Get the API base URL for the configured provider
 */
function getBaseUrl(config: LLMConfig): string {
  if (config.baseUrl) return config.baseUrl;

  switch (config.provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'lmstudio':
      return 'http://localhost:1234/v1';
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Build context from repository data
 */
async function buildContext(
  repositoryId: number,
  userQuery: string
): Promise<{ context: string; sources: QuerySource[] }> {
  const sources: QuerySource[] = [];
  let context = '';

  // Get repository stats
  const stats = await getRepositoryStats(repositoryId);
  context += `Repository has ${stats.fileCount} files, ${stats.symbolCount} symbols, and ${stats.dependencyCount} dependencies.\n`;
  context += `Languages: ${stats.languages.join(', ')}\n\n`;

  // Search for relevant files
  const relevantFiles = await searchFiles(repositoryId, userQuery);
  if (relevantFiles.length > 0) {
    context += 'Relevant files:\n';
    for (const file of relevantFiles.slice(0, 5)) {
      context += `- ${file.path}`;
      if (file.content) {
        const snippet = file.content.slice(0, 500);
        context += `:\n\`\`\`\n${snippet}\n\`\`\``;
        sources.push({
          type: 'file',
          path: file.path,
          snippet,
        });
      }
      context += '\n';
    }
    context += '\n';
  }

  // Search for relevant symbols
  const relevantSymbols = await searchSymbols(repositoryId, userQuery);
  if (relevantSymbols.length > 0) {
    context += 'Relevant symbols:\n';
    for (const symbol of relevantSymbols.slice(0, 10)) {
      context += `- ${symbol.kind} ${symbol.name}`;
      if (symbol.signature) {
        context += `: ${symbol.signature}`;
      }
      context += '\n';
      sources.push({
        type: 'symbol',
        name: symbol.name,
        line: symbol.startLine,
      });
    }
    context += '\n';
  }

  return { context, sources };
}

/**
 * Generate SQL to answer a question
 */
async function generateSQL(
  _config: LLMConfig,
  _userQuery: string,
  _repositoryId: number
): Promise<string | null> {
  // For now, return null - SQL generation would require LLM
  // This is a placeholder for future implementation
  return null;
}

/**
 * Execute a query using SQL
 */
async function executeSQL(
  sql: string,
  repositoryId: number
): Promise<{ results: unknown[]; sources: QuerySource[] }> {
  const sources: QuerySource[] = [];

  // Safety: only allow SELECT statements
  if (!sql.trim().toLowerCase().startsWith('select')) {
    throw new Error('Only SELECT statements are allowed');
  }

  // Replace repository ID placeholder
  const finalSql = sql.replace(/\$REPO_ID/g, repositoryId.toString());

  const results = await query(finalSql);

  return { results, sources };
}

/**
 * Call the LLM API
 */
async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const baseUrl = getBaseUrl(config);

  if (config.provider === 'anthropic') {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // OpenAI-compatible API (OpenAI, OpenRouter, Ollama, LM Studio)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = 'Bearer ' + config.apiKey;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Query the repository using natural language
 */
export async function queryRepository(
  repository: Repository,
  userQuery: string
): Promise<QueryResult> {
  const config = await getLLMConfig();
  if (!config) {
    throw new Error('LLM not configured. Please configure your LLM provider in settings.');
  }

  const sources: QuerySource[] = [];
  let sqlUsed: string | undefined;

  // Build context from repository data
  const { context, sources: contextSources } = await buildContext(repository.id, userQuery);
  sources.push(...contextSources);

  // Try to generate SQL for structured queries
  const generatedSql = await generateSQL(config, userQuery, repository.id);
  if (generatedSql) {
    try {
      const { results, sources: sqlSources } = await executeSQL(generatedSql, repository.id);
      sources.push(...sqlSources);
      sqlUsed = generatedSql;
      // TODO: Incorporate SQL results into context for LLM when SQL generation is implemented
      console.log('SQL Results:', results);
    } catch (error) {
      console.error('SQL execution error:', error);
    }
  }

  // Build system prompt
  const systemPrompt = `You are RepoLens, an AI assistant that helps users understand code repositories.
You have access to a database containing the repository structure, files, symbols, imports, and dependencies.
Use the provided context to answer questions accurately and concisely.
When referencing code, mention the file path and line numbers when possible.
If you're not sure about something, say so rather than making up information.

Repository: ${repository.fullName}
${repository.description ? `Description: ${repository.description}` : ''}

Context from repository:
${context}`;

  // Call LLM
  const answer = await callLLM(config, systemPrompt, userQuery);

  return {
    query: userQuery,
    answer,
    sources,
    sqlUsed,
    timestamp: new Date(),
  };
}

/**
 * Explain a specific file
 */
export async function explainFile(
  repository: Repository,
  filePath: string,
  fileContent: string
): Promise<QueryResult> {
  const config = await getLLMConfig();
  if (!config) {
    throw new Error('LLM not configured. Please configure your LLM provider in settings.');
  }

  const systemPrompt = `You are RepoLens, an AI assistant that helps users understand code.
Explain the provided file clearly and concisely, covering:
1. The purpose of this file
2. Key functions/classes and what they do
3. Important dependencies and imports
4. How this file fits into the larger codebase

Repository: ${repository.fullName}`;

  const userMessage = `Please explain this file: ${filePath}

\`\`\`
${fileContent.slice(0, 10000)}
\`\`\``;

  const answer = await callLLM(config, systemPrompt, userMessage);

  return {
    query: `Explain ${filePath}`,
    answer,
    sources: [{ type: 'file', path: filePath }],
    timestamp: new Date(),
  };
}
