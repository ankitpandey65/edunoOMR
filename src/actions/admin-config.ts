"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function saveAppSettingsAction(formData: FormData) {
  await requireAdmin();
  const appSettingModel = (prisma as unknown as { appSetting?: any }).appSetting;
  if (!appSettingModel) return { error: "Server model not ready. Restart app and run Prisma generate." };
  const examSession = String(formData.get("examSession") ?? "").trim();
  const omrHeaderNote = String(formData.get("omrHeaderNote") ?? "").trim();
  const themeRaw = String(formData.get("theme") ?? "dark").trim().toLowerCase();
  const theme = themeRaw === "light" ? "light" : "dark";

  await appSettingModel.upsert({
    where: { id: "app" },
    create: { id: "app", examSession, omrHeaderNote, theme },
    update: { examSession, omrHeaderNote, theme },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/omr");
  revalidatePath("/school/omr");
  revalidatePath("/");
  return { ok: true as const };
}

export async function addExamAction(formData: FormData) {
  await requireAdmin();
  const examModel = (prisma as unknown as { exam?: any }).exam;
  if (!examModel) return { error: "Server model not ready. Restart app and run Prisma generate." };
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0")) || 0;
  if (!code || !name) return { error: "Code and name required." };

  await examModel.create({
    data: { code, name, sortOrder, isActive: true },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/students");
  revalidatePath("/school/students");
  revalidatePath("/admin/keys");
  return { ok: true as const };
}

export async function updateExamAction(formData: FormData) {
  await requireAdmin();
  const examModel = (prisma as unknown as { exam?: any }).exam;
  if (!examModel) return { error: "Server model not ready. Restart app and run Prisma generate." };
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(String(formData.get("sortOrder") ?? "0")) || 0;
  const isActive = String(formData.get("isActive") ?? "") === "on";
  if (!code || !name) return { error: "Code and name required." };

  await examModel.update({
    where: { code },
    data: { name, sortOrder, isActive },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/students");
  revalidatePath("/school/students");
  revalidatePath("/admin/keys");
  return { ok: true as const };
}

export async function deleteExamAction(formData: FormData) {
  await requireAdmin();
  const examModel = (prisma as unknown as { exam?: any }).exam;
  if (!examModel) return { error: "Server model not ready. Restart app and run Prisma generate." };
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) return { error: "Code required." };

  const usedInEnrollment = await prisma.enrollment.findFirst({
    where: { examCode: code },
    select: { id: true },
  });
  if (usedInEnrollment) {
    return { error: "Exam is mapped to students. Disable it instead of deleting." };
  }
  const usedInKeys = await prisma.answerKey.findFirst({
    where: { examCode: code },
    select: { id: true },
  });
  if (usedInKeys) {
    return { error: "Exam has answer keys. Disable it instead of deleting." };
  }

  await examModel.delete({ where: { code } });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/students");
  revalidatePath("/school/students");
  revalidatePath("/admin/keys");
  return { ok: true as const };
}
