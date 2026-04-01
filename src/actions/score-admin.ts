"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function deleteBatchJobAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Batch job id required" };
  await prisma.omrBatchJob.delete({ where: { id } });
  revalidatePath("/admin/scans");
  return { ok: true as const };
}

export async function deleteScanResultAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Score record id required" };
  await prisma.scanResult.delete({ where: { id } });
  revalidatePath("/admin/scans");
  revalidatePath("/admin/scores");
  return { ok: true as const };
}

export async function deleteSchoolScoresAction(formData: FormData) {
  await requireAdmin();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  if (!schoolId) return { error: "schoolId required" };
  await prisma.scanResult.deleteMany({
    where: { student: { schoolId } },
  });
  revalidatePath("/admin/scores");
  revalidatePath("/admin/scans");
  return { ok: true as const };
}

export async function clearAllScanDataAction() {
  await requireAdmin();
  await prisma.$transaction([
    prisma.omrBatchPageResult.deleteMany({}),
    prisma.omrBatchJob.deleteMany({}),
    prisma.scanResult.deleteMany({}),
  ]);
  revalidatePath("/admin/scans");
  revalidatePath("/admin/scores");
  revalidatePath("/school/scores");
  return { ok: true as const };
}
