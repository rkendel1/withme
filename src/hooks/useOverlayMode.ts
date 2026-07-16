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
