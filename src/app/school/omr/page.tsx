import { prisma } from "@/lib/prisma";
import { requireSchool } from "@/lib/auth";
import { listActiveExams } from "@/lib/exam-store";

export default async function SchoolOmrPage() {
  const { schoolId } = await requireSchool();
  const [school, exams] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        students: {
          include: { enrollments: true },
          orderBy: [{ className: "asc" }, { rollNo: "asc" }],
        },
      },
    }),
    listActiveExams(),
  ]);
  const examMap = new Map(exams.map((e) => [e.code, e.name]));

  let pairs: { studentId: string; examCode: string; name: string; rollNo: string }[] = [];
  if (school) {
    for (const st of school.students) {
      for (const e of st.enrollments) {
        pairs.push({
          studentId: st.id,
          examCode: e.examCode,
          name: st.name,
          rollNo: st.rollNo,
        });
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">OMR PDF</h1>
        <p className="mt-2 text-sm text-slate-400">
          Download the full pack for your school (same layout as admin) or a single sheet for one
          student and exam.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Full school pack</h2>
        <p className="mt-2 text-sm text-slate-500">
          {school?.name} · <span className="font-mono text-sky-300">{school?.code}</span>
        </p>
        <a
          href={`/api/omr/school?schoolId=${encodeURIComponent(schoolId)}`}
          className="btn btn-primary mt-4 inline-flex"
        >
          Download school OMR PDF
        </a>
        <a
          href={`/api/attendance/school?schoolId=${encodeURIComponent(schoolId)}`}
          className="btn btn-ghost mt-4 ml-3 inline-flex"
        >
          Download attendance PDF
        </a>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Single sheet (one student × one exam)
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">PDF</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={`${p.studentId}-${p.examCode}`} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{p.rollNo}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {p.examCode} — {examMap.get(p.examCode) ?? p.examCode}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/omr/single?studentId=${encodeURIComponent(p.studentId)}&examCode=${encodeURIComponent(p.examCode)}`}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Download
                    </a>
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
