"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import type { Role } from "@prisma/client";

function normalizeRole(v: FormDataEntryValue | null): Role {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "SCHOOL" ? "SCHOOL" : "ADMIN";
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = normalizeRole(formData.get("role"));
  const password = String(formData.get("password") ?? "");
  const schoolIdRaw = String(formData.get("schoolId") ?? "").trim();
  const schoolId = schoolIdRaw || null;

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (role === "SCHOOL" && !schoolId) return { error: "School account requires a school." };

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      name: name || null,
      role,
      schoolId: role === "SCHOOL" ? schoolId : null,
      passwordHash,
      isActive: true,
    },
  });

  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = normalizeRole(formData.get("role"));
  const password = String(formData.get("password") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "on";
  const schoolIdRaw = String(formData.get("schoolId") ?? "").trim();
  const schoolId = schoolIdRaw || null;
  if (!id || !email) return { error: "User id and email are required." };
  if (admin.sub === id && !isActive) return { error: "You cannot disable your own account." };
  if (role === "SCHOOL" && !schoolId) return { error: "School account requires a school." };

  await prisma.user.update({
    where: { id },
    data: {
      email,
      name: name || null,
      role,
      isActive,
      schoolId: role === "SCHOOL" ? schoolId : null,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "User id is required." };
  if (admin.sub === id) return { error: "You cannot delete your own account." };

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  return { ok: true as const };
}
