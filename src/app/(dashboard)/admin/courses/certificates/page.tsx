import { CoursesTabs } from "../components/CoursesTabs";
import { CourseCertificatesView } from "../components/CourseCertificatesView";

export const dynamic = "force-dynamic";

export default async function AdminCourseCertificatesPage() {
  return (
    <div className="space-y-6">
      <CoursesTabs />
      <CourseCertificatesView />
    </div>
  );
}
