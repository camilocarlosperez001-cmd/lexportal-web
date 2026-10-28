export const AUTH_WEB_ORIGIN = 'https://lexportal.app';
export const AUTH_LINK_PATHS = { signup: '/auth/callback', recovery: '/recuperar-password' } as const;
export type AuthLinkPurpose = keyof typeof AUTH_LINK_PATHS;
export type AuthLinkPayload = { kind: 'none' } | { kind: 'error' } | { kind: 'hash'; tokenHash: string; type: 'email' | 'recovery' } | { kind: 'session'; accessToken: string; refreshToken: string };

/** No interpreta redirecciones `next`, no devuelve descripciones de error del enlace. */
export function parseAuthLink(url: string, purpose: AuthLinkPurpose): AuthLinkPayload {
  try {
    const parsed = new URL(url), query = parsed.searchParams, fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    if ([query, fragment].some(params => ['error', 'error_code', 'error_description'].some(key => params.has(key)))) return { kind: 'error' };
    const hashSources = [query, fragment].filter(params => params.has('token_hash'));
    if (hashSources.length) {
      if (hashSources.length !== 1 || [query, fragment].some(params => params.has('access_token') || params.has('refresh_token') || params.has('code'))) return { kind: 'error' };
      const params = hashSources[0], tokenHash = params.get('token_hash'), type = params.get('type');
      if (params.getAll('token_hash').length !== 1 || params.getAll('type').length !== 1 || !tokenHash || tokenHash.length > 2048 || /\s/.test(tokenHash) || type !== (purpose === 'signup' ? 'email' : 'recovery')) return { kind: 'error' };
      return { kind: 'hash', tokenHash, type: purpose === 'signup' ? 'email' : 'recovery' };
    }
    if (fragment.get('type') !== (purpose === 'signup' ? 'signup' : 'recovery')) return { kind: 'none' };
    const accessToken = fragment.get('access_token'), refreshToken = fragment.get('refresh_token');
    if (!accessToken || !refreshToken || fragment.getAll('access_token').length !== 1 || fragment.getAll('refresh_token').length !== 1 || fragment.getAll('type').length !== 1) return { kind: 'error' };
    return { kind: 'session', accessToken, refreshToken };
  } catch { return { kind: 'error' }; }
}

export function withoutAuthCredentials(url: string): string {
  const parsed = new URL(url);
  for (const key of ['token_hash', 'token', 'access_token', 'refresh_token', 'code', 'type', 'error', 'error_code', 'error_description', 'next']) parsed.searchParams.delete(key);
  return parsed.pathname + parsed.search;
}
