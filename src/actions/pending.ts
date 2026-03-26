"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { filterValidExamCodesDb } from "@/lib/exam-store";

type Payload = {
  rollNo: string;
  name: string;
  className: string;
  section: string;
  fatherName: string | null;
  dob: string | null;
  mobile: string | null;
  examCodes: string[];
};

export async function approvePendingAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };

  const pending = await prisma.pendingStudentChange.findUnique({
    where: { id },
    include: { student: true },
  });
  if (!pending || pending.status !== "PENDING") return { error: "Request not found" };

  let data: Payload;
  try {
    data = JSON.parse(pending.payload) as Payload;
  } catch {
    return { error: "Invalid payload" };
  }

  const codes = await filterValidExamCodesDb(data.examCodes ?? []);

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: pending.studentId },
      data: {
        rollNo: data.rollNo,
        name: data.name,
        className: data.className,
        section: data.section,
        fatherName: data.fatherName,
        dob: data.dob,
        mobile: data.mobile,
      },
    });
    await tx.enrollment.deleteMany({ where: { studentId: pending.studentId } });
    if (codes.length) {
      await tx.enrollment.createMany({
        data: codes.map((examCode) => ({ studentId: pending.studentId, examCode })),
      });
    }
    await tx.pendingStudentChange.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: admin.sub,
      },
    });
  });

  revalidatePath("/admin/pending");
  revalidatePath("/school/pending");
  revalidatePath("/admin/students");
  revalidatePath("/school/students");
  return { ok: true as const };
}

export async function rejectPendingAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing id" };

  await prisma.pendingStudentChange.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: admin.sub,
    },
  });

  revalidatePath("/admin/pending");
  revalidatePath("/school/pending");
  return { ok: true as const };
}
