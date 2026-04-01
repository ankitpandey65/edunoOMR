import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ScanForm } from "@/components/ScanForm";
import { BatchOmrForm } from "@/components/BatchOmrForm";
import { listActiveExams } from "@/lib/exam-store";
import { ScoreTable } from "@/components/ScoreTable";
import { clearAllScanDataAction, deleteBatchJobAction } from "@/actions/score-admin";

export default async function AdminScansPage() {
  const [recent, batchJobs, exams] = await Promise.all([
    prisma.scanResult.findMany({
      orderBy: { processedAt: "desc" },
      take: 25,
      include: {
        student: { include: { school: true } },
      },
    }),
    prisma.omrBatchJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { school: true },
    }),
    listActiveExams(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Scan & score</h1>
        <p className="mt-2 text-sm text-slate-400">
          Single-page image upload, or batch PDF processing. Ensure answer keys exist per exam and
          class + paper set for automatic scoring. OMR reading works best with straight scans and
          our official sheet layout.
        </p>
        <form action={clearAllScanDataAction} className="mt-3">
          <button type="submit" className="btn btn-ghost text-xs">
            Clear all scan jobs and score data
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Batch OMR (PDF)</h2>
        <p className="mt-2 text-sm text-slate-500">
          Upload one PDF containing many scanned OMR pages (one sheet per page). Each page is
          decoded via QR, bubbles are read, and scores are computed. Download scorecards per student
          from the results view.
        </p>
        <div className="mt-4">
          <BatchOmrForm />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Recent batch jobs
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Pages</th>
                <th className="px-4 py-3">OK / Err</th>
                <th className="px-4 py-3">Results</th>
                <th className="px-4 py-3">Delete</th>
              </tr>
            </thead>
            <tbody>
              {batchJobs.map((j) => (
                <tr key={j.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-500">
                    {j.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-slate-300">{j.fileName}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {j.school?.name ?? "— (admin)"}
                  </td>
                  <td className="px-4 py-3">{j.totalPages}</td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-400">{j.okCount}</span> /{" "}
                    <span className="text-amber-400">{j.errCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/scans/batch/${j.id}`} className="text-sky-400 hover:underline">
                      Open
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <form action={deleteBatchJobAction}>
                      <input type="hidden" name="id" value={j.id} />
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
        {batchJobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No batch jobs yet.</div>
        ) : null}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Single page (image)</h2>
        <p className="mt-2 text-sm text-slate-500">
          PNG/JPEG of one OMR sheet. Best flow is QR auto-detect. If QR is unreadable, use
          manual fallback with Roll No + Exam + School Code.
        </p>
        <div className="mt-4">
          <ScanForm exams={exams} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Score records</h2>
        <p className="mt-2 text-sm text-slate-500">
          Includes single and batch scans. Filter by exam, class, set, and search by student/roll.
        </p>
        <div className="mt-4">
          <ScoreTable
            showSchool
            rows={recent.map((r) => ({
              id: r.id,
              processedAt: r.processedAt.toISOString(),
              schoolName: r.student.school.name,
              studentName: r.student.name,
              rollNo: r.student.rollNo,
              className: r.student.className,
              examCode: r.examCode,
              paperSet: r.paperSet,
              attemptedQuestions: r.attemptedQuestions,
              totalQuestions: r.totalQuestions,
              correctAnswers: r.correctAnswers,
              score: r.score,
              maxScore: r.maxScore,
              scanSource: r.scanSource,
            }))}
          />
          <div className="mt-4 rounded border border-white/10 p-3 text-xs text-slate-400">
            Need row cleanup? Use <Link href="/admin/scores" className="text-sky-400 underline">Final scores</Link>{" "}
            to delete by school or per score record.
          </div>
        </div>
      </div>
    </div>
  );
}
