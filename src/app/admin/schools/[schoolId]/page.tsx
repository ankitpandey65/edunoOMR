import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSchoolExamClassBreakdown } from "@/lib/school-exam-stats";
import {
  updateSchoolAction,
  setSchoolSuspendedAction,
  setSchoolPortalUsersActiveAction,
} from "@/actions/schools";

type PageProps = { params: Promise<{ schoolId: string }> };

export default async function AdminSchoolDetailPage({ params }: PageProps) {
  const { schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      users: {
        where: { role: "SCHOOL" },
        select: { id: true, email: true, isActive: true, name: true },
      },
      _count: { select: { students: true } },
    },
  });
  if (!school) notFound();

  const breakdown = await getSchoolExamClassBreakdown(schoolId);
  const portalActive =
    school.users.length > 0 && school.users.some((u) => u.isActive) && school.isActive;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/schools"
            className="text-xs text-sky-400 hover:underline"
          >
            ← Schools
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">{school.name}</h1>
          <p className="mt-1 font-mono text-sm text-sky-300">{school.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {school.isActive ? (
            <form action={setSchoolSuspendedAction}>
              <input type="hidden" name="id" value={school.id} />
              <input type="hidden" name="suspend" value="true" />
              <button
                type="submit"
                className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10"
              >
                Suspend school
              </button>
            </form>
          ) : (
            <form action={setSchoolSuspendedAction}>
              <input type="hidden" name="id" value={school.id} />
              <input type="hidden" name="suspend" value="false" />
              <button
                type="submit"
                className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10"
              >
                Reactivate school
              </button>
            </form>
          )}
          {portalActive ? (
            <form action={setSchoolPortalUsersActiveAction}>
              <input type="hidden" name="schoolId" value={school.id} />
              <input type="hidden" name="active" value="false" />
              <button
                type="submit"
                className="rounded-xl border border-amber-500/40 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
              >
                Revoke portal logins
              </button>
            </form>
          ) : (
            school.users.length > 0 && (
              <form action={setSchoolPortalUsersActiveAction}>
                <input type="hidden" name="schoolId" value={school.id} />
                <input type="hidden" name="active" value="true" />
                <button
                  type="submit"
                  className="rounded-xl border border-sky-500/40 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/10"
                >
                  Restore portal logins
                </button>
              </form>
            )
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-500">Students</div>
          <div className="mt-1 text-2xl font-semibold text-white">{school._count.students}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-500">Total exam enrolments</div>
          <div className="mt-1 text-2xl font-semibold text-white">{breakdown.totalEnrollments}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-500">Portal users</div>
          <div className="mt-1 text-sm text-slate-300">
            {school.users.map((u) => (
              <div key={u.id} className="flex justify-between gap-2 text-xs">
                <span className="truncate text-slate-400">{u.email}</span>
                <span className={u.isActive ? "text-emerald-400" : "text-red-400"}>
                  {u.isActive ? "on" : "off"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Edit school details</h2>
        <p className="mt-1 text-sm text-slate-500">School code is fixed and cannot be changed.</p>
        <form action={updateSchoolAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={school.id} />
          <div className="sm:col-span-2">
            <label className="label">School name</label>
            <input name="name" required defaultValue={school.name} className="input" />
          </div>
          <div>
            <label className="label">Contact</label>
            <input name="contact" defaultValue={school.contact ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Address</label>
            <input name="address" defaultValue={school.address ?? ""} className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/pending?schoolId=${encodeURIComponent(school.id)}`}
          className="btn btn-ghost text-sm"
        >
          View change requests for this school
        </Link>
        <Link href={`/admin/students?school=${school.id}`} className="btn btn-ghost text-sm">
          Open students (filtered)
        </Link>
      </div>

      <div id="breakdown" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold text-white">Exam & class breakdown</h2>
        <p className="text-sm text-slate-400">
          Each cell is one student enrolled for one exam (one OMR sheet). Totals roll up by exam
          code and by class/section.
        </p>

        {breakdown.totalsByExam.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-4 py-2 text-xs font-medium uppercase text-slate-500">
              By exam (totals)
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.03] text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Exam code</th>
                  <th className="px-4 py-2 text-left">Exam</th>
                  <th className="px-4 py-2 text-right">OMR sheets</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.totalsByExam.map((row) => (
                  <tr key={row.examCode} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono text-sky-300">{row.examCode}</td>
                    <td className="px-4 py-2 text-slate-300">{row.examTitle}</td>
                    <td className="px-4 py-2 text-right text-white">{row.count}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/10 bg-white/[0.04] font-medium">
                  <td className="px-4 py-2 text-slate-400" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right text-white">{breakdown.totalEnrollments}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card p-6 text-sm text-slate-500">No exam enrolments yet for this school.</div>
        )}

        {breakdown.rows.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="border-b border-white/10 px-4 py-2 text-xs font-medium uppercase text-slate-500">
              By exam, class & section
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.03] text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Exam</th>
                    <th className="px-4 py-2 text-left">Class</th>
                    <th className="px-4 py-2 text-left">Section</th>
                    <th className="px-4 py-2 text-right">OMR sheets</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.rows.map((row, i) => (
                    <tr key={`${row.examCode}-${row.className}-${row.section}-${i}`} className="border-t border-white/5">
                      <td className="px-4 py-2">
                        <span className="font-mono text-sky-300">{row.examCode}</span>{" "}
                        <span className="text-slate-500">· {row.examTitle}</span>
                      </td>
                      <td className="px-4 py-2 text-white">{row.className}</td>
                      <td className="px-4 py-2 text-slate-400">{row.section || "—"}</td>
                      <td className="px-4 py-2 text-right font-medium text-white">{row.omrSheets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
