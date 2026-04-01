"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateSchoolCode } from "@/lib/school-code";
import bcrypt from "bcryptjs";

export async function createSchoolAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const userEmail = String(formData.get("userEmail") ?? "").trim().toLowerCase();
  const userPassword = String(formData.get("userPassword") ?? "");

  if (!name || !userEmail || userPassword.length < 6) {
    return { error: "Name, school login email, and password (6+ chars) are required." };
  }

  let code = generateSchoolCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.school.findUnique({ where: { code } });
    if (!exists) break;
    code = generateSchoolCode();
  }

  const passwordHash = await bcrypt.hash(userPassword, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { name, code, contact, address },
      });
      await tx.user.create({
        data: {
          email: userEmail,
          passwordHash,
          role: "SCHOOL",
          schoolId: school.id,
          name: `${name} admin`,
        },
      });
    });
  } catch {
    return { error: "Could not create school (duplicate email or code?)." };
  }

  revalidatePath("/admin/schools");
  return { ok: true as const, code };
}

export async function updateSchoolAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!id || !name) return { error: "School name is required." };

  await prisma.school.update({
    where: { id },
    data: { name, contact, address },
  });

  revalidatePath("/admin/schools");
  revalidatePath(`/admin/schools/${id}`);
  return { ok: true as const };
}

export async function setSchoolSuspendedAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const suspend = String(formData.get("suspend") ?? "") === "true";
  if (!id) return { error: "Missing school." };

  await prisma.school.update({
    where: { id },
    data: { isActive: !suspend },
  });

  revalidatePath("/admin/schools");
  revalidatePath(`/admin/schools/${id}`);
  return { ok: true as const };
}

/** Revoke or restore portal login for all school-role users of this school. */
export async function setSchoolPortalUsersActiveAction(formData: FormData) {
  await requireAdmin();
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  if (!schoolId) return { error: "Missing school." };

  await prisma.user.updateMany({
    where: { schoolId, role: "SCHOOL" },
    data: { isActive: active },
  });

  revalidatePath("/admin/schools");
  revalidatePath(`/admin/schools/${schoolId}`);
  return { ok: true as const };
}

export async function deleteSchoolAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing school." };

  await prisma.school.delete({
    where: { id },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/schools");
  revalidatePath("/admin/students");
  revalidatePath("/admin/omr");
  revalidatePath("/admin/scores");
  return { ok: true as const };
}
