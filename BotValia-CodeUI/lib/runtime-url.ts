export const RUNTIME_URL_QUERY_PARAM = 'runtime';
export const RUNTIME_AUTH_TOKEN_PARAM = 'runtimeToken';

export type RuntimeLaunchConfig = {
  runtimeUrl: string | null;
  runtimeAuthToken: string | null;
};

export function normalizeRuntimeUrl(rawUrl: string | null | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(trimmed, base);

    if (parsed.protocol === 'http:') {
      parsed.protocol = 'ws:';
    } else if (parsed.protocol === 'https:') {
      parsed.protocol = 'wss:';
    }

    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return null;
    }

    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractRuntimeAuthToken(
  rawUrl: string | null | undefined,
): string | null {
  const normalized = normalizeRuntimeUrl(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).searchParams.get(RUNTIME_AUTH_TOKEN_PARAM);
  } catch {
    return null;
  }
}

export function stripRuntimeAuthToken(
  rawUrl: string | null | undefined,
): string | null {
  const normalized = normalizeRuntimeUrl(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    parsed.searchParams.delete(RUNTIME_AUTH_TOKEN_PARAM);
    return parsed.toString();
  } catch {
    return normalized;
  }
}

export function withRuntimeAuthToken(
  rawUrl: string | null | undefined,
  authToken: string | null | undefined,
): string | null {
  const sanitizedUrl = stripRuntimeAuthToken(rawUrl);
  if (!sanitizedUrl) {
    return null;
  }

  if (!authToken?.trim()) {
    return sanitizedUrl;
  }

  try {
    const parsed = new URL(sanitizedUrl);
    parsed.searchParams.set(RUNTIME_AUTH_TOKEN_PARAM, authToken.trim());
    return parsed.toString();
  } catch {
    return sanitizedUrl;
  }
}

function readHashSearchParams(rawHash: string): URLSearchParams {
  const trimmedHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  return new URLSearchParams(trimmedHash);
}

export function readRuntimeLaunchConfigFromLocation(
  locationLike:
    | Pick<Location, 'search' | 'hash'>
    | Pick<URL, 'search' | 'hash'>,
): RuntimeLaunchConfig {
  const searchParams = new URLSearchParams(locationLike.search);
  const hashParams = readHashSearchParams(locationLike.hash);
  const runtimeUrl =
    stripRuntimeAuthToken(searchParams.get(RUNTIME_URL_QUERY_PARAM)) ||
    stripRuntimeAuthToken(hashParams.get(RUNTIME_URL_QUERY_PARAM));
  const runtimeAuthToken =
    hashParams.get(RUNTIME_AUTH_TOKEN_PARAM) ||
    searchParams.get(RUNTIME_AUTH_TOKEN_PARAM) ||
    extractRuntimeAuthToken(searchParams.get(RUNTIME_URL_QUERY_PARAM)) ||
    extractRuntimeAuthToken(hashParams.get(RUNTIME_URL_QUERY_PARAM));

  return {
    runtimeUrl,
    runtimeAuthToken,
  };
}

export function clearRuntimeLaunchParamsFromBrowserUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const nextUrl = new URL(currentUrl.toString());

  nextUrl.searchParams.delete(RUNTIME_URL_QUERY_PARAM);
  nextUrl.searchParams.delete(RUNTIME_AUTH_TOKEN_PARAM);

  const hashParams = readHashSearchParams(nextUrl.hash);
  const hadHashRuntimeConfig =
    hashParams.has(RUNTIME_URL_QUERY_PARAM) ||
    hashParams.has(RUNTIME_AUTH_TOKEN_PARAM);
  if (hadHashRuntimeConfig) {
    hashParams.delete(RUNTIME_URL_QUERY_PARAM);
    hashParams.delete(RUNTIME_AUTH_TOKEN_PARAM);
    nextUrl.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
  }

  if (nextUrl.toString() === currentUrl.toString()) {
    return;
  }

  window.history.replaceState(window.history.state, document.title, nextUrl.toString());
}

export function getRuntimeStorageScope(
  runtimeUrl: string | null | undefined,
): string | null {
  const normalized = normalizeRuntimeUrl(runtimeUrl);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return normalized;
  }
}
