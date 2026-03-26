import { prisma } from "@/lib/prisma";
import { requireSchool } from "@/lib/auth";
import Link from "next/link";

export default async function SchoolHome() {
  const { schoolId } = await requireSchool();
  const [students, pending] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.pendingStudentChange.count({
      where: { status: "PENDING", student: { schoolId } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">School dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Add students, map exams, download OMR PDFs, and track approval requests for edits.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Students</div>
          <div className="mt-2 text-3xl font-semibold text-white">{students}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500">Pending change requests</div>
          <div className="mt-2 text-3xl font-semibold text-amber-300">{pending}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/school/students" className="btn btn-primary">
          Manage students
        </Link>
        <Link href="/school/omr" className="btn btn-ghost">
          Download OMR PDF
        </Link>
        <Link href="/school/pending" className="btn btn-ghost">
          My requests
        </Link>
      </div>
    </div>
  );
}
