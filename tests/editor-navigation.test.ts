import { isSameCourseEditorNavigation, shouldBlockEditorNavigation } from '@/lib/editor-navigation'

describe('shouldBlockEditorNavigation', () => {
  const currentUrl = 'http://localhost:3000/admin/courses/course-1/modules/module-1/edit'

  it('blocks sidebar navigation when the course editor has unsaved changes', () => {
    expect(shouldBlockEditorNavigation({
      isDirty: true,
      currentUrl,
      destination: '/admin/analytics',
    })).toBe(true)
  })

  it('does not block navigation between parts of the same course editor', () => {
    expect(shouldBlockEditorNavigation({
      isDirty: true,
      currentUrl,
      destination: '/admin/courses/course-1/styles/style-1/edit',
    })).toBe(false)
  })

  it('recognizes the course page, modules and styles as the same editor context', () => {
    expect(isSameCourseEditorNavigation(currentUrl, '/admin/courses/course-1/edit')).toBe(true)
    expect(isSameCourseEditorNavigation(currentUrl, '/admin/courses/course-1/modules/module-2/edit')).toBe(true)
    expect(isSameCourseEditorNavigation(currentUrl, '/admin/courses/course-2/modules/module-1/edit')).toBe(false)
  })

  it('treats the new module and style pages as the same editor context', () => {
    // These are siblings of /edit, not children: building them by appending to
    // the course editor URL produced /edit/styles/new, which is a 404.
    expect(isSameCourseEditorNavigation(currentUrl, '/admin/courses/course-1/styles/new')).toBe(true)
    expect(isSameCourseEditorNavigation(currentUrl, '/admin/courses/course-1/modules/new')).toBe(true)
    expect(isSameCourseEditorNavigation(currentUrl, '/admin/courses/course-1/edit/styles/new')).toBe(false)
  })

  it('does not block safe navigation cases', () => {
    expect(shouldBlockEditorNavigation({ isDirty: false, currentUrl, destination: '/admin/analytics' })).toBe(false)
    expect(shouldBlockEditorNavigation({ isDirty: true, currentUrl, destination: '#lecciones' })).toBe(false)
    expect(shouldBlockEditorNavigation({ isDirty: true, currentUrl, destination: '/admin/analytics', hasModifier: true })).toBe(false)
  })
})
