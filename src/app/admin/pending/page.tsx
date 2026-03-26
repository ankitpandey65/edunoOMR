import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { approvePendingAction, rejectPendingAction } from "@/actions/pending";

export default async function AdminPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ schoolId?: string }>;
}) {
  const sp = await searchParams;
  const filterSchoolId = sp.schoolId?.trim();

  const schools = await prisma.school.findMany({ orderBy: { name: "asc" } });

  const rows = await prisma.pendingStudentChange.findMany({
    where: {
      status: "PENDING",
      ...(filterSchoolId ? { student: { schoolId: filterSchoolId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      student: { include: { school: true, enrollments: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Change approvals</h1>
        <p className="mt-2 text-sm text-slate-400">
          Schools submit edits here. Approve to apply updates to student records and exam mapping.
        </p>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Filter by school</label>
            <select name="schoolId" className="input min-w-[240px]" defaultValue={filterSchoolId ?? ""}>
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
        </form>
        {filterSchoolId ? (
          <Link href="/admin/pending" className="btn btn-ghost text-sm">
            Clear filter
          </Link>
        ) : null}
      </div>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-400">No pending requests.</div>
        ) : (
          rows.map((row) => {
            let payload: {
              rollNo?: string;
              name?: string;
              className?: string;
              section?: string;
              fatherName?: string | null;
              dob?: string | null;
              mobile?: string | null;
              examCodes?: string[];
            } = {};
            try {
              payload = JSON.parse(row.payload) as typeof payload;
            } catch {
              payload = {};
            }
            return (
              <div key={row.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase text-slate-500">School</div>
                    <div className="font-medium text-white">{row.student.school.name}</div>
                    <div className="mt-2 text-sm text-slate-400">
                      Current: {row.student.name} · Roll {row.student.rollNo} · Class{" "}
                      {row.student.className}
                      {row.student.section ? `-${row.student.section}` : ""}
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-500">Proposed:</span> {payload.name} · Roll{" "}
                        {payload.rollNo} · Class {payload.className}
                        {payload.section ? `-${payload.section}` : ""}
                      </div>
                      <div className="text-xs text-slate-500">
                        Exams: {(payload.examCodes ?? []).join(", ") || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={approvePendingAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="btn btn-primary text-sm">
                        Approve
                      </button>
                    </form>
                    <form action={rejectPendingAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="btn btn-ghost text-sm text-red-300">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
