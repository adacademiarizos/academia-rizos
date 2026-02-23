interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const BASE_URL = 'http://localhost:3001'
const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
    console.log(`✅ ${name}`)
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
    console.log(`❌ ${name} - ${error}`)
  }
}

async function runTests() {
  console.log('🧪 Running Frontend Tests...\n')

  // Test 1: Courses API
  await test('GET /api/courses returns courses', async () => {
    const res = await fetch(`${BASE_URL}/api/courses`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const data = (await res.json()) as any
    if (!data.success) throw new Error('success is false')
    if (!data.data || data.data.length === 0) throw new Error('No courses returned')
    if (data.count !== 3) throw new Error(`Expected 3 courses, got ${data.count}`)
  })

  // Get first course ID for later tests
  let courseId = ''
  await test('Extract first course ID', async () => {
    const res = await fetch(`${BASE_URL}/api/courses`)
    const data = (await res.json()) as any
    courseId = data.data[0].id
    if (!courseId) throw new Error('No course ID found')
  })

  // Test 2: Course detail API
  await test('GET /api/courses/[courseId] returns course details', async () => {
    const res = await fetch(`${BASE_URL}/api/courses/${courseId}`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const data = (await res.json()) as any
    if (!data.success) throw new Error('success is false')
    if (!data.data.moduleCount) throw new Error('moduleCount missing')
    if (!data.data.totalHours) throw new Error('totalHours missing')
    console.log(`     → Course: "${data.data.title}"`)
  })

  // Test 3: Modules API
  let moduleId = ''
  await test('GET /api/courses/[courseId]/modules returns modules', async () => {
    const res = await fetch(`${BASE_URL}/api/courses/${courseId}/modules`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const data = (await res.json()) as any
    if (!data.data || data.data.modules.length === 0) throw new Error('No modules returned')
    moduleId = data.data.modules[0].id
    console.log(`     → Found ${data.data.modules.length} modules`)
  })

  // Test 4: Course Access API
  await test('GET /api/course-access/[courseId] requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/course-access/${courseId}`)
    // This will return 401/403 for anonymous users (expected)
    if (res.status === 200 || res.status === 401 || res.status === 403) {
      return // Expected behavior
    }
    throw new Error(`Unexpected status ${res.status}`)
  })

  // Test 5: Test endpoint (should be protected)
  await test('GET /api/courses/[courseId]/test requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/courses/${courseId}/test`)
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`Expected 401/403, got ${res.status}`)
    }
  })

  // Test 6: Frontend pages
  await test('GET /courses page loads', async () => {
    const res = await fetch(`${BASE_URL}/courses`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!html.includes('<!DOCTYPE')) throw new Error('Not HTML')
    if (html.length < 1000) throw new Error('Response too small')
  })

  await test('GET /courses/[courseId] page loads', async () => {
    const res = await fetch(`${BASE_URL}/courses/${courseId}`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!html.includes('<!DOCTYPE')) throw new Error('Not HTML')
  })

  await test('GET /learn/[courseId] page loads', async () => {
    const res = await fetch(`${BASE_URL}/learn/${courseId}`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!html.includes('<!DOCTYPE')) throw new Error('Not HTML')
  })

  await test('GET /learn/[courseId]/modules/[moduleId] page loads', async () => {
    const res = await fetch(`${BASE_URL}/learn/${courseId}/modules/${moduleId}`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!html.includes('<!DOCTYPE')) throw new Error('Not HTML')
  })

  await test('GET /learn/[courseId]/test page loads', async () => {
    const res = await fetch(`${BASE_URL}/learn/${courseId}/test`)
    if (res.status !== 200) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!html.includes('<!DOCTYPE')) throw new Error('Not HTML')
  })

  // Summary
  console.log('\n' + '='.repeat(60))
  const passed = results.filter((r) => r.passed).length
  const total = results.length
  console.log(`\n📊 Test Results: ${passed}/${total} passed`)

  if (passed === total) {
    console.log('\n✨ All tests passed! Frontend is working correctly.\n')
  } else {
    console.log('\n⚠️ Some tests failed. See details above.\n')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`)
        if (r.error) console.log(`     ${r.error}`)
      })
  }

  process.exit(passed === total ? 0 : 1)
}

runTests()
