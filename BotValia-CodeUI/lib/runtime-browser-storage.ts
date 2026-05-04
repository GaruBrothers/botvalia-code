function getStorage(kind: 'session' | 'local'): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readBrowserStorage(
  key: string,
  kind: 'session' | 'local' = 'session',
): string | null {
  try {
    return getStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeBrowserStorage(
  key: string,
  value: string,
  kind: 'session' | 'local' = 'session',
): void {
  try {
    getStorage(kind)?.setItem(key, value);
  } catch {
    // ignore storage failures in privacy-restricted browsers
  }
}

export function removeBrowserStorage(
  key: string,
  kind: 'session' | 'local' = 'session',
): void {
  try {
    getStorage(kind)?.removeItem(key);
  } catch {
    // ignore storage failures in privacy-restricted browsers
  }
}
