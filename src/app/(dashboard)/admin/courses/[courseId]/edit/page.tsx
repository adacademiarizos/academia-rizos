import { CourseAdminTabs } from './CourseAdminTabs'

/**
 * The course-level admin view.
 *
 * This route used to render a 1700-line editor that predates the draft/publish
 * flow, so the course panel of CourseEditor — with "Lo que aprenderás" and the
 * publish pipeline — was written but unreachable. The old page is kept as
 * LegacyCourseEditorPage.tsx until this one is confirmed in use.
 */
export default function CourseEditPage() {
  return <CourseAdminTabs />
}
