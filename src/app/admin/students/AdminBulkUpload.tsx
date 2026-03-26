"use client";

import { useFormState, useFormStatus } from "react-dom";
import { adminBulkImportStudentsAction } from "@/actions/students";

const SAMPLE_HREF = "/samples/students-upload-sample.csv";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Importing…" : "Import CSV"}
    </button>
  );
}

export function AdminBulkUpload({ schoolId }: { schoolId: string }) {
  const [state, action] = useFormState(adminBulkImportStudentsAction, null);

  return (
    <form action={action} encType="multipart/form-data" className="space-y-3">
      <input type="hidden" name="schoolId" value={schoolId} />
      {state?.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Imported <strong>{state.created}</strong> students.
          {state.errors?.length ? (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-200">
              {state.errors.slice(0, 12).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={SAMPLE_HREF}
          download="students-upload-sample.csv"
          className="btn btn-ghost text-sm"
        >
          Download sample CSV
        </a>
        <span className="text-xs text-slate-500">
          Fill the template, then upload it for the school selected above (use Filter if you change school).
        </span>
      </div>
      <div>
        <label className="label">CSV file</label>
        <input name="file" type="file" accept=".csv,text/csv" required className="input" />
        <p className="mt-2 text-xs text-slate-500">
          Required columns: <code className="text-slate-400">rollNo</code>,{" "}
          <code className="text-slate-400">name</code>, <code className="text-slate-400">className</code>{" "}
          (or <code className="text-slate-400">class</code>). Optional: section, fatherName, dob, mobile, exams.
          Multiple exam codes in <code className="text-slate-400">exams</code> can be comma-separated; use quotes if
          needed (see sample file).
        </p>
      </div>
      <Submit />
    </form>
  );
}
