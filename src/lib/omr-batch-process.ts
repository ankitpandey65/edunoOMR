import { prisma } from "./prisma";
import { createPdfPageRenderer } from "./pdf-render-pages";
import { decodeQrPayloadFromScan, parseOmrQrJson } from "./qr-decode";
import { detectAnswersFromScan, detectPaperSetFromScan, parseAnswerKey, scoreAnswers } from "./omr-scan";
import type { Role } from "@prisma/client";
import { findAnswerKeysByExamClassCompat, isSetWiseAnswerKeyModelReady } from "./answer-key-store";
import { detectOmrWithOpenAi, hasOpenAiForOmr } from "./omr-openai";

export type BatchProcessResult = {
  jobId: string;
  totalPages: number;
  okCount: number;
  errCount: number;
  openAiUsed: boolean;
};

export type BatchDuplicateMode = "ask" | "replace_latest" | "keep_old" | "keep_both";

function computeAttempted(answers: string[], ambiguous: boolean[]) {
  return answers.filter(Boolean).length + ambiguous.filter(Boolean).length;
}

export async function processOmrPdfUpload(opts: {
  pdfBuffer: Buffer;
  fileName: string;
  uploadedByRole: Role;
  schoolIdFilter: string | null;
  duplicateMode: BatchDuplicateMode;
}): Promise<BatchProcessResult> {
  const useOpenAi = hasOpenAiForOmr();
  const renderer = await createPdfPageRenderer(opts.pdfBuffer);
  if (renderer.totalPages === 0) {
    throw new Error("No pages found in PDF");
  }

  const job = await prisma.omrBatchJob.create({
    data: {
      fileName: opts.fileName,
      filePath: "",
      uploadedByRole: opts.uploadedByRole,
      schoolId: opts.schoolIdFilter,
      totalPages: renderer.totalPages,
      okCount: 0,
      errCount: 0,
      status: "processing",
    },
  });

  const runInBackground = async () => {
    let ok = 0;
    let err = 0;
    try {
      for (let i = 0; i < renderer.totalPages; i++) {
        const pageIndex = i + 1;
        const png = await renderer.renderPage(pageIndex);
        const imageRel = null;

        let studentId: string | null = null;
        let persistedStudentId: string | null = null;
        let examCode: string | null = null;
        let score: number | null = null;
        let maxScore: number | null = null;
        let paperSet: string | null = null;
        let attemptedQuestions: number | null = null;
        let totalQuestions: number | null = null;
        let correctAnswers: number | null = null;
        let scanSource: string | null = useOpenAi ? "batch_openai" : "batch_local";
        let detectedStr = "";
        let qrPayload: string | null = null;
        let error: string | null = null;

        try {
          const rawQr = await decodeQrPayloadFromScan(png);
          qrPayload = rawQr;
          const parsed = rawQr ? parseOmrQrJson(rawQr) : null;
          if (parsed) {
            studentId = parsed.sid;
            examCode = parsed.e.toUpperCase();
          }

          let ai: Awaited<ReturnType<typeof detectOmrWithOpenAi>> | null = null;
          if ((!studentId || !examCode) && useOpenAi) {
            ai = await detectOmrWithOpenAi(png);
            if (!studentId && ai.studentId) studentId = ai.studentId;
            if (!examCode && ai.examCode) examCode = ai.examCode.toUpperCase();
          }

          let student = studentId
            ? await prisma.student.findUnique({
                where: { id: studentId },
                include: { school: true, enrollments: true },
              })
            : null;

          if (!student && useOpenAi && ai?.rollNo) {
            if (opts.schoolIdFilter) {
              student = await prisma.student.findUnique({
                where: { schoolId_rollNo: { schoolId: opts.schoolIdFilter, rollNo: ai.rollNo } },
                include: { school: true, enrollments: true },
              });
            } else if (ai.schoolCode) {
              const school = await prisma.school.findUnique({
                where: { code: ai.schoolCode },
                select: { id: true },
              });
              if (school) {
                student = await prisma.student.findUnique({
                  where: { schoolId_rollNo: { schoolId: school.id, rollNo: ai.rollNo } },
                  include: { school: true, enrollments: true },
                });
              }
            }
          }
          if (!student) {
            throw new Error("Could not identify student from QR/OCR");
          }
          studentId = student.id;
          persistedStudentId = student.id;
          if (opts.schoolIdFilter && student.schoolId !== opts.schoolIdFilter) {
            throw new Error("Page belongs to another school");
          }
          if (!examCode && useOpenAi && ai?.examCode) {
            examCode = ai.examCode.toUpperCase();
          }
          if (!examCode && student.enrollments.length === 1) {
            examCode = student.enrollments[0].examCode.toUpperCase();
          }
          if (!examCode) {
            throw new Error("Could not identify exam code from QR/OCR");
          }
          const enrolled = student.enrollments.some((e) => e.examCode === examCode);
          if (!enrolled) {
            throw new Error("Student not enrolled in exam from QR");
          }

          let answers: string[] = [];
          let ambiguous: boolean[] = [];
          if (useOpenAi) {
            const aiDetected = ai ?? (await detectOmrWithOpenAi(png));
            answers = aiDetected.answers;
            ambiguous = aiDetected.ambiguous;
            paperSet = aiDetected.setCode;
          } else {
            const detected = await detectAnswersFromScan(png);
            const detectedSet = await detectPaperSetFromScan(png);
            answers = detected.answers;
            ambiguous = detected.ambiguous;
            paperSet = detectedSet.setCode;
          }
          detectedStr = answers.join(",");
          attemptedQuestions = computeAttempted(answers, ambiguous);

          const keyRows = await findAnswerKeysByExamClassCompat(examCode, student.className);
          const setReady = await isSetWiseAnswerKeyModelReady();
          const keyRow = paperSet ? keyRows.find((k) => k.setCode === paperSet) ?? null : null;
          const fallbackKeyRow = keyRow ?? (keyRows.length === 1 ? keyRows[0] : null);

          if (fallbackKeyRow?.answers) {
            const keyArr = parseAnswerKey(fallbackKeyRow.answers);
            totalQuestions = keyArr.filter((k) => !!k).length;
            const sc = scoreAnswers(answers, keyArr, 1, {
              multipleOrBlankIsZero: true,
              ambiguous,
            });
            score = sc.correct;
            maxScore = sc.max;
            correctAnswers = sc.correct;
          } else if (setReady && keyRows.length > 1) {
            error = "Multiple set-wise answer keys found; set bubble not readable.";
          }

          const enrollment = await prisma.enrollment.findUnique({
            where: {
              studentId_examCode: { studentId, examCode },
            },
          });

          const latestExisting = await prisma.scanResult.findFirst({
            where: { studentId: persistedStudentId, examCode },
            orderBy: { processedAt: "desc" },
          });
          const changedFromLatest = latestExisting
            ? latestExisting.score !== score ||
              latestExisting.maxScore !== maxScore ||
              latestExisting.paperSet !== paperSet ||
              (latestExisting.detectedAnswers ?? "") !== detectedStr
            : false;

          if (latestExisting && opts.duplicateMode === "ask") {
            error = `Duplicate found for student+exam. Existing: ${
              latestExisting.score ?? "—"
            }/${latestExisting.maxScore ?? "—"}, New: ${score ?? "—"}/${maxScore ?? "—"}${
              changedFromLatest ? " (changed)" : " (same)"
            }. Re-upload with duplicate mode: replace_latest or keep_old.`;
            err++;
          } else if (latestExisting && opts.duplicateMode === "keep_old") {
            // Intentionally skip persistence; keep previously finalized score.
            ok++;
          } else if (latestExisting && opts.duplicateMode === "replace_latest") {
            await prisma.scanResult.update({
              where: { id: latestExisting.id },
              data: {
                enrollmentId: enrollment?.id,
                examCode,
                paperSet,
                attemptedQuestions,
                totalQuestions,
                correctAnswers,
                scanSource,
                imagePath: null,
                detectedAnswers: detectedStr,
                score,
                maxScore,
                processedAt: new Date(),
              },
            });
            ok++;
          } else {
            await prisma.scanResult.create({
              data: {
                studentId: persistedStudentId,
                enrollmentId: enrollment?.id,
                examCode,
                paperSet,
                attemptedQuestions,
                totalQuestions,
                correctAnswers,
                scanSource,
                imagePath: null,
                detectedAnswers: detectedStr,
                score,
                maxScore,
              },
            });
            ok++;
          }
        } catch (e) {
          err++;
          error = e instanceof Error ? e.message : "Unknown error";
        }

        await prisma.omrBatchPageResult.create({
          data: {
            jobId: job.id,
            pageIndex,
            studentId: persistedStudentId,
            examCode,
            paperSet,
            attemptedQuestions,
            totalQuestions,
            correctAnswers,
            scanSource,
            score,
            maxScore,
            detectedAnswers: detectedStr || null,
            qrPayload,
            imagePath: null,
            error,
          },
        });

        await prisma.omrBatchJob.update({
          where: { id: job.id },
          data: { okCount: ok, errCount: err, status: "processing" },
        });
      }

      await prisma.omrBatchJob.update({
        where: { id: job.id },
        data: {
          okCount: ok,
          errCount: err,
          status: "completed",
        },
      });
    } catch (e) {
      await prisma.omrBatchJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errCount: err + 1,
        },
      });
    } finally {
      await renderer.dispose();
    }
  };

  void runInBackground();

  return {
    jobId: job.id,
    totalPages: renderer.totalPages,
    okCount: 0,
    errCount: 0,
    openAiUsed: useOpenAi,
  };
}
