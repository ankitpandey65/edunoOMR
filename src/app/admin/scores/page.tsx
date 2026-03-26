import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteScanResultAction, deleteSchoolScoresAction } from "@/actions/score-admin";

export default async function AdminScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ schoolId?: string }>;
}) {
  await requireAdmin();
  const { schoolId } = await searchParams;

  const [schools, schoolCounts, rows] = await Promise.all([
    prisma.school.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: true } },
      },
    }),
    prisma.scanResult.groupBy({
      by: ["studentId"],
      _count: { _all: true },
    }),
    prisma.scanResult.findMany({
      where: schoolId ? { student: { schoolId } } : {},
      orderBy: [{ processedAt: "desc" }],
      include: { student: { include: { school: true } } },
      take: schoolId ? 1000 : 150,
    }),
  ]);

  const schoolCountMap = new Map<string, number>();
  if (schoolCounts.length > 0) {
    const students = await prisma.student.findMany({
      where: { id: { in: schoolCounts.map((r) => r.studentId) } },
      select: { id: true, schoolId: true },
    });
    const studentSchool = new Map(students.map((s) => [s.id, s.schoolId]));
    for (const row of schoolCounts) {
      const sid = studentSchool.get(row.studentId);
      if (!sid) continue;
      schoolCountMap.set(sid, (schoolCountMap.get(sid) ?? 0) + row._count._all);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Final scores</h1>
        <p className="mt-2 text-sm text-slate-400">
          School-wise score records. Open a school to view student rows, export CSV, and download
          scorecards.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Schools
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Score rows</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.code}</td>
                  <td className="px-4 py-3 text-slate-300">{schoolCountMap.get(s.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/scores?schoolId=${encodeURIComponent(s.id)}`} className="btn">
                        Open
                      </Link>
                      <a href={`/api/scores/export?schoolId=${encodeURIComponent(s.id)}`} className="btn">
                        CSV
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {schoolId ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-medium text-slate-300">Selected school score records</div>
            <form action={deleteSchoolScoresAction}>
              <input type="hidden" name="schoolId" value={schoolId} />
              <button type="submit" className="btn">
                Delete all score rows for this school
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Roll</th>
                  <th className="px-4 py-3">Exam</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Download</th>
                  <th className="px-4 py-3">Delete</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-500">
                      {r.processedAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-3 text-white">{r.student.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.student.rollNo}</td>
                    <td className="px-4 py-3 font-mono text-xs text-sky-300">{r.examCode}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.score != null && r.maxScore != null ? `${r.score} / ${r.maxScore}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.score != null && r.maxScore != null ? (
                        <a
                          href={`/api/scorecard/scan/${r.id}`}
                          className="text-sky-400 underline hover:text-sky-300"
                        >
                          Download
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={deleteScanResultAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="btn">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
