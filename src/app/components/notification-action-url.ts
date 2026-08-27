const INTERNAL_ACTION_ORIGIN = 'https://notifications.apoteosicas.local'

/**
 * Returns a path that can be safely handed to Next.js routing.
 * Notification payloads are data, so external and malformed URLs never become
 * clickable navigation targets in the client.
 */
export function getSafeNotificationActionUrl(actionUrl?: string | null): string | null {
  if (typeof actionUrl !== 'string') {
    return null
  }

  const candidate = actionUrl.trim()

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null
  }

  try {
    const url = new URL(candidate, INTERNAL_ACTION_ORIGIN)

    if (url.origin !== INTERNAL_ACTION_ORIGIN) {
      return null
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
