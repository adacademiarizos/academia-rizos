import { db } from "@/lib/db";
import { CourseTestReviewCard, ExamReviewCard } from "@/app/(dashboard)/admin/certificates/review/ReviewActions";

export async function CourseExamReviewView() {
  const courseTestPending = await db.courseTestSubmission.findMany({
    where: {
      status: "PENDING",
      courseTest: { isFinalExam: true },
    },
    include: {
      user: { select: { name: true, email: true } },
      courseTest: {
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { title: true } },
        },
      },
      answers: {
        include: {
          question: { select: { title: true, type: true } },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  const examPending = await db.examSubmission.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { name: true, email: true } },
      exam: {
        select: {
          courseId: true,
          course: { select: { title: true } },
        },
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  const totalPending = courseTestPending.length + examPending.length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-white">Revision de examenes finales</h1>
          {totalPending > 0 && (
            <span className="rounded-full bg-ap-copper/20 border border-ap-copper/30 px-2.5 py-0.5 text-xs font-semibold text-ap-copper">
              {totalPending} pendiente{totalPending !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-sm text-white/50">
          Revisa las respuestas y evidencias antes de emitir el certificado.
        </p>
      </div>

      {totalPending === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/40">
          No hay examenes pendientes de revision.
        </div>
      )}

      {courseTestPending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Pruebas finales ({courseTestPending.length})
          </h2>
          <div className="space-y-3">
            {courseTestPending.map((sub) => (
              <CourseTestReviewCard
                key={sub.id}
                item={{
                  id: sub.id,
                  submissionId: sub.id,
                  courseId: sub.courseTest.courseId,
                  testId: sub.courseTest.id,
                  studentName: sub.user.name ?? "",
                  studentEmail: sub.user.email,
                  courseName: sub.courseTest.course.title,
                  testTitle: sub.courseTest.title,
                  score: sub.score,
                  submittedAt: sub.submittedAt.toISOString(),
                  answers: sub.answers.map((a) => ({
                    questionId: a.questionId,
                    questionTitle: a.question.title,
                    questionType: a.question.type,
                    answer: a.answer,
                    isCorrect: a.isCorrect ?? null,
                  })),
                }}
              />
            ))}
          </div>
        </section>
      )}

      {examPending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Examenes legacy ({examPending.length})
          </h2>
          <div className="space-y-3">
            {examPending.map((sub) => (
              <ExamReviewCard
                key={sub.id}
                item={{
                  id: sub.id,
                  submissionId: sub.id,
                  courseId: sub.exam.courseId,
                  studentName: sub.user.name ?? "",
                  studentEmail: sub.user.email,
                  courseName: sub.exam.course.title,
                  score: sub.score,
                  submittedAt: sub.submittedAt.toISOString(),
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
