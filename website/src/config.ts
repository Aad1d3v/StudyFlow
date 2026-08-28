export const WEBSITE_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'StudyFlow',
  version: import.meta.env.VITE_APP_VERSION || '0.1.0',
  downloadUrl: import.meta.env.VITE_WINDOWS_DOWNLOAD_URL || '',
  downloadReady: import.meta.env.VITE_WINDOWS_DOWNLOAD_READY === 'true' && Boolean(import.meta.env.VITE_WINDOWS_DOWNLOAD_URL),
} as const
