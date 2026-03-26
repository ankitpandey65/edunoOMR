"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type OkState = {
  ok: true;
  jobId: string;
  totalPages: number;
  okCount: number;
  errCount: number;
  openAiUsed?: boolean;
  status?: string;
};

type UiState = OkState | { error: string } | null;

export function BatchOmrForm() {
  const router = useRouter();
  const [state, setState] = useState<UiState>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state || !("ok" in state) || !state.ok || !state.jobId) return;
    if (state.status === "completed" || state.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/omr/batch/status?jobId=${encodeURIComponent(state.jobId)}`);
        if (!res.ok) return;
        const j = (await res.json()) as {
          job?: { totalPages: number; okCount: number; errCount: number; status: string };
          processed?: number;
        };
        if (!j.job) return;
        setState((prev) =>
          prev && "ok" in prev && prev.ok
            ? {
                ...prev,
                totalPages: Number(j.job.totalPages),
                okCount: Number(j.job.okCount),
                errCount: Number(j.job.errCount),
                status: j.job.status,
              }
            : prev
        );
        if (j.job.status === "completed" || j.job.status === "failed") {
          router.refresh();
        }
      } catch {
        // noop
      }
    }, 2000);
    return () => clearInterval(t);
  }, [state, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/omr/batch", { method: "POST", body: fd });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setState({ error: String(j.error ?? "Upload failed") });
        return;
      }
      if (j.ok === true && typeof j.jobId === "string") {
        setState({
          ok: true,
          jobId: j.jobId,
          totalPages: Number(j.totalPages),
          okCount: Number(j.okCount),
          errCount: Number(j.errCount),
          openAiUsed: Boolean(j.openAiUsed),
          status: "processing",
        });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Scanned OMR PDF (multi-page)</label>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="input"
          />
          <p className="mt-2 text-xs text-slate-500">
            Export your scanner output as one PDF (one page per sheet). Each page must match the
            Eduno OMR layout; QR codes identify the student and exam. If OPENAI_API_KEY is set,
            OpenAI Vision is used for answer extraction.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Processing PDF…" : "Upload & process all pages"}
        </button>
      </form>

      {state && "error" in state ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      ) : null}

      {state && "ok" in state && state.ok ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div>
            Status: <strong>{state.status ?? "processing"}</strong> · Processed{" "}
            <strong>{state.okCount + state.errCount}</strong> / <strong>{state.totalPages}</strong>{" "}
            page(s): <strong>{state.okCount}</strong> scored, <strong>{state.errCount}</strong> errors.
          </div>
          {state.status === "processing" ? (
            <div className="mt-1 text-xs text-emerald-200">
              OpenAI extraction can take 10-40s per page depending on quality and size.
            </div>
          ) : null}
          <div className="mt-1 text-xs text-emerald-200">
            Engine: {state.openAiUsed ? "OpenAI Vision" : "Local detector"}
          </div>
          <a
            href={`/admin/scans/batch/${state.jobId}`}
            className="mt-2 inline-block text-sky-400 underline hover:text-sky-300"
          >
            View results & scorecards
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function BatchOmrFormSchool() {
  const router = useRouter();
  const [state, setState] = useState<UiState>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state || !("ok" in state) || !state.ok || !state.jobId) return;
    if (state.status === "completed" || state.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/omr/batch/status?jobId=${encodeURIComponent(state.jobId)}`);
        if (!res.ok) return;
        const j = (await res.json()) as {
          job?: { totalPages: number; okCount: number; errCount: number; status: string };
          processed?: number;
        };
        if (!j.job) return;
        setState((prev) =>
          prev && "ok" in prev && prev.ok
            ? {
                ...prev,
                totalPages: Number(j.job.totalPages),
                okCount: Number(j.job.okCount),
                errCount: Number(j.job.errCount),
                status: j.job.status,
              }
            : prev
        );
        if (j.job.status === "completed" || j.job.status === "failed") {
          router.refresh();
        }
      } catch {
        // noop
      }
    }, 2000);
    return () => clearInterval(t);
  }, [state, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/omr/batch", { method: "POST", body: fd });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setState({ error: String(j.error ?? "Upload failed") });
        return;
      }
      if (j.ok === true && typeof j.jobId === "string") {
        setState({
          ok: true,
          jobId: j.jobId,
          totalPages: Number(j.totalPages),
          okCount: Number(j.okCount),
          errCount: Number(j.errCount),
          openAiUsed: Boolean(j.openAiUsed),
          status: "processing",
        });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">Scanned OMR PDF</label>
          <input name="file" type="file" accept="application/pdf,.pdf" required className="input" />
          <p className="mt-2 text-xs text-slate-500">
            Only sheets for students in your school are accepted; other pages are reported as errors.
            OpenAI Vision is used automatically when configured.
          </p>
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Processing…" : "Upload & process"}
        </button>
      </form>
      {state && "error" in state ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div>
            Status: {state.status ?? "processing"} · Processed {state.okCount + state.errCount} /{" "}
            {state.totalPages} · OK: {state.okCount} · Errors: {state.errCount}
          </div>
          {state.status === "processing" ? (
            <div className="mt-1 text-xs text-emerald-200">
              OpenAI extraction can take 10-40s per page depending on quality and size.
            </div>
          ) : null}
          <div className="mt-1 text-xs text-emerald-200">
            Engine: {state.openAiUsed ? "OpenAI Vision" : "Local detector"}
          </div>
          <a
            href={`/school/scans/batch/${state.jobId}`}
            className="mt-2 inline-block text-indigo-400 underline hover:text-indigo-300"
          >
            View results & scorecards
          </a>
        </div>
      ) : null}
    </div>
  );
}
