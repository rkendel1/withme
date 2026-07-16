# RepoLens

Local-First AI Repository Intelligence

## Vision

RepoLens is a lightweight browser overlay that transforms any Git repository into a structured, queryable database running entirely in the browser.

Instead of repeatedly sending repository contents to an LLM, RepoLens ingests the repository into an embedded PostgreSQL database powered by PGlite, builds a structured software model, and lets the user’s preferred LLM answer questions using SQL, semantic search, and graph traversal.

The result is dramatically more accurate repository understanding while keeping the repository local by default.

## Core Principles

- Browser-first
- Local-first
- PostgreSQL everywhere (PGlite locally, PostgreSQL optionally)
- Bring Your Own LLM
- No required account
- Works as an overlay on GitHub and other repository browsers
- Optional persistent cloud synchronization

## Architecture

```text
GitHub
GitLab
Local Folder
ZIP
Git Clone
        ↓
 Repository Ingestion
        ↓
Tree-sitter
README
Dependencies
Imports
Symbols
Functions
Files
Commits (optional)
        ↓
PGlite
(PostgreSQL in WASM)
        ↓
SQL
Full Text Search
Embeddings
Relationships
        ↓
Planner
        ↓
User LLM
        ↓
Interactive Answers
```

## Deployment Components

### 1. Overlay Host

A small static website hosted on Render.

Responsibilities:

- Serve the browser userscript
- Host the overlay application
- Provide update notifications
- Publish documentation
- No repository processing

Example:

```text
https://repolens.app
/userscript.js
/overlay.js
/app
/docs
```

The hosted site is simply a delivery mechanism for the client application.

### 2. Browser Overlay

Initially delivered as a userscript (Tampermonkey or Violentmonkey).

Responsibilities:

- Inject overlay into supported pages
- Launch the local PGlite database
- Capture repository metadata
- Manage local collections
- Communicate with the configured LLM
- Render query results

Future versions can package the same codebase as a browser extension.

### 3. Local Brain

Runs entirely in the browser.

Powered by:

- PGlite
- IndexedDB persistence
- Optional pgvector
- Full-text search

Example schema:

- repositories
- files
- directories
- symbols
- functions
- classes
- imports
- dependencies
- relationships
- documents
- chunks
- embeddings
- settings

Nothing leaves the browser unless the user explicitly enables synchronization.

### 4. Optional Cloud Brain

Users may connect a PostgreSQL database (Render PostgreSQL, Supabase, Neon, etc.).

Uses include:

- Device synchronization
- Long-term history
- Shared workspaces
- Team collaboration
- Backup

The schema is identical to the local PGlite database, allowing straightforward synchronization.

## Bring Your Own LLM

RepoLens does not proxy model requests.

Users configure their preferred provider.

Supported examples:

- OpenAI-compatible APIs
- Anthropic-compatible APIs
- OpenRouter
- Ollama
- LM Studio
- Local WebLLM

Credentials remain in browser storage.

## Repository Ingestion

Supported sources:

- GitHub repositories
- GitLab repositories
- Local folders
- ZIP archives

During ingestion RepoLens extracts:

- Repository metadata
- README
- File tree
- Programming languages
- Symbols
- Functions
- Imports
- Dependencies
- Documentation
- Markdown
- Configuration files

The information is normalized into PostgreSQL tables for querying.

## Overlay Experience

When visiting a repository the overlay provides:

- Ask Repository
- Explain Current File
- Explain Selection
- Search Symbols
- Repository Map
- Dependency Explorer
- Call Graph
- Related Files
- AI Insights

Hovering over files or symbols displays contextual information sourced from the local database.

## Example Queries

- Explain this architecture.
- Where does authentication begin?
- Which files reference OAuth?
- What would break if I removed Redis?
- Which code appears unused?
- Show every REST endpoint.
- Generate onboarding documentation.
- Compare authentication across repositories.
- Which repository solved this problem best?

## Technology Stack

### Frontend

- React
- TypeScript
- Vite

### Storage

- PGlite
- IndexedDB

### Analysis

- Tree-sitter
- Markdown parsing
- Dependency analysis

### Search

- PostgreSQL Full Text Search
- Embeddings
- SQL

### AI

- User-selected LLM
- Planner
- Hybrid SQL + semantic retrieval

### Hosting

- Render Static Site
- Optional Render PostgreSQL

## Roadmap

### Phase 1

- Userscript overlay
- Local PGlite
- GitHub support
- Repository ingestion
- Natural language queries
- Local persistence

### Phase 2

- GitLab support
- Local folders
- ZIP ingestion
- Call graphs
- Dependency visualization
- Collections

### Phase 3

- Optional PostgreSQL synchronization
- Team workspaces
- Cross-repository search
- Plugin API
- WASM analysis modules

## Guiding Principle

Your repository becomes a database, not just a collection of files.

Rather than asking an LLM to repeatedly read source code, RepoLens converts software into structured relational data that can be queried, searched, connected, and reasoned over locally. AI becomes the interface to that database instead of the database itself.
