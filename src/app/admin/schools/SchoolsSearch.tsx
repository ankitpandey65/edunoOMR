"use client";

import { useRouter } from "next/navigation";

export function SchoolsSearch({ defaultQ }: { defaultQ: string }) {
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get("q") ?? "").trim();
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        router.push(`/admin/schools${params.toString() ? `?${params}` : ""}`);
      }}
    >
      <div className="min-w-[200px] flex-1">
        <label className="label">Search school</label>
        <input
          name="q"
          type="search"
          defaultValue={defaultQ}
          placeholder="Name or school code…"
          className="input"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
      {defaultQ ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/admin/schools")}
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
