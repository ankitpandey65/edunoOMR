"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSchool } from "@/lib/auth";
import { parseCsvLine } from "@/lib/csv-student-row";
import { filterValidExamCodesDb } from "@/lib/exam-store";

function parseExamList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
}

async function readExamCodesFromFormData(formData: FormData): Promise<string[]> {
  const multi = formData
    .getAll("examCodes")
    .map((v) => String(v).trim().toUpperCase())
    .filter(Boolean);
  if (multi.length) return filterValidExamCodesDb(multi);
  const examsRaw = String(formData.get("exams") ?? "");
  return filterValidExamCodesDb(parseExamList(examsRaw));
}

export async function adminUpsertStudentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const rollNo = String(formData.get("rollNo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const fatherName = String(formData.get("fatherName") ?? "").trim() || null;
  const dob = String(formData.get("dob") ?? "").trim() || null;
  const mobile = String(formData.get("mobile") ?? "").trim() || null;
  const codes = await readExamCodesFromFormData(formData);

  if (!schoolId || !rollNo || !name || !className) {
    return { error: "School, roll number, name, and class are required." };
  }

  if (id) {
    const conflicting = await prisma.student.findFirst({
      where: { schoolId, rollNo, NOT: { id } },
      select: { id: true },
    });
    if (conflicting) {
      return { error: "A student with this roll number already exists in this school." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: { rollNo, name, className, section, fatherName, dob, mobile },
      });
      await tx.enrollment.deleteMany({ where: { studentId: id } });
      await tx.enrollment.createMany({
        data: codes.map((examCode) => ({ studentId: id, examCode })),
      });
    });
  } else {
    const existing = await prisma.student.findUnique({
      where: { schoolId_rollNo: { schoolId, rollNo } },
      select: { id: true },
    });
    if (existing) {
      return { error: "Student already exists with this roll number in the selected school." };
    }
    const student = await prisma.student.create({
      data: {
        schoolId,
        rollNo,
        name,
        className,
        section,
        fatherName,
        dob,
        mobile,
      },
    });
    if (codes.length) {
      await prisma.enrollment.createMany({
        data: codes.map((examCode) => ({ studentId: student.id, examCode })),
      });
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/school/students");
  return { ok: true as const };
}

export async function schoolCreateStudentAction(formData: FormData) {
  const { schoolId } = await requireSchool();
  const rollNo = String(formData.get("rollNo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const fatherName = String(formData.get("fatherName") ?? "").trim() || null;
  const dob = String(formData.get("dob") ?? "").trim() || null;
  const mobile = String(formData.get("mobile") ?? "").trim() || null;
  const codes = await readExamCodesFromFormData(formData);

  if (!rollNo || !name || !className) {
    return { error: "Roll number, name, and class are required." };
  }
  const existing = await prisma.student.findUnique({
    where: { schoolId_rollNo: { schoolId, rollNo } },
    select: { id: true },
  });
  if (existing) {
    return { error: "Student already exists with this roll number. Duplicate not allowed." };
  }

  await prisma.student.create({
    data: {
      schoolId,
      rollNo,
      name,
      className,
      section,
      fatherName,
      dob,
      mobile,
      enrollments: codes.length
        ? { create: codes.map((examCode) => ({ examCode })) }
        : undefined,
    },
  });

  revalidatePath("/school/students");
  return { ok: true as const };
}

export async function schoolRequestStudentChangeAction(formData: FormData) {
  const session = await requireSchool();
  const { schoolId } = session;
  const studentId = String(formData.get("studentId") ?? "").trim();
  const rollNo = String(formData.get("rollNo") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const className = String(formData.get("className") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const fatherName = String(formData.get("fatherName") ?? "").trim() || null;
  const dob = String(formData.get("dob") ?? "").trim() || null;
  const mobile = String(formData.get("mobile") ?? "").trim() || null;
  const examCodes = await readExamCodesFromFormData(formData);

  if (!studentId) return { error: "Student missing." };

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
  });
  if (!student) return { error: "Student not found." };

  const requestedBy = session.sub;

  const payload = JSON.stringify({
    rollNo,
    name,
    className,
    section,
    fatherName,
    dob,
    mobile,
    examCodes,
  });

  await prisma.pendingStudentChange.create({
    data: {
      studentId,
      requestedBy,
      status: "PENDING",
      payload,
    },
  });

  revalidatePath("/school/pending");
  revalidatePath("/admin/pending");
  return { ok: true as const };
}

export type BulkImportState = {
  ok?: boolean;
  created?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
} | null;

async function runBulkImportFromCsvText(schoolId: string, text: string): Promise<BulkImportState> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { error: "CSV must include a header row and at least one student." };

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);

  const iRoll = idx("rollno") >= 0 ? idx("rollno") : idx("roll");
  const iName = idx("name");
  const iClass = idx("classname") >= 0 ? idx("classname") : idx("class");
  const iSec = idx("section");
  const iFather = idx("fathername") >= 0 ? idx("fathername") : idx("father");
  const iDob = idx("dob");
  const iMobile = idx("mobile");
  const iExams = idx("exams");

  if (iRoll < 0 || iName < 0 || iClass < 0) {
    return { error: "CSV must include columns: rollNo, name, className (or class)." };
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  const existing = await prisma.student.findMany({
    where: { schoolId },
    select: { rollNo: true },
  });
  const knownRolls = new Set(existing.map((r) => r.rollNo.trim()));
  const seenInFile = new Set<string>();

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]);
    const rollNo = String(cols[iRoll] ?? "").trim();
    const name = cols[iName] ?? "";
    const className = cols[iClass] ?? "";
    const section = iSec >= 0 ? (cols[iSec] ?? "") : "";
    const fatherName = iFather >= 0 ? cols[iFather] || null : null;
    const dob = iDob >= 0 ? cols[iDob] || null : null;
    const mobile = iMobile >= 0 ? cols[iMobile] || null : null;
    const examsRaw = iExams >= 0 ? (cols[iExams] ?? "") : "";
    const codes = await filterValidExamCodesDb(parseExamList(examsRaw));

    if (!rollNo || !name || !className) {
      errors.push(`Row ${r + 1}: missing roll, name, or class`);
      continue;
    }
    if (knownRolls.has(rollNo) || seenInFile.has(rollNo)) {
      skipped++;
      continue;
    }

    try {
      await prisma.student.create({
        data: {
          schoolId,
          rollNo,
          name,
          className,
          section,
          fatherName,
          dob,
          mobile,
          enrollments: codes.length
            ? { create: codes.map((examCode) => ({ examCode })) }
            : undefined,
        },
      });
      created++;
      knownRolls.add(rollNo);
      seenInFile.add(rollNo);
    } catch {
      errors.push(`Row ${r + 1}: could not import (duplicate roll?)`);
    }
  }

  return { ok: true, created, skipped, errors };
}

export async function bulkImportStudentsAction(
  _prev: BulkImportState,
  formData: FormData
): Promise<BulkImportState> {
  const { schoolId } = await requireSchool();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Upload a CSV file." };
  const text = await file.text();
  const result = await runBulkImportFromCsvText(schoolId, text);
  if (result?.error) return result;
  revalidatePath("/school/students");
  return result;
}

export async function adminBulkImportStudentsAction(
  _prev: BulkImportState,
  formData: FormData
): Promise<BulkImportState> {
  await requireAdmin();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  if (!schoolId) return { error: "Select a school." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Upload a CSV file." };
  const text = await file.text();
  const result = await runBulkImportFromCsvText(schoolId, text);
  if (result?.error) return result;
  revalidatePath("/admin/students");
  revalidatePath("/school/students");
  return result;
}
