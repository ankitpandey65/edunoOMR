import { redirect } from "next/navigation";
import { SchoolShell } from "@/components/SchoolShell";
import { prisma } from "@/lib/prisma";
import { clearSession, requireSchool } from "@/lib/auth";

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSchool();
  const [school, user] = await Promise.all([
    prisma.school.findUnique({ where: { id: session.schoolId } }),
    prisma.user.findUnique({ where: { id: session.sub } }),
  ]);
  if (!school || !user) {
    await clearSession();
    redirect("/login");
  }
  if (!school.isActive || !user.isActive) {
    await clearSession();
    redirect("/login");
  }
  return <SchoolShell schoolName={school.name}>{children}</SchoolShell>;
}
