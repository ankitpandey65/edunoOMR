import { prisma } from "@/lib/prisma";

export default async function AdminOmrPage() {
  const schools = await prisma.school.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">OMR PDF packs</h1>
        <p className="mt-2 text-sm text-slate-400">
          Generates one PDF per school: summary page, exam overview pages, then per-student OMR
          sheets grouped by exam.
        </p>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Download
        </div>
        <div className="divide-y divide-white/5">
          {schools.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <div className="font-medium text-white">{s.name}</div>
                <div className="font-mono text-xs text-sky-300">{s.code}</div>
              </div>
              <a
                href={`/api/omr/school?schoolId=${encodeURIComponent(s.id)}`}
                className="btn btn-primary text-sm"
              >
                Download full OMR PDF
              </a>
              <a
                href={`/api/attendance/school?schoolId=${encodeURIComponent(s.id)}`}
                className="btn btn-ghost text-sm"
              >
                Download attendance PDF
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
