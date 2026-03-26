import { prisma } from "@/lib/prisma";

export default async function AdminHome() {
  const [schools, students, pending] = await Promise.all([
    prisma.school.count(),
    prisma.student.count(),
    prisma.pendingStudentChange.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="mt-2 text-sm text-slate-400">
          Register schools, manage students and exams, generate OMR packs, then scan and score.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Schools</div>
          <div className="mt-2 text-3xl font-semibold text-white">{schools}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Students</div>
          <div className="mt-2 text-3xl font-semibold text-white">{students}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Pending approvals</div>
          <div className="mt-2 text-3xl font-semibold text-amber-300">{pending}</div>
        </div>
      </div>
    </div>
  );
}
