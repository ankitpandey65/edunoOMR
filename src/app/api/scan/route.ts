import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectAnswersFromScan, detectPaperSetFromScan, parseAnswerKey, scoreAnswers } from "@/lib/omr-scan";
import { decodeQrPayloadFromScan, parseOmrQrJson } from "@/lib/qr-decode";
import { findAnswerKeysByExamClassCompat, isSetWiseAnswerKeyModelReady } from "@/lib/answer-key-store";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "ADMIN" && s.role !== "SCHOOL")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const studentIdInput = String(form.get("studentId") ?? "").trim();
  const examCodeInput = String(form.get("examCode") ?? "").trim().toUpperCase();
  const rollNoInput = String(form.get("rollNo") ?? "").trim();
  const schoolCodeInput = String(form.get("schoolCode") ?? "").trim().toUpperCase();
  const duplicateMode = String(form.get("duplicateMode") ?? "ask").trim();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const rawQr = await decodeQrPayloadFromScan(buf);
  const parsedQr = rawQr ? parseOmrQrJson(rawQr) : null;
  const hasManual = Boolean(studentIdInput || examCodeInput || rollNoInput || schoolCodeInput);

  if (studentIdInput && parsedQr?.sid && parsedQr.sid !== studentIdInput) {
    return NextResponse.json(
      { error: "Manual studentId does not match QR student. Remove manual input or use matching image." },
      { status: 400 }
    );
  }
  if (examCodeInput && parsedQr?.e && parsedQr.e.toUpperCase() !== examCodeInput) {
    return NextResponse.json(
      { error: "Manual examCode does not match QR exam. Remove manual input or use matching image." },
      { status: 400 }
    );
  }

  const studentId = studentIdInput || parsedQr?.sid || "";
  let examCode = examCodeInput || (parsedQr?.e ? parsedQr.e.toUpperCase() : "");

  let student =
    studentId
      ? await prisma.student.findUnique({
          where: { id: studentId },
          include: { enrollments: true, school: true },
        })
      : null;

  // Friendly fallback: identify student via roll number.
  if (!student && rollNoInput) {
    if (s.role === "SCHOOL") {
      if (!s.schoolId) {
        return NextResponse.json({ error: "School session missing schoolId" }, { status: 400 });
      }
      student = await prisma.student.findUnique({
        where: { schoolId_rollNo: { schoolId: s.schoolId, rollNo: rollNoInput } },
        include: { enrollments: true, school: true },
      });
    } else {
      if (!schoolCodeInput) {
        return NextResponse.json(
          { error: "For admin manual scan, provide School Code when QR is not readable." },
          { status: 400 }
        );
      }
      const school = await prisma.school.findUnique({ where: { code: schoolCodeInput }, select: { id: true } });
      if (!school) {
        return NextResponse.json({ error: "School not found for provided School Code" }, { status: 404 });
      }
      student = await prisma.student.findUnique({
        where: { schoolId_rollNo: { schoolId: school.id, rollNo: rollNoInput } },
        include: { enrollments: true, school: true },
      });
    }
  }

  if (!student) {
    return NextResponse.json(
      {
        error:
          "Could not identify student. Use visible QR, or provide Student ID, or Roll No (and School Code for admin).",
      },
      { status: 400 }
    );
  }

  if (s.role === "SCHOOL" && s.schoolId !== student.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!examCode && student.enrollments.length === 1) {
    examCode = student.enrollments[0].examCode.toUpperCase();
  }
  if (!examCode) {
    return NextResponse.json(
      {
        error:
          "Could not identify exam. Use visible QR, or choose Exam manually (auto works only when QR/unique enrollment is available).",
      },
      { status: 400 }
    );
  }
  if (!student.enrollments.some((e) => e.examCode === examCode)) {
    return NextResponse.json({ error: "Student not enrolled in this exam" }, { status: 400 });
  }
  const resolvedStudentId = student.id;

  const uploadDir = path.join(process.cwd(), "public", "uploads", "scans");
  await mkdir(uploadDir, { recursive: true });
  const fname = `${resolvedStudentId}_${examCode}_${Date.now()}.png`;
  const imagePath = path.join("public", "uploads", "scans", fname);
  await writeFile(path.join(process.cwd(), imagePath), buf);

  const detected = await detectAnswersFromScan(buf);
  const detectedSet = await detectPaperSetFromScan(buf);
  const detectedStr = detected.answers.join(",");
  const paperSet = detectedSet.setCode;

  const keyRows = await findAnswerKeysByExamClassCompat(examCode, student.className);
  const setReady = await isSetWiseAnswerKeyModelReady();
  const keyRow = paperSet ? keyRows.find((k) => k.setCode === paperSet) ?? null : null;
  const fallbackKeyRow = keyRow ?? (keyRows.length === 1 ? keyRows[0] : null);
  const keyError =
    !fallbackKeyRow && keyRows.length > 1
      ? "Multiple set-wise keys exist. Mark set bubble clearly (A/B/C/D)."
      : null;

  let score: { correct: number; max: number } | null = null;
  let attemptedQuestions = detected.answers.filter(Boolean).length + detected.ambiguous.filter(Boolean).length;
  let totalQuestions = 0;
  let correctAnswers = 0;
  if (fallbackKeyRow?.answers) {
    const keyArr = parseAnswerKey(fallbackKeyRow.answers);
    totalQuestions = keyArr.filter((k) => !!k).length;
    score = scoreAnswers(detected.answers, keyArr, 1, {
      multipleOrBlankIsZero: true,
      ambiguous: detected.ambiguous,
    });
    correctAnswers = score.correct;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_examCode: { studentId: resolvedStudentId, examCode },
    },
  });

  const existing = await prisma.scanResult.findMany({
    where: {
      studentId: resolvedStudentId,
      examCode,
    },
    orderBy: { processedAt: "desc" },
    take: 3,
  });

  if (existing.length > 0 && duplicateMode === "ask") {
    return NextResponse.json(
      {
        error: "Score record already exists for this student + exam. Confirm duplicate handling.",
        duplicateFound: true,
        duplicates: existing.map((r) => ({
          id: r.id,
          processedAt: r.processedAt,
          score: r.score,
          maxScore: r.maxScore,
          attemptedQuestions: r.attemptedQuestions,
          totalQuestions: r.totalQuestions,
          scanSource: r.scanSource,
        })),
      },
      { status: 409 }
    );
  }

  if (existing.length > 0 && duplicateMode === "replace_latest") {
    await prisma.scanResult.update({
      where: { id: existing[0].id },
      data: {
        enrollmentId: enrollment?.id,
        paperSet: paperSet ?? null,
        imagePath: `/uploads/scans/${fname}`,
        detectedAnswers: detectedStr,
        attemptedQuestions,
        totalQuestions: totalQuestions || null,
        correctAnswers: correctAnswers || null,
        scanSource: "single",
        score: score ? score.correct : null,
        maxScore: score ? score.max : null,
        processedAt: new Date(),
      },
    });
  } else {
    await prisma.scanResult.create({
      data: {
        studentId: resolvedStudentId,
        enrollmentId: enrollment?.id,
        examCode,
        paperSet: paperSet ?? null,
        attemptedQuestions,
        totalQuestions: totalQuestions || null,
        correctAnswers: correctAnswers || null,
        scanSource: "single",
        imagePath: `/uploads/scans/${fname}`,
        detectedAnswers: detectedStr,
        score: score ? score.correct : null,
        maxScore: score ? score.max : null,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    answers: detected.answers,
    confidences: detected.confidences,
    ambiguousCount: detected.ambiguous.filter(Boolean).length,
    detectedSet: paperSet,
    detectedSetAmbiguous: detectedSet.ambiguous,
    detectedSetConfidence: Math.round(detectedSet.confidence * 10) / 10,
    keySetUsed: fallbackKeyRow?.setCode ?? null,
    keyError,
    setModelReady: setReady,
    attemptedQuestions,
    totalQuestions: totalQuestions || (score?.max ?? 0),
    correctAnswers: correctAnswers || (score?.correct ?? 0),
    duplicateResolved: existing.length > 0 ? duplicateMode : null,
    score,
    imageUrl: `/uploads/scans/${fname}`,
    resolved: {
      mode: hasManual ? (parsedQr ? "manual+qr" : "manual") : "qr",
      studentId: student.id,
      examCode,
      studentName: student.name,
      className: student.className,
      school: student.school.name,
    },
  });
}
