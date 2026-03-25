import { CoursesTabs } from "../components/CoursesTabs";
import { CourseExamReviewView } from "../components/CourseExamReviewView";

export const dynamic = "force-dynamic";

export default async function AdminCourseReviewPage() {
  return (
    <div className="space-y-6">
      <CoursesTabs />
      <CourseExamReviewView />
    </div>
  );
}
