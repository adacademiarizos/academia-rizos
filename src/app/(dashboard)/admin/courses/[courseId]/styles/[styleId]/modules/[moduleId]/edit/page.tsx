import { redirect } from 'next/navigation'

export default async function LegacyCourseStyleModuleEditPage({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params
  redirect(`/admin/courses/${courseId}/modules/${moduleId}/edit`)
}
