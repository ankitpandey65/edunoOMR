import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { code: true, name: true },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card w-full max-w-lg p-8">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">Eduno</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Register with OTP</h1>
          <p className="mt-2 text-sm text-slate-400">
            Email is mandatory. OTP is valid for 10 minutes.
          </p>
        </div>
        <RegisterForm schools={schools} />
        <p className="mt-4 text-center text-xs">
          <Link href="/login" className="text-sky-400/90 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
