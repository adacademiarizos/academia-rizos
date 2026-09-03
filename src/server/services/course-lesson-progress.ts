/**
 * The one place that answers "how far along is this student in this course?".
 *
 * It lives on its own, importing nothing but the database client, because both
 * the course page and the student dashboard need it and neither should have to
 * pull in certificate generation, PDF rendering or mail to ask a counting
 * question.
 */

import { db } from '@/lib/db'

export async function getCourseLessonProgress(userId: string, courseId: string) {
  // Counted through the lesson's own courseId. Filtering by `module` skipped
  // every lesson that hangs off a style, so a course with styles reported a
  // total that ignored them and could look complete while they were pending.
  //
  // `completed` matters as much as the row: the style player creates the
  // progress row on first play and flips the flag later, so counting rows
  // reports lessons as done the moment they are opened.
  const [totalLessons, completedLessons] = await Promise.all([
    db.lesson.count({ where: { courseId } }),
    db.lessonProgress.count({ where: { userId, completed: true, lesson: { courseId } } }),
  ])

  return {
    totalLessons,
    completedLessons,
    percentage: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    isComplete: totalLessons > 0 && completedLessons === totalLessons,
  }
}
