export function getApiBase(): string {
  const configuredBase = ((import.meta as any).env.VITE_API_BASE || '').trim();

  if (!configuredBase) return '';

  try {
    const configuredUrl = new URL(configuredBase);
    const isLocalhost =
      configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1';
    const isBrowserOnProduction =
      typeof window !== 'undefined' && window.location.hostname.endsWith('onrender.com');

    if (isBrowserOnProduction && isLocalhost) {
      return '';
    }

    return configuredBase.replace(/\/$/, '');
  } catch {
    return '';
  }
}
