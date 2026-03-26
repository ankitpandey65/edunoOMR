import { prisma } from "@/lib/prisma";
import { adminUpsertStudentAction } from "@/actions/students";
import { listActiveExams } from "@/lib/exam-store";
import { AdminBulkUpload } from "./AdminBulkUpload";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const sp = await searchParams;
  const [schools, exams] = await Promise.all([
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    listActiveExams(),
  ]);
  const filterSchool = sp.school ?? schools[0]?.id;

  if (schools.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400">
        Register a school first under <strong className="text-white">Schools</strong>.
      </div>
    );
  }

  const students = filterSchool
    ? await prisma.student.findMany({
        where: { schoolId: filterSchool },
        include: { school: true, enrollments: true },
        orderBy: [{ className: "asc" }, { section: "asc" }, { rollNo: "asc" }],
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Students</h1>
        <p className="mt-2 text-sm text-slate-400">
          Admins can edit any student and exam mapping directly — changes apply immediately.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label">School</label>
          <select name="school" className="input min-w-[220px]" defaultValue={filterSchool}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-ghost">
          Filter
        </button>
      </form>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Bulk upload (CSV)</h2>
        <p className="mt-2 text-sm text-slate-400">
          Import many students for the school selected in the filter above. Download the sample file, fill or replace
          rows, then upload.
        </p>
        <div className="mt-4">
          <AdminBulkUpload schoolId={filterSchool} />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Add / edit student</h2>
        <form action={adminUpsertStudentAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="schoolId" value={filterSchool ?? ""} />
          <input type="hidden" name="id" value="" />
          <div>
            <label className="label">Roll no (school)</label>
            <input name="rollNo" required className="input" />
          </div>
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Class</label>
            <input name="className" required className="input" placeholder="9" />
          </div>
          <div>
            <label className="label">Section</label>
            <input name="section" className="input" placeholder="A" />
          </div>
          <div>
            <label className="label">Father name</label>
            <input name="fatherName" className="input" />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input name="dob" className="input" placeholder="YYYY-MM-DD" />
          </div>
          <div>
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
              Add student
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Students ({students.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Exams</th>
                <th className="px-4 py-3">Edit</th>
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
                    <details className="max-w-[300px]">
                      <summary className="cursor-pointer text-xs text-sky-400">Edit</summary>
                      <form action={adminUpsertStudentAction} className="mt-3 space-y-2 rounded-lg bg-white/5 p-3">
                        <input type="hidden" name="id" value={st.id} />
                        <input type="hidden" name="schoolId" value={st.schoolId} />
                        <input name="rollNo" defaultValue={st.rollNo} className="input text-xs" required />
                        <input name="name" defaultValue={st.name} className="input text-xs" required />
                        <input name="className" defaultValue={st.className} className="input text-xs" required />
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
                        <button type="submit" className="btn btn-primary w-full text-xs">
                          Save (immediate)
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
