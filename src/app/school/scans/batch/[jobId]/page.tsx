import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSchool } from "@/lib/auth";

export default async function SchoolBatchJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { schoolId } = await requireSchool();
  const { jobId } = await params;
  const job = await prisma.omrBatchJob.findFirst({
    where: { id: jobId, schoolId },
    include: {
      pages: { orderBy: { pageIndex: "asc" }, include: { student: true } },
      school: true,
    },
  });
  if (!job) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/school/scans" className="text-xs text-indigo-400 hover:underline">
          ← Scan & score
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Batch OMR results</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{job.fileName}</p>
        <p className="mt-2 text-sm text-slate-400">
          {job.totalPages} pages · {job.okCount} OK · {job.errCount} errors
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Page</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">Set</th>
              <th className="px-4 py-3">Attempted</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Correct</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Scorecard</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {job.pages.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-400">{p.pageIndex}</td>
                <td className="px-4 py-3 text-white">
                  {p.student ? (
                    <>
                      {p.student.name}
                      <span className="block text-xs font-mono text-slate-500">
                        Roll {p.student.rollNo}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-300">{p.examCode ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-300">{p.paperSet ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{p.attemptedQuestions ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{p.totalQuestions ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{p.correctAnswers ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">
                  {p.score != null && p.maxScore != null ? `${p.score} / ${p.maxScore}` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{p.scanSource ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.score != null && p.maxScore != null && !p.error ? (
                    <a
                      href={`/api/scorecard/page/${p.id}`}
                      className="text-indigo-400 underline hover:text-indigo-300"
                    >
                      Download PDF
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[200px] px-4 py-3 text-xs text-amber-200/90">
                  {p.error ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
