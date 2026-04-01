"use server";

import { redirect } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function logoutAction() {
  const s = await getSession();
  const accessLogModel = (prisma as unknown as { accessLog?: any }).accessLog;
  if (s && accessLogModel) {
    try {
      await accessLogModel.create({
        data: {
          userId: s.sub,
          email: s.email,
          role: s.role,
          action: "LOGOUT",
          success: true,
          details: "Logout success",
        },
      });
    } catch {
      // Do not block logout.
    }
  }
  await clearSession();
  redirect("/login");
}
