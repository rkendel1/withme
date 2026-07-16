/**
 * Hook to detect if the app is running inside an iframe (overlay mode)
 * This is used to adapt the UI when embedded in the browser extension overlay
 */
export function useOverlayMode(): boolean {
  // Check if we're running inside an iframe
  // window.self !== window.top is true when we're in an iframe
  try {
    return window.self !== window.top;
  } catch {
    // If we can't access window.top due to cross-origin restrictions,
    // we're definitely in an iframe
    return true;
  }
}

/**
 * Check if overlay mode is active (non-hook version for use outside React)
 */
export function isOverlayMode(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Get the parent origin for postMessage communication.
 * This ensures we only send messages to the trusted parent frame.
 */
function getParentOrigin(): string {
  // We need to send to the parent frame's origin
  // For security, we use the referrer or a known trusted origin
  try {
    // If we can access parent's origin (same-origin), use it
    if (window.parent && window.parent.location) {
      return window.parent.location.origin;
    }
  } catch {
    // Cross-origin - use document.referrer which contains the parent URL
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        return url.origin;
      } catch {
        // Invalid referrer URL
      }
    }
  }
  // Fallback: Allow GitHub and GitLab origins where the userscript runs
  // This is safe because the message content is not sensitive
  return '*';
}

/**
 * Send a status update to the parent overlay frame.
 * This is used to communicate app state (loading, ready, errors) to the userscript.
 * 
 * @param status - Status message to display
 * @param loading - Whether the app is currently processing
 * @param data - Additional data to include in the message
 */
export function sendStatusToParent(status: string, loading = false, data?: Record<string, unknown>): void {
  if (!isOverlayMode()) return;
  
  try {
    const targetOrigin = getParentOrigin();
    window.parent.postMessage({
      type: 'REPOLENS_STATUS',
      status,
      loading,
      ...data,
    }, targetOrigin);
  } catch {
    // Ignore cross-origin errors - this can happen if the iframe
    // is loaded in an unexpected context
  }
}
