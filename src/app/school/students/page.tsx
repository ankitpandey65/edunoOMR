import { prisma } from "@/lib/prisma";
import { requireSchool } from "@/lib/auth";
import { schoolCreateStudentAction, schoolRequestStudentChangeAction } from "@/actions/students";
import { listActiveExams } from "@/lib/exam-store";
import { BulkUpload } from "./BulkUpload";

export default async function SchoolStudentsPage() {
  const { schoolId } = await requireSchool();
  const [school, students, exams] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.student.findMany({
      where: { schoolId },
      include: { enrollments: true },
      orderBy: [{ className: "asc" }, { section: "asc" }, { rollNo: "asc" }],
    }),
    listActiveExams(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Students</h1>
        <p className="mt-2 text-sm text-slate-400">
          Roll numbers must be unique within your school. Students can opt multiple exams.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Bulk upload (CSV)</h2>
        <p className="mt-2 text-sm text-slate-500">
          School: <span className="text-slate-300">{school?.name}</span> · Code{" "}
          <span className="font-mono text-sky-300">{school?.code}</span>
        </p>
        <div className="mt-4">
          <BulkUpload />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Add one student</h2>
        <form action={schoolCreateStudentAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Roll no</label>
            <input name="rollNo" required className="input" />
          </div>
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Class</label>
            <input name="className" required className="input" />
          </div>
          <div>
            <label className="label">Section</label>
            <input name="section" className="input" />
          </div>
          <div>
            <label className="label">Father name</label>
            <input name="fatherName" className="input" />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input name="dob" className="input" placeholder="YYYY-MM-DD" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mobile</label>
            <input name="mobile" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Exams (multi-select)</label>
            <select name="examCodes" multiple className="input min-h-[130px]">
              {exams.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple exams.</p>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Save student
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          All students ({students.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Exams</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-3 font-mono text-slate-300">{st.rollNo}</td>
                  <td className="px-4 py-3 text-white">{st.name}</td>
                  <td className="px-4 py-3">
                    {st.className}
                    {st.section ? `-${st.section}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {st.enrollments.map((e) => e.examCode).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <details className="max-w-[320px]">
                      <summary className="cursor-pointer text-xs text-sky-400">Request change</summary>
                      <form action={schoolRequestStudentChangeAction} className="mt-3 space-y-2 rounded-lg bg-white/5 p-3">
                        <input type="hidden" name="studentId" value={st.id} />
                        <input name="rollNo" defaultValue={st.rollNo} className="input text-xs" />
                        <input name="name" defaultValue={st.name} className="input text-xs" />
                        <input name="className" defaultValue={st.className} className="input text-xs" />
                        <input name="section" defaultValue={st.section} className="input text-xs" />
                        <input
                          name="fatherName"
                          defaultValue={st.fatherName ?? ""}
                          className="input text-xs"
                        />
                        <input name="dob" defaultValue={st.dob ?? ""} className="input text-xs" />
                        <input name="mobile" defaultValue={st.mobile ?? ""} className="input text-xs" />
                        <select
                          name="examCodes"
                          multiple
                          className="input min-h-[120px] text-xs"
                          defaultValue={st.enrollments.map((e) => e.examCode)}
                        >
                          {exams.map((e) => (
                            <option key={e.code} value={e.code}>
                              {e.code} — {e.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="btn btn-ghost w-full text-xs">
                          Submit for admin approval
                        </button>
                      </form>
                    </details>
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
