// Where the StudyFlow backend lives.
//
// - Web (the website): same-origin by default. In development the Vite dev
//   server proxies /api/* to the backend; in a deployed build the backend
//   serves both the site and the API (see backend/ Dockerfile), so relative
//   /api/* just works. VITE_API_URL can point at a separate hosted backend.
// - Desktop (Tauri build): the packaged app has no dev server, so it calls
//   the local backend directly (VITE_API_URL overrides this).
const isTauri = typeof import.meta.env.TAURI_ENV_PLATFORM !== 'undefined'
const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787'

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'StudyFlow',
  version: import.meta.env.VITE_APP_VERSION || '0.1.0',
  isDevelopment: import.meta.env.DEV || import.meta.env.VITE_DEVELOPMENT_MODE === 'true',
  downloadUrl: import.meta.env.VITE_WINDOWS_DOWNLOAD_URL || '',
  downloadReady: import.meta.env.VITE_WINDOWS_DOWNLOAD_READY === 'true',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  /**
   * Base for /api calls. Empty string = same-origin (the Vite dev proxy, or
   * the backend serving the website in a deployed build). The Tauri desktop
   * app calls the local backend at http://127.0.0.1:8787.
   */
  apiBase: import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : isTauri ? backendUrl : '',
  /**
   * Loopback redirect for Google's desktop OAuth flow. The consent page
   * redirects here; the backend serves the callback page that hands the code
   * back to the app window. Web builds default to same-origin /oauth/callback
   * (served by the backend); Tauri uses the local backend. Override with
   * VITE_GOOGLE_REDIRECT_URI when using a Web OAuth client with a registered
   * redirect URI.
   */
  oauthRedirectUri:
    import.meta.env.VITE_GOOGLE_REDIRECT_URI || (isTauri ? `${backendUrl}/oauth/callback` : `${window.location.origin}/oauth/callback`),
} as const
