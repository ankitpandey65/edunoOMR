import {
  addExamAction,
  deleteExamAction,
  saveAppSettingsAction,
  updateExamAction,
} from "@/actions/admin-config";
import { getAppSettings } from "@/lib/app-settings";
import { listAllExams } from "@/lib/exam-store";
import Link from "next/link";

export default async function AdminSettingsPage() {
  const [settings, exams] = await Promise.all([getAppSettings(), listAllExams()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage platform settings in sections: OMR/attendance, theme, exams, and access management.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Section 1: OMR and attendance header</h2>
        <form action={saveAppSettingsAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Exam session / year</label>
            <input
              name="examSession"
              defaultValue={settings.examSession ?? ""}
              className="input"
              placeholder="2026-27"
            />
            <p className="mt-1 text-xs text-slate-500">
              Used in Attendance and now also shown on OMR sheet header.
            </p>
          </div>
          <div>
            <label className="label">OMR header note (optional)</label>
            <input
              name="omrHeaderNote"
              defaultValue={settings.omrHeaderNote ?? ""}
              className="input"
              placeholder="Mid-term cycle"
            />
          </div>
          <div>
            <label className="label">Theme</label>
            <select name="theme" defaultValue={settings.theme} className="input">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Save section settings
            </button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Section 2: Access and users</h2>
          <Link href="/admin/users" className="btn btn-ghost text-xs">
            Open user and access management
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Add users, control roles/activation, and view login logs from the access management screen.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Section 3: Add exam</h2>
        <form action={addExamAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Code</label>
            <input name="code" className="input font-mono" placeholder="EGKO" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input name="name" className="input" placeholder="Eduno General Knowledge Olympiad" required />
          </div>
          <div>
            <label className="label">Sort order</label>
            <input name="sortOrder" type="number" className="input" defaultValue={100} />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn btn-primary">
              Add exam
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Section 4: Manage exams ({exams.length})
        </div>
        <div className="divide-y divide-white/5">
          {exams.map((e) => (
            <div key={e.code} className="px-4 py-4">
              <form action={updateExamAction} className="grid gap-3 sm:grid-cols-6">
                <div>
                  <label className="label">Code</label>
                  <input name="code" defaultValue={e.code} className="input font-mono" readOnly />
                </div>
                <div className="sm:col-span-3">
                  <label className="label">Name</label>
                  <input name="name" defaultValue={e.name} className="input" required />
                </div>
                <div>
                  <label className="label">Sort</label>
                  <input name="sortOrder" type="number" defaultValue={e.sortOrder} className="input" />
                </div>
                <label className="mt-7 inline-flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" name="isActive" defaultChecked={e.isActive} />
                  Active
                </label>
                <div className="sm:col-span-6 flex gap-2">
                  <button type="submit" className="btn btn-primary text-xs">
                    Save
                  </button>
                </div>
              </form>
              <form action={deleteExamAction} className="mt-2">
                <input type="hidden" name="code" value={e.code} />
                <button type="submit" className="btn btn-ghost text-xs">
                  Delete (if unused)
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
