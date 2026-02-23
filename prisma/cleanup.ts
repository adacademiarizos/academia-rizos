import { db } from '@/lib/db'

async function cleanupDuplicates() {
  try {
    console.log('🧹 Cleaning up duplicate courses...')

    // Get all courses and group by title
    const allCourses = await db.course.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Group by title
    const coursesByTitle = new Map<string, typeof allCourses>()
    allCourses.forEach((course) => {
      const existingCourses = coursesByTitle.get(course.title) || []
      existingCourses.push(course)
      coursesByTitle.set(course.title, existingCourses)
    })

    // Delete older duplicates, keeping only the newest
    let deletedCount = 0
    for (const [title, courses] of coursesByTitle.entries()) {
      if (courses.length > 1) {
        // Sort by createdAt descending (newest first)
        const sorted = courses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        // Keep first one, delete the rest
        for (let i = 1; i < sorted.length; i++) {
          const courseToDelete = sorted[i]
          console.log(`  Deleting: "${title}" (ID: ${courseToDelete.id})`)

          // Delete related data first
          await db.courseAccess.deleteMany({ where: { courseId: courseToDelete.id } })
          await db.moduleProgress.deleteMany({ where: { module: { courseId: courseToDelete.id } } })
          await db.submission.deleteMany({ where: { test: { courseId: courseToDelete.id } } })
          await db.test.deleteMany({ where: { courseId: courseToDelete.id } })
          await db.module.deleteMany({ where: { courseId: courseToDelete.id } })
          await db.resource.deleteMany({ where: { courseId: courseToDelete.id } })

          // Finally delete the course
          await db.course.delete({ where: { id: courseToDelete.id } })
          deletedCount++
        }
      }
    }

    console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} duplicate courses.`)
    console.log(`\n📚 Remaining courses:`)
    const remaining = await db.course.findMany({ orderBy: { createdAt: 'desc' } })
    remaining.forEach((course) => {
      console.log(`  • ${course.title} ($${(course.priceCents / 100).toFixed(2)})`)
    })
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

cleanupDuplicates()
