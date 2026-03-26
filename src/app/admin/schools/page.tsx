import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  createSchoolAction,
  setSchoolPortalUsersActiveAction,
  setSchoolSuspendedAction,
} from "@/actions/schools";
import { SchoolsSearch } from "./SchoolsSearch";

export default async function AdminSchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const qRaw = sp.q?.trim() ?? "";

  const allSchools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { students: true, users: true } },
      users: {
        where: { role: "SCHOOL" },
        select: { id: true, isActive: true, email: true },
      },
    },
  });

  const schools = qRaw
    ? allSchools.filter(
        (s) =>
          s.name.toLowerCase().includes(qRaw.toLowerCase()) ||
          s.code.toLowerCase().includes(qRaw.toLowerCase())
      )
    : allSchools;

  const enrollments = await prisma.enrollment.findMany({
    select: { student: { select: { schoolId: true } } },
  });
  const examCountBySchool = new Map<string, number>();
  for (const e of enrollments) {
    const sid = e.student.schoolId;
    examCountBySchool.set(sid, (examCountBySchool.get(sid) ?? 0) + 1);
  }

  const pendingList = await prisma.pendingStudentChange.findMany({
    where: { status: "PENDING" },
    select: { student: { select: { schoolId: true } } },
  });
  const pendingBySchool = new Map<string, number>();
  for (const p of pendingList) {
    const sid = p.student.schoolId;
    pendingBySchool.set(sid, (pendingBySchool.get(sid) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Schools</h1>
        <p className="mt-2 text-sm text-slate-400">
          Register schools, search the directory, and manage access. Exam totals count enrolments
          (OMR sheets) across all classes.
        </p>
      </div>

      <div className="card p-4">
        <SchoolsSearch defaultQ={qRaw} />
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Register school</h2>
        <form action={createSchoolAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">School name</label>
            <input name="name" required className="input" placeholder="NAVODYA VIDYA NIKETAN" />
          </div>
          <div>
            <label className="label">Contact (optional)</label>
            <input name="contact" className="input" placeholder="+91-..." />
          </div>
          <div>
            <label className="label">Address (optional)</label>
            <input name="address" className="input" />
          </div>
          <div>
            <label className="label">School login email</label>
            <input name="userEmail" type="email" required className="input" />
          </div>
          <div>
            <label className="label">School login password</label>
            <input name="userPassword" type="password" required minLength={6} className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Create school & user
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <span className="text-sm font-medium text-slate-300">
            All schools ({schools.length}
            {qRaw ? ` · filtered` : ""})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Students</th>
                <th className="px-3 py-3">Total exams</th>
                <th className="px-3 py-3">Requests</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => {
                const exams = examCountBySchool.get(s.id) ?? 0;
                const pending = pendingBySchool.get(s.id) ?? 0;
                const schoolUsers = s.users;
                const portalActive =
                  schoolUsers.length > 0 && schoolUsers.some((u) => u.isActive) && s.isActive;

                return (
                  <tr key={s.id} className="border-t border-white/5 align-middle">
                    <td className="px-3 py-3 font-mono text-sky-300">{s.code}</td>
                    <td className="max-w-[200px] px-3 py-3 text-white">{s.name}</td>
                    <td className="px-3 py-3">{s._count.students}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/schools/${s.id}#breakdown`}
                        className="font-medium text-sky-400 underline-offset-2 hover:underline"
                      >
                        {exams}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {pending > 0 ? (
                        <Link
                          href={`/admin/pending?schoolId=${encodeURIComponent(s.id)}`}
                          className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30"
                        >
                          {pending} pending
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <span
                          className={
                            s.isActive ? "text-emerald-400/90" : "text-red-400/90"
                          }
                        >
                          {s.isActive ? "School active" : "Suspended"}
                        </span>
                        <span className={portalActive ? "text-slate-400" : "text-amber-400/90"}>
                          {portalActive ? "Portal OK" : "Portal locked"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Link
                          href={`/admin/schools/${s.id}`}
                          className="btn btn-ghost py-1.5 text-xs"
                        >
                          Edit
                        </Link>
                        {s.isActive ? (
                          <form action={setSchoolSuspendedAction} className="inline">
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="suspend" value="true" />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                            >
                              Suspend
                            </button>
                          </form>
                        ) : (
                          <form action={setSchoolSuspendedAction} className="inline">
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="suspend" value="false" />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                            >
                              Reactivate
                            </button>
                          </form>
                        )}
                        {portalActive ? (
                          <form action={setSchoolPortalUsersActiveAction} className="inline">
                            <input type="hidden" name="schoolId" value={s.id} />
                            <input type="hidden" name="active" value="false" />
                            <button
                              type="submit"
                              className="rounded-lg border border-amber-500/30 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
                              title="Disable school portal logins"
                            >
                              Revoke login
                            </button>
                          </form>
                        ) : (
                          schoolUsers.length > 0 && (
                            <form action={setSchoolPortalUsersActiveAction} className="inline">
                              <input type="hidden" name="schoolId" value={s.id} />
                              <input type="hidden" name="active" value="true" />
                              <button
                                type="submit"
                                className="rounded-lg border border-sky-500/30 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10"
                                title="Re-enable school portal logins"
                              >
                                Restore login
                              </button>
                            </form>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {schools.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No schools match your search.</div>
        ) : null}
      </div>
    </div>
  );
}
