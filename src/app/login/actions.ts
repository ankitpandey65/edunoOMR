"use server";

import { redirect } from "next/navigation";
import { loginWithEmailPassword } from "@/lib/auth";

export type LoginState = { error?: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const r = await loginWithEmailPassword(email, password);
  if ("error" in r) {
    return { error: r.error };
  }
  if (r.role === "ADMIN") redirect("/admin");
  redirect("/school");
}
