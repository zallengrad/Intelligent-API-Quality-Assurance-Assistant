// Shared VS Code API instance for all components
// IMPORTANT: acquireVsCodeApi() can only be called ONCE per webview
// This module ensures we have a single instance shared across all components

declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

let vsCodeApi: ReturnType<typeof acquireVsCodeApi> | undefined;

// Acquire the API once when this module is first imported
try {
  if (typeof acquireVsCodeApi !== 'undefined') {
    vsCodeApi = acquireVsCodeApi();
    console.log('[VS Code API] Acquired successfully');
  } else {
    console.warn('[VS Code API] acquireVsCodeApi is not defined');
  }
} catch (error) {
  console.error('[VS Code API] Error acquiring API:', error);
}

// Export function to get the API instance
export function getVsCodeApi() {
  return vsCodeApi;
}

// Export function to check if API is available
export function isVsCodeApiAvailable(): boolean {
  return vsCodeApi !== undefined;
}
