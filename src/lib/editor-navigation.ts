export interface EditorNavigationRequest {
  isDirty: boolean
  currentUrl: string
  destination: string
  hasModifier?: boolean
}

// The `new` module and style pages belong to the same editing flow as the
// `edit` ones: reaching them saves the draft instead of prompting to leave.
function courseEditorId(pathname: string) {
  const match = pathname.match(/^\/admin\/courses\/([^/]+)\/(?:edit|modules\/new|styles\/new|modules\/[^/]+\/edit|styles\/[^/]+\/edit|modules\/[^/]+\/styles\/[^/]+\/edit)$/)
  return match?.[1] ?? null
}

export function isSameCourseEditorNavigation(currentUrl: string, destination: string) {
  const current = new URL(currentUrl)
  const next = new URL(destination, current)
  const currentCourseId = courseEditorId(current.pathname)
  const nextCourseId = courseEditorId(next.pathname)
  return Boolean(currentCourseId && nextCourseId && currentCourseId === nextCourseId)
}

export function shouldBlockEditorNavigation({ isDirty, currentUrl, destination, hasModifier = false }: EditorNavigationRequest) {
  if (!isDirty || hasModifier || !destination || destination.startsWith('#')) return false

  const current = new URL(currentUrl)
  const next = new URL(destination, current)

  if (current.origin !== next.origin) return false
  if (isSameCourseEditorNavigation(currentUrl, destination)) return false
  return current.pathname !== next.pathname || current.search !== next.search
}
