import {
  bulkUploadAnswerKeysAction,
  deleteAnswerKeyAction,
  saveAnswerKeyAction,
  updateAnswerKeyAction,
} from "@/actions/keys";
import { listActiveExams } from "@/lib/exam-store";
import { isSetWiseAnswerKeyModelReady, listAnswerKeysCompat } from "@/lib/answer-key-store";

export default async function AdminKeysPage() {
  const [keys, exams, setReady] = await Promise.all([
    listAnswerKeysCompat(),
    listActiveExams(),
    isSetWiseAnswerKeyModelReady(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Answer keys</h1>
        <p className="mt-2 text-sm text-slate-400">
          Keys are set-wise. Fill Set A/B/C/D separately if booklet sets differ. Answers accept
          comma-separated or compact A-D text.
        </p>
        {!setReady ? (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Set-wise key model is not active in this running server process yet. Restart dev server
            after Prisma generate/db push to enable Set A/B/C/D persistence.
          </div>
        ) : null}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Add key</h2>
        <form action={saveAnswerKeyAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Exam</label>
            <select name="examCode" required className="input">
              {exams.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class (exact match to student class)</label>
            <input name="className" required className="input" placeholder="9" />
          </div>
          <div>
            <label className="label">Question paper set</label>
            <select name="setCode" required className="input">
              {["A", "B", "C", "D"].map((s) => (
                <option key={s} value={s}>
                  Set {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <label className="label">Answers (comma-separated, up to 60)</label>
            <textarea
              name="answers"
              required
              rows={4}
              className="input min-h-[120px] font-mono text-xs"
              placeholder="A,B,C,D,A,B,C,D,..."
            />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn btn-primary">
              Save key
            </button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Bulk upload keys (CSV)</h2>
        <p className="mt-2 text-sm text-slate-400">
          Header required: <span className="font-mono">examCode,className,setCode,answers</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href="/api/admin/answer-keys/sample" className="btn">
            Download sample CSV
          </a>
        </div>
        <form action={bulkUploadAnswerKeysAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">CSV file</label>
            <input name="file" type="file" accept=".csv,text/csv" required className="input" />
          </div>
          <div className="self-end">
            <button type="submit" className="btn btn-primary">
              Upload CSV
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Saved keys ({keys.length}) - Editable
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Current key</th>
                <th className="px-4 py-3">Length</th>
                <th className="px-4 py-3">Edit</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-3">
                    <div className="font-mono text-sky-300">{k.examCode}</div>
                    <div className="text-white">
                      Class {k.className} · Set {k.setCode}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {k.answers.split(/[\s,;]+/).filter(Boolean).length}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateAnswerKeyAction} className="space-y-2">
                      <input type="hidden" name="id" value={k.id} />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <select name="examCode" defaultValue={k.examCode} className="input">
                          {exams.map((e) => (
                            <option key={`${k.id}-exam-${e.code}`} value={e.code}>
                              {e.code}
                            </option>
                          ))}
                        </select>
                        <input name="className" defaultValue={k.className} className="input" />
                        <select name="setCode" defaultValue={k.setCode} className="input">
                          {["A", "B", "C", "D"].map((s) => (
                            <option key={`${k.id}-set-${s}`} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        name="answers"
                        defaultValue={k.answers}
                        rows={3}
                        className="input min-w-[360px] font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary">
                          Update
                        </button>
                      </div>
                    </form>
                    <form action={deleteAnswerKeyAction}>
                      <input type="hidden" name="id" value={k.id} />
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
      </div>
    </div>
  );
}
