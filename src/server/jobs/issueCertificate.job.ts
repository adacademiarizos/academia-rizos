import { db } from "@/lib/db";
import { generateAndSaveCertificate } from "@/server/services/certificate.service";

import type { MaintenanceJobResult } from "./types";

type CertificateCandidate = {
  courseId: string;
  userId: string;
};

function dedupeCandidates(candidates: CertificateCandidate[]) {
  const byEnrollment = new Map<string, CertificateCandidate>();

  for (const candidate of candidates) {
    byEnrollment.set(`${candidate.userId}:${candidate.courseId}`, candidate);
  }

  return Array.from(byEnrollment.values());
}

export async function issueCertificateJob(): Promise<MaintenanceJobResult> {
  // finalExamAttempt and assessmentAttempt are included so an approval whose
  // certificate failed to issue is picked up here instead of stranding the
  // student with an approved exam and nothing to download.
  const [legacyExamCandidates, courseTestCandidates, finalExamCandidates, assessmentCandidates] = await Promise.all([
    db.examSubmission.findMany({
      where: { status: "APPROVED" },
      select: {
        userId: true,
        exam: {
          select: {
            courseId: true,
          },
        },
      },
    }),
    db.courseTestSubmission.findMany({
      where: {
        status: "APPROVED",
        isPassed: true,
        courseTest: {
          isFinalExam: true,
        },
      },
      select: {
        userId: true,
        courseTest: {
          select: {
            courseId: true,
          },
        },
      },
    }),
    db.finalExamAttempt.findMany({
      where: { status: "APPROVED" },
      select: {
        userId: true,
        finalExam: {
          select: {
            courseId: true,
          },
        },
      },
    }),
    db.assessmentAttempt.findMany({
      where: {
        status: "APPROVED",
        assessment: {
          isFinalExam: true,
          courseId: { not: null },
        },
      },
      select: {
        userId: true,
        assessment: {
          select: {
            courseId: true,
          },
        },
      },
    }),
  ]);

  const candidates = dedupeCandidates([
    ...legacyExamCandidates.map((candidate) => ({
      userId: candidate.userId,
      courseId: candidate.exam.courseId,
    })),
    ...courseTestCandidates.map((candidate) => ({
      userId: candidate.userId,
      courseId: candidate.courseTest.courseId,
    })),
    ...finalExamCandidates.map((candidate) => ({
      userId: candidate.userId,
      courseId: candidate.finalExam.courseId,
    })),
    ...assessmentCandidates.flatMap((candidate) =>
      candidate.assessment.courseId
        ? [{ userId: candidate.userId, courseId: candidate.assessment.courseId }]
        : []
    ),
  ]);

  let processed = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const existingCertificate = await db.certificate.findFirst({
        where: {
          userId: candidate.userId,
          courseId: candidate.courseId,
          valid: true,
        },
        select: { id: true },
      });

      if (existingCertificate) {
        continue;
      }

      await generateAndSaveCertificate(candidate.userId, candidate.courseId);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(
        `Failed to issue certificate for user ${candidate.userId} in course ${candidate.courseId}: ${message}`,
      );
    }
  }

  return { processed, errors };
}
