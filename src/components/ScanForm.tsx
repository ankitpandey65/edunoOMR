"use client";

import { useState } from "react";

type ExamOption = { code: string; name: string };

type ScanJson = {
  ok?: boolean;
  error?: string;
  answers?: string[];
  score?: { correct: number; max: number } | null;
  imageUrl?: string;
  ambiguousCount?: number;
  detectedSet?: "A" | "B" | "C" | "D" | null;
  detectedSetAmbiguous?: boolean;
  detectedSetConfidence?: number;
  keySetUsed?: "A" | "B" | "C" | "D" | null;
  keyError?: string | null;
  setModelReady?: boolean;
  attemptedQuestions?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  duplicateResolved?: string | null;
  duplicateFound?: boolean;
  duplicates?: Array<{
    id: string;
    processedAt: string;
    score: number | null;
    maxScore: number | null;
    attemptedQuestions: number | null;
    totalQuestions: number | null;
    scanSource: string | null;
  }>;
  resolved?: {
    mode: "qr" | "manual" | "manual+qr";
    studentId: string;
    examCode: string;
    studentName: string;
    className: string;
    school: string;
  };
};

function setConfidenceMeta(result: ScanJson) {
  const c = result.detectedSetConfidence ?? 0;
  if (!result.detectedSet || result.detectedSetAmbiguous) {
    return { label: "Weak", cls: "bg-red-500/15 text-red-200 border-red-500/30" };
  }
  if (c >= 120) {
    return { label: "Strong", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" };
  }
  if (c >= 60) {
    return { label: "Medium", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30" };
  }
  return { label: "Weak", cls: "bg-red-500/15 text-red-200 border-red-500/30" };
}

export function ScanForm({ exams }: { exams: ExamOption[] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanJson | null>(null);
  const [pendingFd, setPendingFd] = useState<FormData | null>(null);

  async function submitFd(fd: FormData) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/scan", { method: "POST", body: fd });
      const raw = await res.text();
      let j: ScanJson | null = null;
      if (raw) {
        try {
          j = JSON.parse(raw) as ScanJson;
        } catch {
          j = null;
        }
      }
      if (!res.ok) {
        const fallback = raw ? raw.slice(0, 180) : "No response body";
        const merged = (j ?? {}) as ScanJson;
        setResult({ ...merged, error: j?.error ?? `Request failed (${res.status}). ${fallback}` });
        return;
      }
      if (!j) {
        setResult({ error: "Server returned invalid response. Please retry once." });
        return;
      }
      setResult(j);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected network error";
      setResult({ error: msg });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("duplicateMode", "ask");
    setPendingFd(fd);
    await submitFd(fd);
  }

  async function resolveDuplicate(mode: "replace_latest" | "keep_old") {
    if (!pendingFd) return;
    const fd = new FormData();
    for (const [k, v] of pendingFd.entries()) fd.append(k, v);
    fd.set("duplicateMode", mode);
    await submitFd(fd);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} encType="multipart/form-data" className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Student ID (optional manual override)</label>
          <input
            name="studentId"
            className="input font-mono text-xs"
            placeholder="Leave blank to auto-detect from QR"
          />
          <p className="mt-1 text-xs text-slate-500">
            CUID is internal student ID in database. Recommended: keep blank and scan official OMR with QR.
          </p>
        </div>
        <div>
          <label className="label">Exam (optional manual override)</label>
          <select name="examCode" className="input">
            <option value="">Auto from QR</option>
            {exams.map((e) => (
              <option key={e.code} value={e.code}>
                {e.code} — {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Roll No (optional fallback)</label>
          <input name="rollNo" className="input" placeholder="Use when QR is unreadable" />
        </div>
        <div>
          <label className="label">School Code (admin only fallback)</label>
          <input name="schoolCode" className="input" placeholder="Required for admin + Roll No fallback" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Scan image (QR visible)</label>
          <input name="file" type="file" accept="image/*" required className="input" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Processing…" : "Upload & score"}
          </button>
        </div>
      </form>

      {result?.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {result.error}
          {result.duplicateFound ? (
            <div className="mt-3 space-y-2 text-xs text-red-100">
              <div className="font-semibold">Existing scores found:</div>
              {result.duplicates?.map((d) => (
                <div key={d.id} className="rounded border border-white/15 bg-black/20 p-2">
                  {String(d.processedAt).replace("T", " ").slice(0, 19)} · {d.score ?? "—"} /{" "}
                  {d.maxScore ?? "—"} · attempted {d.attemptedQuestions ?? "—"} /{" "}
                  {d.totalQuestions ?? "—"} · {d.scanSource ?? "unknown"}
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary" onClick={() => resolveDuplicate("replace_latest")} disabled={busy}>
                  Replace latest
                </button>
                <button type="button" className="btn" onClick={() => resolveDuplicate("keep_old")} disabled={busy}>
                  Keep existing (discard new)
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {result?.ok ? (
        <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
          {(() => {
            const meta = setConfidenceMeta(result);
            return (
              <div
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.cls}`}
              >
                Set Detection: {meta.label}
              </div>
            );
          })()}
          {result.resolved ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
              <div>
                Resolved via <strong>{result.resolved.mode}</strong>:{" "}
                <span className="font-mono">{result.resolved.studentId}</span> ·{" "}
                <span className="font-mono">{result.resolved.examCode}</span>
              </div>
              <div className="mt-1">
                {result.resolved.studentName} · Class {result.resolved.className} · {result.resolved.school}
              </div>
            </div>
          ) : null}
          {result.score != null ? (
            <div className="text-emerald-100">
              Score: <strong>{result.score.correct}</strong> / {result.score.max}
            </div>
          ) : (
            <div className="text-amber-200">
              No answer key for this exam + class — detection only. Admins can add a key under Answer
              keys.
              {pendingFd ? (
                <button
                  type="button"
                  className="btn ml-3"
                  onClick={() => submitFd(pendingFd)}
                  disabled={busy}
                >
                  Try again after key update
                </button>
              ) : null}
            </div>
          )}
          <div className="text-xs text-slate-300">
            Attempted: <strong>{result.attemptedQuestions ?? "—"}</strong> · Correct:{" "}
            <strong>{result.correctAnswers ?? "—"}</strong> · Total questions:{" "}
            <strong>{result.totalQuestions ?? "—"}</strong>
            {result.duplicateResolved ? ` · Duplicate action: ${result.duplicateResolved}` : ""}
          </div>
          <div className="text-xs text-slate-300">
            Detected booklet set: <strong>{result.detectedSet ?? "Not clear"}</strong>
            {result.detectedSetAmbiguous ? " (ambiguous mark)" : ""}
            {result.keySetUsed ? ` · Key used: Set ${result.keySetUsed}` : ""}
            {typeof result.detectedSetConfidence === "number"
              ? ` · Confidence ${result.detectedSetConfidence}`
              : ""}
          </div>
          {result.setModelReady === false ? (
            <div className="text-amber-200">
              Set-wise key model not active in this server process yet. Restart dev server to enable
              Set A/B/C/D matching.
            </div>
          ) : null}
          {result.keyError ? <div className="text-amber-200">{result.keyError}</div> : null}
          {typeof result.ambiguousCount === "number" && result.ambiguousCount > 0 ? (
            <div className="text-amber-200">
              {result.ambiguousCount} question(s) had multiple dark marks and were scored as 0.
            </div>
          ) : null}
          {result.imageUrl ? (
            <div className="text-xs text-slate-500">
              Saved: <span className="font-mono text-slate-400">{result.imageUrl}</span>
            </div>
          ) : null}
          {result.answers ? (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-300">Detected answers (60)</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-2">
                {result.answers.join(",")}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
