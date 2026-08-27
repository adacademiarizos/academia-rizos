/**
 * Canonical, visible mention tokens used by the community UI.
 *
 * The token carries the stable user id so the server can validate it against
 * the current course or chat context. Display code should always render the
 * label only; the identifier is never presented as community content.
 */
const mentionTokenPattern = /@\[([^\]\r\n]{1,80})\]\(([A-Za-z0-9_-]{1,80})\)/g

export type MentionableCommunityUser = {
  id: string
  name: string | null
  email: string
}

export type CommunityTextToken =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; label: string; userId: string }

function mentionLabel(user: MentionableCommunityUser) {
  const fallback = user.email.split('@')[0] || 'usuario'
  const label = (user.name || fallback)
    .replace(/[\[\]\(\)\r\n]/g, '')
    .trim()
    .slice(0, 80)

  return label || 'usuario'
}

/** Creates a mention that can be parsed and authoritatively checked on the server. */
export function createCommunityMentionToken(user: MentionableCommunityUser) {
  return `@[${mentionLabel(user)}](${user.id})`
}

/** Extracts unique, canonical mention ids without trusting arbitrary client fields. */
export function extractCommunityMentionUserIds(body: string) {
  const userIds = new Set<string>()
  const matcher = new RegExp(mentionTokenPattern)
  let match: RegExpExecArray | null

  while ((match = matcher.exec(body)) !== null) {
    userIds.add(match[2])
  }

  return [...userIds]
}

/** Splits user-generated text into safe display tokens without using HTML. */
export function parseCommunityText(body: string): CommunityTextToken[] {
  const tokens: CommunityTextToken[] = []
  const matcher = new RegExp(mentionTokenPattern)
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = matcher.exec(body)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: body.slice(lastIndex, match.index) })
    }

    tokens.push({ kind: 'mention', label: match[1], userId: match[2] })
    lastIndex = matcher.lastIndex
  }

  if (lastIndex < body.length || tokens.length === 0) {
    tokens.push({ kind: 'text', value: body.slice(lastIndex) })
  }

  return tokens
}
