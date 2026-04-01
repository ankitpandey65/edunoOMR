"use client";

import { useFormState, useFormStatus } from "react-dom";
import { bulkImportStudentsAction } from "@/actions/students";

const SAMPLE_HREF = "/samples/students-upload-sample.csv";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Importing…" : "Import CSV"}
    </button>
  );
}

export function BulkUpload() {
  const [state, action] = useFormState(bulkImportStudentsAction, null);

  return (
    <form action={action} encType="multipart/form-data" className="space-y-3">
      {state?.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Imported <strong>{state.created}</strong> students.
          {typeof state.skipped === "number" ? (
            <>
              {" "}
              Skipped duplicates: <strong>{state.skipped}</strong>.
            </>
          ) : null}
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
        <span className="text-xs text-slate-500">Use this template, edit rows, then upload.</span>
      </div>
      <div>
        <label className="label">CSV file</label>
        <input name="file" type="file" accept=".csv,text/csv" required className="input" />
        <p className="mt-2 text-xs text-slate-500">
          Header:{" "}
          <code className="text-slate-400">rollNo,name,className,section,fatherName,dob,mobile,exams</code>. Exam
          codes in <code className="text-slate-400">exams</code> are comma- or semicolon-separated (quotes optional for
          multiple codes).
        </p>
      </div>
      <Submit />
    </form>
  );
}
