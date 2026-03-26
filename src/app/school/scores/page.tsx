import { prisma } from "@/lib/prisma";
import { requireSchool } from "@/lib/auth";

export default async function SchoolScoresPage() {
  const { schoolId } = await requireSchool();
  const rows = await prisma.scanResult.findMany({
    where: { student: { schoolId } },
    orderBy: [{ processedAt: "desc" }],
    include: { student: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Final scores</h1>
        <p className="mt-2 text-sm text-slate-400">
          Export results for your school and download scorecard per student.
        </p>
      </div>

      <div className="card p-4">
        <a href="/api/scores/export" className="btn btn-primary">
          Export all scores (CSV)
        </a>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Attempted</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Correct</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Scorecard</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-indigo-300">{r.examCode}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">{r.paperSet ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.attemptedQuestions ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.totalQuestions ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.correctAnswers ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.score != null && r.maxScore != null ? `${r.score} / ${r.maxScore}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.score != null && r.maxScore != null ? (
                      <a
                        href={`/api/scorecard/scan/${r.id}`}
                        className="text-indigo-400 underline hover:text-indigo-300"
                      >
                        Download
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
