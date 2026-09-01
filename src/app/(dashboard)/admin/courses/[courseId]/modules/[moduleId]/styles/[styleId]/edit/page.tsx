import { redirect } from 'next/navigation'

export default async function LegacyStyleEditPage({ params }: { params: Promise<{ courseId: string; moduleId: string; styleId: string }> }) {
  const { courseId, styleId } = await params
  redirect(`/admin/courses/${courseId}/styles/${styleId}/edit`)
}
