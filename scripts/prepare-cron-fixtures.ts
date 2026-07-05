import "dotenv/config";

import { db } from "../src/lib/db";

async function main() {
  const studentEmail = "student@elizabeth.com";
  const student = await db.user.findUnique({
    where: { email: studentEmail },
    select: { id: true, email: true, name: true },
  });

  if (!student) {
    throw new Error(`No existe el usuario demo ${studentEmail}. Ejecuta primero el seed.`);
  }

  const course = await db.course.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  if (!course) {
    throw new Error("No existe ningún curso. Ejecuta primero el seed.");
  }

  const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.courseAccess.upsert({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: course.id,
      },
    },
    create: {
      userId: student.id,
      courseId: course.id,
      accessUntil: expiredAt,
    },
    update: {
      accessUntil: expiredAt,
    },
  });

  let finalExam = await db.courseTest.findFirst({
    where: {
      courseId: course.id,
      isFinalExam: true,
    },
    select: { id: true, title: true },
  });

  if (!finalExam) {
    finalExam = await db.courseTest.create({
      data: {
        courseId: course.id,
        title: "Examen final local para cron",
        description: "Fixture local para probar issue-certificates",
        isRequired: true,
        isFinalExam: true,
        maxAttempts: 1,
        passingScore: 70,
      },
      select: { id: true, title: true },
    });
  }

  const approvedSubmission = await db.courseTestSubmission.findFirst({
    where: {
      courseTestId: finalExam.id,
      userId: student.id,
      status: "APPROVED",
      isPassed: true,
    },
    select: { id: true },
  });

  if (!approvedSubmission) {
    await db.courseTestSubmission.create({
      data: {
        courseTestId: finalExam.id,
        userId: student.id,
        score: 100,
        isPassed: true,
        attemptNumber: 1,
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });
  }

  await db.certificate.deleteMany({
    where: {
      userId: student.id,
      courseId: course.id,
      valid: true,
    },
  });

  const payment = await db.payment.create({
    data: {
      type: "COURSE",
      status: "PAID",
      amountCents: 2999,
      currency: "EUR",
      payerId: student.id,
      payerEmail: student.email,
      courseId: course.id,
      receiptEmailSentAt: null,
      receiptToEmail: null,
    },
    select: {
      id: true,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    fixtures: {
      expiredAccess: {
        studentEmail: student.email,
        courseTitle: course.title,
        accessUntil: expiredAt.toISOString(),
      },
      issueCertificates: {
        studentEmail: student.email,
        courseTitle: course.title,
        finalExamTitle: finalExam.title,
      },
      sendReceipts: {
        paymentId: payment.id,
        studentEmail: student.email,
      },
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[prepare-cron-fixtures] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
