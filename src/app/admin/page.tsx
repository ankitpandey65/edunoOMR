import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [schoolsTotal, schoolsActive, studentsTotal, pending, enrollments, scans] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { isActive: true } }),
    prisma.student.count(),
    prisma.pendingStudentChange.count({ where: { status: "PENDING" } }),
    prisma.enrollment.count(),
    prisma.scanResult.count(),
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
          <div className="mt-2 text-3xl font-semibold text-white">{schoolsTotal}</div>
          <div className="mt-1 text-xs text-slate-500">Active: {schoolsActive}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Students</div>
          <div className="mt-2 text-3xl font-semibold text-white">{studentsTotal}</div>
          <div className="mt-1 text-xs text-slate-500">OMR sheets: {enrollments}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Pending approvals</div>
          <div className="mt-2 text-3xl font-semibold text-amber-300">{pending}</div>
          <div className="mt-1 text-xs text-slate-500">Scans processed: {scans}</div>
        </div>
      </div>
    </div>
  );
}
