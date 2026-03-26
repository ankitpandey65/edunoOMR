import Link from "next/link";
import { logoutAction } from "@/actions/auth";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/pending", label: "Approvals" },
  { href: "/admin/omr", label: "OMR PDF" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/keys", label: "Answer keys" },
  { href: "/admin/scans", label: "Scan & score" },
  { href: "/admin/scores", label: "Final scores" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-white/10 bg-[#070d18]/95 p-4 backdrop-blur md:flex">
        <Link href="/admin" className="mb-8 block px-1 transition hover:opacity-90">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/95">
            Eduno Olympiad
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Administration
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </aside>
      <div className="md:pl-56">
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
