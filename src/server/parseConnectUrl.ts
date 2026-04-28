export function parseConnectUrl(ccUrl: string): {
  serverUrl: string
  authToken: string
} {
  if (ccUrl.startsWith('cc+unix://')) {
    const raw = ccUrl.slice('cc+unix://'.length)
    const atIndex = raw.indexOf('@')
    if (atIndex === -1) {
      return { serverUrl: raw, authToken: '' }
    }

    return {
      authToken: decodeURIComponent(raw.slice(0, atIndex)),
      serverUrl: decodeURIComponent(raw.slice(atIndex + 1)),
    }
  }

  const parsed = new URL(ccUrl)
  const authToken =
    decodeURIComponent(parsed.username) ||
    parsed.searchParams.get('token') ||
    parsed.searchParams.get('authToken') ||
    ''

  const protocol = parsed.protocol === 'cc:' ? 'http:' : parsed.protocol
  const pathname = `${parsed.pathname}${parsed.search}${parsed.hash}`

  return {
    authToken,
    serverUrl: `${protocol}//${parsed.host}${pathname}`,
  }
}
