// ==UserScript==
// @name         RepoLens - Repository Intelligence
// @namespace    https://withme-w3kh.onrender.com
// @version      2.0.0
// @description  Transform Git repositories into queryable databases. Full app embedded overlay with file exploration, AI queries, architecture graphs, and more.
// @author       RepoLens
// @match        https://github.com/*
// @match        https://gitlab.com/*
// @match        https://*.gitlab.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI4Ii8+PGxpbmUgeDE9IjIxIiB5MT0iMjEiIHgyPSIxNi42NSIgeTI9IjE2LjY1Ii8+PC9zdmc+
// @downloadURL  https://withme-w3kh.onrender.com/userscript/repolens.user.js
// @updateURL    https://withme-w3kh.onrender.com/userscript/repolens.user.js
// ==/UserScript==

(function() {
  'use strict';

  // Configuration
  const REPOLENS_APP_URL = 'https://withme-w3kh.onrender.com';
  const BUTTON_ID = 'repolens-ingest-button';
  const OVERLAY_ID = 'repolens-overlay';
  const IFRAME_ID = 'repolens-iframe';
  const MOBILE_BREAKPOINT = 768;

  // Paths to exclude from repository detection
  const GITHUB_EXCLUDED_PATHS = [
    'settings', 'orgs', 'users', 'marketplace', 'explore',
    'notifications', 'new', 'login', 'join', 'pricing'
  ];

  const GITLAB_EXCLUDED_PATHS = [
    'explore', 'dashboard', 'users', 'groups', 'admin', 'help', '-'
  ];

  // Styles for the overlay with embedded app
  const styles = `
    /* Floating trigger button */
    #${BUTTON_ID} {
      position: fixed;
      top: 80px;
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
      cursor: grab;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
      transition: box-shadow 0.2s ease, transform 0.1s ease;
      user-select: none;
      touch-action: none;
    }

    #${BUTTON_ID}:hover {
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }

    #${BUTTON_ID}.dragging {
      cursor: grabbing;
      transform: scale(1.05);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.6);
    }

    #${BUTTON_ID} svg {
      width: 18px;
      height: 18px;
    }

    /* Mobile adjustments for trigger button */
    @media (max-width: ${MOBILE_BREAKPOINT}px) {
      #${BUTTON_ID} {
        top: 60px;
        right: 16px;
        padding: 12px;
        font-size: 13px;
        border-radius: 50%;
      }

      #${BUTTON_ID} span {
        display: none;
      }
    }

    /* Main overlay container */
    #${OVERLAY_ID} {
      position: fixed;
      top: 40px;
      right: 20px;
      width: 900px;
      height: calc(100vh - 80px);
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 80px);
      min-width: 280px;
      min-height: 200px;
      z-index: 10000;
      background: #1f2937;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      touch-action: none;
    }

    /* Mobile responsive overlay */
    @media (max-width: ${MOBILE_BREAKPOINT}px) {
      #${OVERLAY_ID} {
        top: 10px;
        right: 10px;
        left: 10px;
        width: auto;
        height: calc(100vh - 20px);
        max-width: none;
        max-height: calc(100vh - 20px);
        min-width: auto;
        border-radius: 8px;
      }
    }

    #${OVERLAY_ID}.open {
      display: flex;
    }

    #${OVERLAY_ID}.dragging {
      opacity: 0.95;
    }

    /* Overlay header with controls */
    .repolens-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: #111827;
      border-bottom: 1px solid #374151;
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }

    .repolens-header:active {
      cursor: grabbing;
    }

    .repolens-header.dragging {
      cursor: grabbing;
      background: #1f2937;
    }

    .repolens-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .repolens-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }

    .repolens-logo svg {
      width: 20px;
      height: 20px;
      color: #3b82f6;
    }

    .repolens-repo-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #374151;
      border-radius: 6px;
      font-size: 12px;
      color: #d1d5db;
    }

    .repolens-header-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .repolens-header-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: #9ca3af;
      transition: all 0.15s ease;
    }

    .repolens-header-btn:hover {
      background: #374151;
      color: white;
    }

    .repolens-header-btn svg {
      width: 16px;
      height: 16px;
    }

    .repolens-header-btn.close:hover {
      background: #dc2626;
      color: white;
    }

    /* Resize handle */
    .repolens-resize {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      z-index: 10;
    }

    .repolens-resize::before {
      content: '';
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 10px;
      height: 10px;
      border-right: 2px solid #4b5563;
      border-bottom: 2px solid #4b5563;
    }

    /* Iframe container */
    .repolens-iframe-container {
      flex: 1;
      overflow: hidden;
      background: #0f172a;
    }

    #${IFRAME_ID} {
      width: 100%;
      height: 100%;
      border: none;
      background: #0f172a;
    }

    /* Loading state */
    .repolens-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #9ca3af;
      gap: 16px;
    }

    .repolens-loading svg {
      width: 48px;
      height: 48px;
      color: #3b82f6;
      animation: spin 1s linear infinite;
    }

    .repolens-loading-text {
      font-size: 14px;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Toast notifications */
    .repolens-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      padding: 12px 20px;
      background: #111827;
      color: white;
      border-radius: 10px;
      font-size: 13px;
      z-index: 10001;
      opacity: 0;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .repolens-toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    /* Minimized state */
    #${OVERLAY_ID}.minimized {
      width: 280px;
      height: 48px;
      min-width: 200px;
      min-height: 48px;
    }

    #${OVERLAY_ID}.minimized .repolens-iframe-container,
    #${OVERLAY_ID}.minimized .repolens-resize {
      display: none;
    }

    #${OVERLAY_ID}.minimized .repolens-header {
      border-bottom: none;
      border-radius: 12px;
    }

    @media (max-width: ${MOBILE_BREAKPOINT}px) {
      #${OVERLAY_ID}.minimized {
        width: calc(100vw - 20px);
        left: 10px;
        right: 10px;
      }
    }

    /* Mobile-specific header adjustments */
    @media (max-width: ${MOBILE_BREAKPOINT}px) {
      .repolens-header {
        padding: 8px 10px;
      }

      .repolens-logo span {
        display: none;
      }

      .repolens-repo-badge span {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `;

  // SVG Icons
  const icons = {
    search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    minus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    maximize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    loader: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
    git: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6"/></svg>',
    externalLink: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
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
      const match = pathname.match(/^\/(.+?)(?:\/-\/|$)/);
      if (match) {
        const projectPath = match[1].replace(/\/$/, '');
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
   * Create the floating trigger button
   */
  function createTriggerButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.innerHTML = `${icons.search} <span>RepoLens</span>`;
    
    // Click handler - toggle overlay
    let hasDragged = false;
    button.addEventListener('click', (e) => {
      if (!hasDragged) {
        toggleOverlay();
      }
      hasDragged = false;
    });

    // Make button draggable (with touch support)
    let isDragging = false;
    let startX, startY, initialX, initialY;

    const startDrag = (clientX, clientY) => {
      isDragging = true;
      hasDragged = false;
      startX = clientX;
      startY = clientY;
      const rect = button.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      button.classList.add('dragging');
    };

    const moveDrag = (clientX, clientY) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDragged = true;
      }

      const newX = initialX + dx;
      const newY = initialY + dy;
      const maxX = window.innerWidth - button.offsetWidth;
      const maxY = window.innerHeight - button.offsetHeight;

      button.style.right = 'auto';
      button.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      button.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    };

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        button.classList.remove('dragging');
      }
    };

    // Mouse events
    button.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', endDrag);

    // Touch events for mobile
    button.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      moveDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
      endDrag();
      // Trigger click if no drag occurred on touch
      if (!hasDragged) {
        toggleOverlay();
      }
      hasDragged = false;
    });

    document.addEventListener('touchcancel', endDrag);

    document.body.appendChild(button);
  }

  /**
   * Remove the trigger button
   */
  function removeTriggerButton() {
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.remove();
    }
  }

  /**
   * Create the overlay with embedded app
   */
  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }

    const repoInfo = parseRepoInfo();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
      <div class="repolens-header" id="repolens-drag-handle">
        <div class="repolens-header-left">
          <div class="repolens-logo">
            ${icons.search}
            <span>RepoLens</span>
          </div>
          ${repoInfo ? `
            <div class="repolens-repo-badge">
              ${icons.git}
              <span>${repoInfo.fullName}</span>
            </div>
          ` : ''}
        </div>
        <div class="repolens-header-right">
          <button class="repolens-header-btn" id="repolens-external" title="Open in new tab">
            ${icons.externalLink}
          </button>
          <button class="repolens-header-btn" id="repolens-minimize" title="Minimize">
            ${icons.minus}
          </button>
          <button class="repolens-header-btn close" id="repolens-close" title="Close">
            ${icons.x}
          </button>
        </div>
      </div>
      <div class="repolens-iframe-container" id="repolens-iframe-container">
        <div class="repolens-loading" id="repolens-loading">
          ${icons.loader}
          <span class="repolens-loading-text">Loading RepoLens...</span>
        </div>
      </div>
      <div class="repolens-resize" id="repolens-resize"></div>
    `;

    document.body.appendChild(overlay);

    // Bind event listeners
    document.getElementById('repolens-close').addEventListener('click', closeOverlay);
    document.getElementById('repolens-minimize').addEventListener('click', toggleMinimize);
    document.getElementById('repolens-external').addEventListener('click', openInNewTab);

    // Setup dragging
    setupOverlayDrag(overlay);

    // Setup resizing
    setupOverlayResize(overlay);
  }

  /**
   * Load the app iframe
   */
  function loadAppIframe() {
    const container = document.getElementById('repolens-iframe-container');
    const loading = document.getElementById('repolens-loading');
    
    // Check if iframe already exists
    if (document.getElementById(IFRAME_ID)) {
      return;
    }

    const repoInfo = parseRepoInfo();
    
    // Build the app URL with optional ingest parameter
    let appUrl = REPOLENS_APP_URL;
    if (repoInfo) {
      appUrl = `${REPOLENS_APP_URL}?ingest=${encodeURIComponent(repoInfo.url)}`;
    }

    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = appUrl;
    iframe.allow = 'clipboard-read; clipboard-write';
    
    iframe.addEventListener('load', () => {
      if (loading) {
        loading.style.display = 'none';
      }
    });

    container.appendChild(iframe);
  }

  /**
   * Setup overlay dragging (with touch support for mobile)
   */
  function setupOverlayDrag(overlay) {
    const header = document.getElementById('repolens-drag-handle');
    if (!header) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;

    const startDrag = (clientX, clientY) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;
      const rect = overlay.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      header.classList.add('dragging');
      overlay.classList.add('dragging');
    };

    const moveDrag = (clientX, clientY) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      const newX = initialX + dx;
      const newY = initialY + dy;
      const maxX = window.innerWidth - overlay.offsetWidth;
      const maxY = window.innerHeight - overlay.offsetHeight;

      overlay.style.right = 'auto';
      overlay.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
      overlay.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
    };

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        header.classList.remove('dragging');
        overlay.classList.remove('dragging');
      }
    };

    // Mouse events
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.repolens-header-btn')) return;
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', endDrag);

    // Touch events for mobile
    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('.repolens-header-btn')) return;
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      moveDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);
  }

  /**
   * Setup overlay resizing (with touch support for mobile)
   */
  function setupOverlayResize(overlay) {
    const resizeHandle = document.getElementById('repolens-resize');
    if (!resizeHandle) return;

    let isResizing = false;
    let startX, startY, initialWidth, initialHeight;

    const startResize = (clientX, clientY) => {
      isResizing = true;
      startX = clientX;
      startY = clientY;
      initialWidth = overlay.offsetWidth;
      initialHeight = overlay.offsetHeight;
    };

    const moveResize = (clientX, clientY) => {
      if (!isResizing) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      // Use smaller minimum width for mobile
      const minWidth = window.innerWidth <= MOBILE_BREAKPOINT ? 280 : 400;
      const minHeight = window.innerWidth <= MOBILE_BREAKPOINT ? 200 : 300;

      const newWidth = Math.max(minWidth, initialWidth + dx);
      const newHeight = Math.max(minHeight, initialHeight + dy);

      overlay.style.width = `${newWidth}px`;
      overlay.style.height = `${newHeight}px`;
    };

    const endResize = () => {
      if (isResizing) {
        isResizing = false;
      }
    };

    // Mouse events
    resizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      startResize(e.clientX, e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      moveResize(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', endResize);

    // Touch events for mobile
    resizeHandle.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startResize(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isResizing) return;
      const touch = e.touches[0];
      moveResize(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', endResize);
    document.addEventListener('touchcancel', endResize);
  }

  /**
   * Toggle overlay visibility
   */
  function toggleOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.classList.contains('open')) {
      closeOverlay();
    } else {
      openOverlay();
    }
  }

  /**
   * Open the overlay
   */
  function openOverlay() {
    createOverlay();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.add('open');
      loadAppIframe();
    }
  }

  /**
   * Close the overlay
   */
  function closeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('open');
    }
  }

  /**
   * Toggle minimize state
   */
  function toggleMinimize() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.toggle('minimized');
    }
  }

  /**
   * Open app in new tab
   */
  function openInNewTab() {
    const repoInfo = parseRepoInfo();
    let appUrl = REPOLENS_APP_URL;
    if (repoInfo) {
      appUrl = `${REPOLENS_APP_URL}?ingest=${encodeURIComponent(repoInfo.url)}`;
    }
    window.open(appUrl, '_blank');
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
      createTriggerButton();
    }

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isRepoPage()) {
          createTriggerButton();
        } else {
          removeTriggerButton();
          closeOverlay();
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
