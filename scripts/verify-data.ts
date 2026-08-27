/**
 * Test Script - Verify Academy Data
 * Run with: npx ts-node -O '{"module":"commonjs"}' scripts/verify-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyData() {
  console.log('\n📊 ============= VERIFICATION REPORT =============\n')

  try {
    // 1. Check Courses
    console.log('1️⃣ COURSES')
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: { modules: true, resources: true, access: true }
        },
        test: true
      }
    })

    console.log(`   ✅ Total courses: ${courses.length}\n`)
    for (const course of courses) {
      console.log(`   📚 ${course.title}`)
      console.log(`      - Price: $${(course.priceCents / 100).toFixed(2)} ${course.currency}`)
      console.log(`      - Rental: ${course.rentalDays ? `${course.rentalDays} days` : 'Lifetime'}`)
      console.log(`      - Modules: ${course._count.modules}`)
      console.log(`      - Resources: ${course._count.resources}`)
      console.log(`      - Test: ${course.test ? '✅ Yes' : '❌ No'}`)
      console.log('')
    }

    // 2. Check Modules
    console.log('2️⃣ MODULES')
    const modules = await prisma.module.findMany({
      select: { courseId: true, order: true, title: true, videoUrl: true, transcript: true }
    })

    console.log(`   ✅ Total modules: ${modules.length}\n`)
    const modulesByCourse = modules.reduce((acc, mod) => {
      if (!acc[mod.courseId]) acc[mod.courseId] = []
      acc[mod.courseId].push(mod)
      return acc
    }, {} as Record<string, typeof modules>)

    for (const [courseId, mods] of Object.entries(modulesByCourse)) {
      const course = courses.find(c => c.id === courseId)
      console.log(`   ${course?.title}:`)
      mods.forEach(mod => {
        console.log(`      ${mod.order}. ${mod.title}`)
        console.log(`         Video: ${mod.videoUrl ? '✅' : '❌'} | Transcript: ${mod.transcript ? '✅ ' + mod.transcript.substring(0, 30) + '...' : '❌'}`)
      })
      console.log('')
    }

    // 3. Check Tests
    console.log('3️⃣ TESTS')
    const tests = await prisma.test.findMany({
      select: { id: true, courseId: true, schemaJson: true }
    })

    console.log(`   ✅ Total tests: ${tests.length}\n`)
    for (const test of tests) {
      const course = courses.find(c => c.id === test.courseId)
      const schema = test.schemaJson as any
      console.log(`   📋 ${course?.title}`)
      console.log(`      - Questions: ${schema.questions?.length || 0}`)
      console.log(`      - Passing Score: ${schema.passingScore || 'Not set'}%`)
      console.log(`      - Max Attempts: ${schema.maxAttempts || 'Unlimited'}`)
      console.log('')
    }

    // 4. Check Resources
    console.log('4️⃣ RESOURCES')
    const resources = await prisma.resource.findMany({
      select: { courseId: true, type: true, fileName: true, fileUrl: true }
    })

    console.log(`   ✅ Total resources: ${resources.length}\n`)
    for (const resource of resources) {
      const course = courses.find(c => c.id === resource.courseId)
      console.log(`   ${course?.title}: [${resource.type}] ${resource.fileName}`)
    }

    // 5. Database Size Estimation
    console.log('\n5️⃣ DATABASE SUMMARY')
    const userCount = await prisma.user.count()
    const appointmentCount = await prisma.appointment.count()
    const paymentCount = await prisma.payment.count()

    console.log(`   👥 Users: ${userCount}`)
    console.log(`   📅 Appointments: ${appointmentCount}`)
    console.log(`   💳 Payments: ${paymentCount}`)
    console.log(`   📚 Courses: ${courses.length}`)
    console.log(`   🎬 Modules: ${modules.length}`)
    console.log(`   📄 Resources: ${resources.length}`)
    console.log(`   ✅ Tests: ${tests.length}`)

    // 6. Validation Checks
    console.log('\n6️⃣ VALIDATION CHECKS')

    let isValid = true

    // Check all courses have tests
    const coursesWithoutTest = courses.filter(c => !c.test)
    if (coursesWithoutTest.length > 0) {
      console.log(`   ❌ ${coursesWithoutTest.length} course(s) missing test`)
      isValid = false
    } else {
      console.log(`   ✅ All courses have tests`)
    }

    // Check all courses have modules
    const coursesWithoutModules = courses.filter(c => c._count.modules === 0)
    if (coursesWithoutModules.length > 0) {
      console.log(`   ❌ ${coursesWithoutModules.length} course(s) missing modules`)
      isValid = false
    } else {
      console.log(`   ✅ All courses have modules`)
    }

    // Check all modules have video URLs
    const modulesWithoutVideo = modules.filter(m => !m.videoUrl)
    if (modulesWithoutVideo.length > 0) {
      console.log(`   ❌ ${modulesWithoutVideo.length} module(s) missing video URL`)
      isValid = false
    } else {
      console.log(`   ✅ All modules have video URLs`)
    }

    // Check all tests have questions
    const testsWithoutQuestions = tests.filter(t => {
      const schema = t.schemaJson as any
      return !schema.questions || schema.questions.length === 0
    })
    if (testsWithoutQuestions.length > 0) {
      console.log(`   ❌ ${testsWithoutQuestions.length} test(s) missing questions`)
      isValid = false
    } else {
      console.log(`   ✅ All tests have questions`)
    }

    console.log('\n' + (isValid ? '✨ ALL VALIDATIONS PASSED!' : '⚠️  SOME VALIDATIONS FAILED'))

    // 7. Sample Data for Testing
    console.log('\n7️⃣ SAMPLE TESTING DATA')
    if (courses.length > 0) {
      const firstCourse = courses[0]
      console.log(`\n   Sample Course ID (for testing):`)
      console.log(`   ${firstCourse.id}`)
      console.log(`\n   Try these URLs:`)
      console.log(`   GET /api/courses`)
      console.log(`   GET /api/courses/${firstCourse.id}`)
      console.log(`   GET /api/courses/${firstCourse.id}/modules`)
    }

  } catch (error) {
    console.error('❌ Error during verification:', error)
  } finally {
    await prisma.$disconnect()
  }

  console.log('\n================================================\n')
}

verifyData()
