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

    /* Quick Action Toolbar */
    .repolens-toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 8px 12px;
      background: #111827;
      border-bottom: 1px solid #374151;
      flex-shrink: 0;
    }

    .repolens-toolbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: #9ca3af;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .repolens-toolbar-btn:hover {
      background: #374151;
      color: white;
    }

    .repolens-toolbar-btn.active {
      background: #3b82f6;
      color: white;
    }

    .repolens-toolbar-btn svg {
      width: 14px;
      height: 14px;
    }

    .repolens-toolbar-divider {
      width: 1px;
      height: 20px;
      background: #374151;
      margin: 0 6px;
    }

    /* Quick Search Bar */
    .repolens-quick-search {
      display: flex;
      align-items: center;
      flex: 1;
      max-width: 400px;
      margin: 0 8px;
    }

    .repolens-search-input-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 0 10px;
      transition: all 0.15s ease;
    }

    .repolens-search-input-wrapper:focus-within {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .repolens-search-input-wrapper svg {
      width: 14px;
      height: 14px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .repolens-search-input {
      flex: 1;
      padding: 8px;
      background: transparent;
      border: none;
      color: white;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }

    .repolens-search-input::placeholder {
      color: #6b7280;
    }

    .repolens-search-submit {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.15s ease;
    }

    .repolens-search-submit:hover {
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }

    .repolens-search-submit svg {
      width: 14px;
      height: 14px;
    }

    /* Keyboard shortcut hints */
    .repolens-shortcut {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 5px;
      background: #374151;
      border-radius: 4px;
      font-size: 10px;
      color: #9ca3af;
      font-family: ui-monospace, monospace;
    }

    /* Command Palette */
    .repolens-command-palette {
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 500px;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      z-index: 100;
      display: none;
      overflow: hidden;
    }

    .repolens-command-palette.open {
      display: block;
    }

    .repolens-command-input-wrapper {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #374151;
      gap: 10px;
    }

    .repolens-command-input-wrapper svg {
      width: 18px;
      height: 18px;
      color: #6b7280;
    }

    .repolens-command-input {
      flex: 1;
      padding: 4px 0;
      background: transparent;
      border: none;
      color: white;
      font-size: 15px;
      font-family: inherit;
      outline: none;
    }

    .repolens-command-input::placeholder {
      color: #6b7280;
    }

    .repolens-command-list {
      max-height: 300px;
      overflow-y: auto;
      padding: 8px;
    }

    .repolens-command-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      color: #d1d5db;
      transition: all 0.1s ease;
    }

    .repolens-command-item:hover,
    .repolens-command-item.selected {
      background: #374151;
      color: white;
    }

    .repolens-command-item svg {
      width: 16px;
      height: 16px;
      color: #9ca3af;
    }

    .repolens-command-item:hover svg,
    .repolens-command-item.selected svg {
      color: #3b82f6;
    }

    .repolens-command-item-text {
      flex: 1;
    }

    .repolens-command-item-title {
      font-size: 13px;
      font-weight: 500;
    }

    .repolens-command-item-desc {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }

    .repolens-command-group-title {
      padding: 8px 12px 4px;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Status Bar */
    .repolens-status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #0f172a;
      border-top: 1px solid #374151;
      font-size: 11px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .repolens-status-left,
    .repolens-status-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .repolens-status-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .repolens-status-item svg {
      width: 12px;
      height: 12px;
    }

    .repolens-status-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
    }

    .repolens-status-indicator.loading {
      background: #f59e0b;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .repolens-status-indicator.ready {
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
    }

    .repolens-status-indicator.error {
      background: #ef4444;
      box-shadow: 0 0 6px #ef4444;
    }

    /* Minimized state */
    #${OVERLAY_ID}.minimized {
      width: 280px;
      height: 48px;
      min-width: 200px;
      min-height: 48px;
    }

    #${OVERLAY_ID}.minimized .repolens-iframe-container,
    #${OVERLAY_ID}.minimized .repolens-resize,
    #${OVERLAY_ID}.minimized .repolens-toolbar,
    #${OVERLAY_ID}.minimized .repolens-status-bar,
    #${OVERLAY_ID}.minimized .repolens-command-palette {
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

      .repolens-toolbar {
        flex-wrap: wrap;
        padding: 6px 8px;
      }

      .repolens-toolbar-btn span {
        display: none;
      }

      .repolens-quick-search {
        order: 10;
        flex-basis: 100%;
        max-width: none;
        margin: 8px 0 0;
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
    // New icons for overlay controls
    files: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
    code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    message: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    layers: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    refresh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    send: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    command: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    keyboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>',
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

    // Touch events for mobile - track if touch started on button
    let touchStartedOnButton = false;

    button.addEventListener('touchstart', (e) => {
      if (!e.touches.length) return;
      touchStartedOnButton = true;
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!e.touches.length || !isDragging) return;
      const touch = e.touches[0];
      moveDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
      // Only toggle overlay if touch started on button and no drag occurred
      if (touchStartedOnButton && !hasDragged) {
        toggleOverlay();
      }
      endDrag();
      touchStartedOnButton = false;
      hasDragged = false;
    });

    document.addEventListener('touchcancel', () => {
      endDrag();
      touchStartedOnButton = false;
      hasDragged = false;
    });

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

      <!-- Quick Action Toolbar -->
      <div class="repolens-toolbar" id="repolens-toolbar">
        <button class="repolens-toolbar-btn active" id="repolens-nav-files" title="Browse Files (F)">
          ${icons.files}
          <span>Files</span>
        </button>
        <button class="repolens-toolbar-btn" id="repolens-nav-symbols" title="Symbols (S)">
          ${icons.code}
          <span>Symbols</span>
        </button>
        <button class="repolens-toolbar-btn" id="repolens-nav-arch" title="Architecture (A)">
          ${icons.layers}
          <span>Arch</span>
        </button>
        <button class="repolens-toolbar-btn" id="repolens-nav-query" title="Ask AI (Q)">
          ${icons.message}
          <span>Ask</span>
        </button>
        
        <div class="repolens-toolbar-divider"></div>
        
        <button class="repolens-toolbar-btn" id="repolens-refresh" title="Refresh (R)">
          ${icons.refresh}
        </button>
        <button class="repolens-toolbar-btn" id="repolens-settings" title="Settings">
          ${icons.settings}
        </button>
        
        <div class="repolens-toolbar-divider"></div>
        
        <!-- Quick Search Bar -->
        <div class="repolens-quick-search">
          <div class="repolens-search-input-wrapper">
            ${icons.search}
            <input type="text" class="repolens-search-input" id="repolens-search-input" 
                   placeholder="Ask about this repo... (⌘K)" />
            <button class="repolens-search-submit" id="repolens-search-submit" title="Send">
              ${icons.send}
            </button>
          </div>
        </div>
      </div>

      <!-- Command Palette -->
      <div class="repolens-command-palette" id="repolens-command-palette">
        <div class="repolens-command-input-wrapper">
          ${icons.command}
          <input type="text" class="repolens-command-input" id="repolens-command-input" 
                 placeholder="Type a command or search..." />
        </div>
        <div class="repolens-command-list" id="repolens-command-list">
          <div class="repolens-command-group-title">Navigation</div>
          <div class="repolens-command-item" data-action="nav-files">
            ${icons.files}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">Browse Files</div>
              <div class="repolens-command-item-desc">Explore repository file structure</div>
            </div>
            <span class="repolens-shortcut">F</span>
          </div>
          <div class="repolens-command-item" data-action="nav-symbols">
            ${icons.code}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">View Symbols</div>
              <div class="repolens-command-item-desc">Functions, classes, variables</div>
            </div>
            <span class="repolens-shortcut">S</span>
          </div>
          <div class="repolens-command-item" data-action="nav-arch">
            ${icons.layers}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">Architecture</div>
              <div class="repolens-command-item-desc">View system architecture</div>
            </div>
            <span class="repolens-shortcut">A</span>
          </div>
          <div class="repolens-command-item" data-action="nav-query">
            ${icons.message}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">Ask AI</div>
              <div class="repolens-command-item-desc">Query the repository with AI</div>
            </div>
            <span class="repolens-shortcut">Q</span>
          </div>
          
          <div class="repolens-command-group-title">Actions</div>
          <div class="repolens-command-item" data-action="refresh">
            ${icons.refresh}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">Refresh</div>
              <div class="repolens-command-item-desc">Re-ingest current repository</div>
            </div>
            <span class="repolens-shortcut">R</span>
          </div>
          <div class="repolens-command-item" data-action="settings">
            ${icons.settings}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">Settings</div>
              <div class="repolens-command-item-desc">Configure LLM and preferences</div>
            </div>
          </div>
          <div class="repolens-command-item" data-action="external">
            ${icons.externalLink}
            <div class="repolens-command-item-text">
              <div class="repolens-command-item-title">Open in New Tab</div>
              <div class="repolens-command-item-desc">Launch RepoLens in full window</div>
            </div>
          </div>
        </div>
      </div>

      <div class="repolens-iframe-container" id="repolens-iframe-container">
        <div class="repolens-loading" id="repolens-loading">
          ${icons.loader}
          <span class="repolens-loading-text">Loading RepoLens...</span>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="repolens-status-bar" id="repolens-status-bar">
        <div class="repolens-status-left">
          <div class="repolens-status-item">
            <span class="repolens-status-indicator" id="repolens-status-indicator"></span>
            <span id="repolens-status-text">Ready</span>
          </div>
        </div>
        <div class="repolens-status-right">
          <div class="repolens-status-item">
            ${icons.keyboard}
            <span>⌘K for commands</span>
          </div>
        </div>
      </div>

      <div class="repolens-resize" id="repolens-resize"></div>
    `;

    document.body.appendChild(overlay);

    // Bind event listeners
    document.getElementById('repolens-close').addEventListener('click', closeOverlay);
    document.getElementById('repolens-minimize').addEventListener('click', toggleMinimize);
    document.getElementById('repolens-external').addEventListener('click', openInNewTab);

    // Toolbar navigation buttons
    setupToolbarNavigation();
    
    // Command palette
    setupCommandPalette();
    
    // Quick search
    setupQuickSearch();
    
    // Keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup dragging
    setupOverlayDrag(overlay);

    // Setup resizing
    setupOverlayResize(overlay);
  }

  /**
   * Setup toolbar navigation buttons
   */
  function setupToolbarNavigation() {
    const navButtons = {
      'repolens-nav-files': 'files',
      'repolens-nav-symbols': 'symbols',
      'repolens-nav-arch': 'architecture',
      'repolens-nav-query': 'query',
      'repolens-settings': 'settings',
    };

    Object.entries(navButtons).forEach(([btnId, panel]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          navigateToPanel(panel);
          updateActiveNavButton(btnId);
        });
      }
    });

    const refreshBtn = document.getElementById('repolens-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshRepository();
      });
    }
  }

  /**
   * Update active nav button styling
   */
  function updateActiveNavButton(activeBtnId) {
    const navBtns = ['repolens-nav-files', 'repolens-nav-symbols', 'repolens-nav-arch', 'repolens-nav-query'];
    navBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', id === activeBtnId);
      }
    });
  }

  /**
   * Navigate to a specific panel in the app
   */
  function navigateToPanel(panel) {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'REPOLENS_NAVIGATE', panel }, '*');
    }
    updateStatus(`Navigated to ${panel}`);
  }

  /**
   * Refresh/re-ingest the repository
   */
  function refreshRepository() {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe) {
      const repoInfo = parseRepoInfo();
      if (repoInfo) {
        updateStatus('Refreshing repository...', true);
        iframe.src = `${REPOLENS_APP_URL}?ingest=${encodeURIComponent(repoInfo.url)}&refresh=true`;
      }
    }
  }

  /**
   * Update status bar
   */
  function updateStatus(message, loading = false) {
    const statusText = document.getElementById('repolens-status-text');
    const indicator = document.getElementById('repolens-status-indicator');
    
    if (statusText) {
      statusText.textContent = message;
    }
    if (indicator) {
      indicator.classList.toggle('loading', loading);
    }
    
    // Reset to "Ready" after 3 seconds if not loading
    if (!loading) {
      setTimeout(() => {
        if (statusText && statusText.textContent === message) {
          statusText.textContent = 'Ready';
        }
      }, 3000);
    }
  }

  /**
   * Setup command palette
   */
  function setupCommandPalette() {
    const palette = document.getElementById('repolens-command-palette');
    const input = document.getElementById('repolens-command-input');
    const commandList = document.getElementById('repolens-command-list');
    
    if (!palette || !input) return;

    let selectedIndex = 0;
    const commands = commandList.querySelectorAll('.repolens-command-item');

    // Filter commands as user types
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      commands.forEach(cmd => {
        const title = cmd.querySelector('.repolens-command-item-title')?.textContent.toLowerCase() || '';
        const desc = cmd.querySelector('.repolens-command-item-desc')?.textContent.toLowerCase() || '';
        const matches = title.includes(query) || desc.includes(query);
        cmd.style.display = matches ? 'flex' : 'none';
      });
      selectedIndex = 0;
      updateCommandSelection();
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      const visibleCommands = [...commands].filter(c => c.style.display !== 'none');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, visibleCommands.length - 1);
        updateCommandSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateCommandSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visibleCommands[selectedIndex]) {
          executeCommand(visibleCommands[selectedIndex].dataset.action);
        }
      } else if (e.key === 'Escape') {
        toggleCommandPalette(false);
      }
    });

    function updateCommandSelection() {
      const visibleCommands = [...commands].filter(c => c.style.display !== 'none');
      commands.forEach(cmd => cmd.classList.remove('selected'));
      if (visibleCommands[selectedIndex]) {
        visibleCommands[selectedIndex].classList.add('selected');
      }
    }

    // Click to execute command
    commands.forEach(cmd => {
      cmd.addEventListener('click', () => {
        executeCommand(cmd.dataset.action);
      });
    });
  }

  /**
   * Toggle command palette visibility
   */
  function toggleCommandPalette(show) {
    const palette = document.getElementById('repolens-command-palette');
    const input = document.getElementById('repolens-command-input');
    
    if (!palette) return;
    
    if (show === undefined) {
      show = !palette.classList.contains('open');
    }
    
    palette.classList.toggle('open', show);
    
    if (show && input) {
      input.value = '';
      input.focus();
      // Reset visibility of all commands
      const commands = document.querySelectorAll('.repolens-command-item');
      commands.forEach(cmd => cmd.style.display = 'flex');
    }
  }

  /**
   * Execute a command from the palette
   */
  function executeCommand(action) {
    toggleCommandPalette(false);
    
    const actionMap = {
      'nav-files': () => { navigateToPanel('files'); updateActiveNavButton('repolens-nav-files'); },
      'nav-symbols': () => { navigateToPanel('symbols'); updateActiveNavButton('repolens-nav-symbols'); },
      'nav-arch': () => { navigateToPanel('architecture'); updateActiveNavButton('repolens-nav-arch'); },
      'nav-query': () => { navigateToPanel('query'); updateActiveNavButton('repolens-nav-query'); },
      'refresh': refreshRepository,
      'settings': () => navigateToPanel('settings'),
      'external': openInNewTab,
    };
    
    if (actionMap[action]) {
      actionMap[action]();
    }
  }

  /**
   * Setup quick search functionality
   */
  function setupQuickSearch() {
    const input = document.getElementById('repolens-search-input');
    const submitBtn = document.getElementById('repolens-search-submit');
    
    if (!input) return;

    const submitSearch = () => {
      const query = input.value.trim();
      if (query) {
        sendQueryToApp(query);
        input.value = '';
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSearch();
      }
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', submitSearch);
    }

    // Focus on ⌘K or Ctrl+K
    input.addEventListener('focus', () => {
      // Navigate to query panel when focused
      navigateToPanel('query');
      updateActiveNavButton('repolens-nav-query');
    });
  }

  /**
   * Send a query to the app
   */
  function sendQueryToApp(query) {
    const iframe = document.getElementById(IFRAME_ID);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'REPOLENS_QUERY', query }, '*');
      updateStatus('Sending query...');
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const overlay = document.getElementById(OVERLAY_ID);
      if (!overlay || !overlay.classList.contains('open')) return;
      
      // Only handle shortcuts when not typing in an input
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      
      // ⌘K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }
      
      // Escape to close command palette or overlay
      if (e.key === 'Escape') {
        const palette = document.getElementById('repolens-command-palette');
        if (palette && palette.classList.contains('open')) {
          toggleCommandPalette(false);
        } else {
          closeOverlay();
        }
        return;
      }
      
      // Navigation shortcuts (only when not typing)
      if (!isTyping) {
        const shortcuts = {
          'f': () => { navigateToPanel('files'); updateActiveNavButton('repolens-nav-files'); },
          's': () => { navigateToPanel('symbols'); updateActiveNavButton('repolens-nav-symbols'); },
          'a': () => { navigateToPanel('architecture'); updateActiveNavButton('repolens-nav-arch'); },
          'q': () => { navigateToPanel('query'); updateActiveNavButton('repolens-nav-query'); },
          'r': refreshRepository,
        };
        
        if (shortcuts[e.key.toLowerCase()]) {
          e.preventDefault();
          shortcuts[e.key.toLowerCase()]();
        }
      }
    });
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
      if (!e.touches.length) return;
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!e.touches.length || !isDragging) return;
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
    let isMobile = false;

    const startResize = (clientX, clientY) => {
      isResizing = true;
      startX = clientX;
      startY = clientY;
      initialWidth = overlay.offsetWidth;
      initialHeight = overlay.offsetHeight;
      // Cache mobile check at start of resize to avoid repeated layout queries
      isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    };

    const moveResize = (clientX, clientY) => {
      if (!isResizing) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      // Use smaller minimum width for mobile (cached at start)
      const minWidth = isMobile ? 280 : 400;
      const minHeight = isMobile ? 200 : 300;

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
      if (!e.touches.length) return;
      const touch = e.touches[0];
      startResize(touch.clientX, touch.clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!e.touches.length || !isResizing) return;
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
   * Setup listener for messages from the iframe app
   */
  function setupIframeMessageListener() {
    window.addEventListener('message', (event) => {
      // Only accept messages from our iframe
      const iframe = document.getElementById(IFRAME_ID);
      if (!iframe || event.source !== iframe.contentWindow) return;

      const { type, status, loading, hasRepository, repositoryName, error, ready } = event.data || {};

      if (type === 'REPOLENS_STATUS') {
        // Update status bar with message from app
        updateStatus(status, loading);

        // Update the repo badge if repository info is provided
        if (hasRepository && repositoryName) {
          const badge = document.querySelector('.repolens-repo-badge span');
          if (badge) {
            badge.textContent = repositoryName;
          }
        }

        // Show/hide ready indicator
        const indicator = document.getElementById('repolens-status-indicator');
        if (indicator) {
          indicator.classList.toggle('ready', ready && !loading && !error);
          indicator.classList.toggle('error', !!error);
        }
      }
    });
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

    // Setup message listener for iframe communication
    setupIframeMessageListener();

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
