// ==UserScript==
// @name         RepoLens - Repository Intelligence
// @namespace    https://repolens.app
// @version      1.0.0
// @description  Transform Git repositories into queryable databases. Single-click ingestion for GitHub and GitLab.
// @author       RepoLens
// @match        https://github.com/*
// @match        https://gitlab.com/*
// @match        https://*.gitlab.com/*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PGxpbmUgeDE9IjIxIiB5MT0iMjEiIHgyPSIxNi42NSIgeTI9IjE2LjY1Ii8+PC9zdmc+
// @downloadURL  https://repolens.app/userscript/repolens.user.js
// @updateURL    https://repolens.app/userscript/repolens.user.js
// ==/UserScript==

(function() {
  'use strict';

  // Configuration
  const REPOLENS_APP_URL = 'https://repolens.app';
  const BUTTON_ID = 'repolens-ingest-button';
  const OVERLAY_ID = 'repolens-overlay';

  // Paths to exclude from repository detection
  const GITHUB_EXCLUDED_PATHS = [
    'settings', 'orgs', 'users', 'marketplace', 'explore',
    'notifications', 'new', 'login', 'join', 'pricing'
  ];

  const GITLAB_EXCLUDED_PATHS = [
    'explore', 'dashboard', 'users', 'groups', 'admin', 'help', '-'
  ];

  // Styles
  const styles = `
    #${BUTTON_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      border: none;
      border-radius: 50px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
      transition: all 0.2s ease;
    }

    #${BUTTON_ID}:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }

    #${BUTTON_ID}:active {
      transform: translateY(0);
    }

    #${BUTTON_ID} svg {
      width: 18px;
      height: 18px;
    }

    #${BUTTON_ID}.loading {
      opacity: 0.8;
      pointer-events: none;
    }

    #${BUTTON_ID}.loading svg {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    #${OVERLAY_ID} {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 420px;
      z-index: 10000;
      background: white;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #${OVERLAY_ID}.open {
      transform: translateX(0);
    }

    @media (prefers-color-scheme: dark) {
      #${OVERLAY_ID} {
        background: #1f2937;
        color: white;
      }
    }

    .repolens-overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-overlay-header {
        background: #111827;
        border-color: #374151;
      }
    }

    .repolens-overlay-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-overlay-title {
        color: white;
      }
    }

    .repolens-overlay-close {
      padding: 4px;
      background: none;
      border: none;
      cursor: pointer;
      color: #6b7280;
      border-radius: 4px;
    }

    .repolens-overlay-close:hover {
      background: #e5e7eb;
      color: #111827;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-overlay-close:hover {
        background: #374151;
        color: white;
      }
    }

    .repolens-overlay-content {
      padding: 20px;
    }

    .repolens-repo-card {
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-repo-card {
        background: #111827;
      }
    }

    .repolens-repo-name {
      font-weight: 600;
      font-size: 15px;
      color: #111827;
      margin-bottom: 4px;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-repo-name {
        color: white;
      }
    }

    .repolens-repo-url {
      font-size: 12px;
      color: #6b7280;
      word-break: break-all;
    }

    .repolens-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .repolens-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .repolens-btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
    }

    .repolens-btn-primary:hover {
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .repolens-btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-btn-secondary {
        background: #374151;
        color: #e5e7eb;
      }
    }

    .repolens-btn-secondary:hover {
      background: #d1d5db;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-btn-secondary:hover {
        background: #4b5563;
      }
    }

    .repolens-divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: #9ca3af;
      font-size: 12px;
    }

    .repolens-divider::before,
    .repolens-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-divider::before,
      .repolens-divider::after {
        background: #374151;
      }
    }

    .repolens-divider span {
      padding: 0 12px;
    }

    .repolens-collections {
      margin-top: 16px;
    }

    .repolens-collections-title {
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .repolens-collection-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-collection-item {
        background: #111827;
      }
    }

    .repolens-collection-item:hover {
      background: #e5e7eb;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-collection-item:hover {
        background: #1f2937;
      }
    }

    .repolens-collection-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .repolens-collection-info {
      flex: 1;
    }

    .repolens-collection-name {
      font-weight: 500;
      font-size: 14px;
      color: #111827;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-collection-name {
        color: white;
      }
    }

    .repolens-collection-count {
      font-size: 12px;
      color: #6b7280;
    }

    .repolens-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .repolens-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    .repolens-toast {
      position: fixed;
      bottom: 100px;
      right: 24px;
      padding: 12px 20px;
      background: #111827;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.2s ease;
    }

    .repolens-toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    @media (prefers-color-scheme: dark) {
      .repolens-toast {
        background: #f9fafb;
        color: #111827;
      }
    }
  `;

  // Icons
  const icons = {
    search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    loader: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`,
    externalLink: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  };

  /**
   * Detect the current platform (GitHub or GitLab)
   */
  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname === 'github.com') {
      return 'github';
    } else if (hostname.includes('gitlab')) {
      return 'gitlab';
    }
    return null;
  }

  /**
   * Parse repository info from the current URL
   */
  function parseRepoInfo() {
    const platform = detectPlatform();
    const pathname = window.location.pathname;

    if (platform === 'github') {
      // GitHub URL: /owner/repo or /owner/repo/...
      const match = pathname.match(/^\/([^/]+)\/([^/]+)/);
      if (match && !GITHUB_EXCLUDED_PATHS.includes(match[1])) {
        return {
          platform,
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
          fullName: `${match[1]}/${match[2].replace(/\.git$/, '')}`,
          url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}`,
        };
      }
    } else if (platform === 'gitlab') {
      // GitLab URL: /owner/repo or /group/subgroup/repo
      // GitLab paths can be nested, so we need to detect the project page
      const match = pathname.match(/^\/(.+?)(?:\/-\/|$)/);
      if (match) {
        const projectPath = match[1].replace(/\/$/, '');
        // Skip non-project pages
        if (!GITLAB_EXCLUDED_PATHS.some(p => projectPath.startsWith(p))) {
          const parts = projectPath.split('/');
          if (parts.length >= 2) {
            return {
              platform,
              owner: parts.slice(0, -1).join('/'),
              repo: parts[parts.length - 1],
              fullName: projectPath,
              url: `https://${window.location.hostname}/${projectPath}`,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if we're on a repository page
   */
  function isRepoPage() {
    return parseRepoInfo() !== null;
  }

  /**
   * Show a toast notification
   */
  function showToast(message, duration = 3000) {
    let toast = document.getElementById('repolens-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'repolens-toast';
      toast.className = 'repolens-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  /**
   * Create the ingest button
   */
  function createIngestButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.innerHTML = `${icons.search} <span>RepoLens</span>`;
    button.addEventListener('click', handleButtonClick);
    document.body.appendChild(button);
  }

  /**
   * Remove the ingest button
   */
  function removeIngestButton() {
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.remove();
    }
  }

  /**
   * Create the overlay panel
   */
  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }

    const repoInfo = parseRepoInfo();
    if (!repoInfo) return;

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'repolens-backdrop';
    backdrop.className = 'repolens-backdrop';
    backdrop.addEventListener('click', closeOverlay);
    document.body.appendChild(backdrop);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="repolens-overlay-header">
        <div class="repolens-overlay-title">
          ${icons.search}
          <span>RepoLens</span>
        </div>
        <button class="repolens-overlay-close" id="repolens-close">
          ${icons.x}
        </button>
      </div>
      <div class="repolens-overlay-content">
        <div class="repolens-repo-card">
          <div class="repolens-repo-name">${repoInfo.fullName}</div>
          <div class="repolens-repo-url">${repoInfo.url}</div>
        </div>

        <div class="repolens-actions">
          <button class="repolens-btn repolens-btn-primary" id="repolens-ingest">
            ${icons.plus}
            <span>Ingest Repository</span>
          </button>
          <button class="repolens-btn repolens-btn-secondary" id="repolens-open-app">
            ${icons.externalLink}
            <span>Open RepoLens App</span>
          </button>
        </div>

        <div class="repolens-divider">
          <span>or add to collection</span>
        </div>

        <div class="repolens-collections">
          <div class="repolens-collections-title">Your Collections</div>
          <div id="repolens-collections-list">
            <div class="repolens-collection-item" data-collection="default">
              <div class="repolens-collection-icon">
                ${icons.folder}
              </div>
              <div class="repolens-collection-info">
                <div class="repolens-collection-name">My Repositories</div>
                <div class="repolens-collection-count">Default collection</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Bind event listeners
    document.getElementById('repolens-close').addEventListener('click', closeOverlay);
    document.getElementById('repolens-ingest').addEventListener('click', handleIngest);
    document.getElementById('repolens-open-app').addEventListener('click', handleOpenApp);

    // Collection items
    document.querySelectorAll('.repolens-collection-item').forEach(item => {
      item.addEventListener('click', () => handleAddToCollection(item.dataset.collection));
    });
  }

  /**
   * Open the overlay
   */
  function openOverlay() {
    createOverlay();
    requestAnimationFrame(() => {
      document.getElementById(OVERLAY_ID)?.classList.add('open');
      document.getElementById('repolens-backdrop')?.classList.add('open');
    });
  }

  /**
   * Close the overlay
   */
  function closeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    const backdrop = document.getElementById('repolens-backdrop');
    overlay?.classList.remove('open');
    backdrop?.classList.remove('open');
    setTimeout(() => {
      overlay?.remove();
      backdrop?.remove();
    }, 300);
  }

  /**
   * Handle button click
   */
  function handleButtonClick() {
    openOverlay();
  }

  /**
   * Handle ingest action
   */
  function handleIngest() {
    const repoInfo = parseRepoInfo();
    if (!repoInfo) return;

    const button = document.getElementById('repolens-ingest');
    if (button) {
      button.innerHTML = `${icons.loader} <span>Ingesting...</span>`;
      button.disabled = true;
    }

    // Build the RepoLens app URL with the repo to ingest
    const appUrl = new URL(REPOLENS_APP_URL);
    appUrl.searchParams.set('ingest', repoInfo.url);
    appUrl.searchParams.set('platform', repoInfo.platform);
    appUrl.searchParams.set('fullName', repoInfo.fullName);

    // Open in new tab
    if (typeof GM_openInTab !== 'undefined') {
      GM_openInTab(appUrl.toString(), { active: true });
    } else {
      window.open(appUrl.toString(), '_blank');
    }

    showToast(`Opening RepoLens to ingest ${repoInfo.fullName}...`);
    closeOverlay();
  }

  /**
   * Handle open app action
   */
  function handleOpenApp() {
    const appUrl = REPOLENS_APP_URL;
    if (typeof GM_openInTab !== 'undefined') {
      GM_openInTab(appUrl, { active: true });
    } else {
      window.open(appUrl, '_blank');
    }
    closeOverlay();
  }

  /**
   * Handle add to collection
   */
  function handleAddToCollection(collectionId) {
    const repoInfo = parseRepoInfo();
    if (!repoInfo) return;

    // Build the RepoLens app URL with collection info
    const appUrl = new URL(REPOLENS_APP_URL);
    appUrl.searchParams.set('ingest', repoInfo.url);
    appUrl.searchParams.set('platform', repoInfo.platform);
    appUrl.searchParams.set('fullName', repoInfo.fullName);
    appUrl.searchParams.set('collection', collectionId);

    if (typeof GM_openInTab !== 'undefined') {
      GM_openInTab(appUrl.toString(), { active: true });
    } else {
      window.open(appUrl.toString(), '_blank');
    }

    showToast(`Adding ${repoInfo.fullName} to collection...`);
    closeOverlay();
  }

  /**
   * Initialize the userscript
   */
  function init() {
    // Add styles
    if (typeof GM_addStyle !== 'undefined') {
      GM_addStyle(styles);
    } else {
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }

    // Check if we're on a repo page and create button
    if (isRepoPage()) {
      createIngestButton();
    }

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isRepoPage()) {
          createIngestButton();
        } else {
          removeIngestButton();
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
