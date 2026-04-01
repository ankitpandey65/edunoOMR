import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { prisma } from "@/lib/prisma";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/pending", label: "Approvals" },
  { href: "/admin/omr", label: "OMR PDF" },
  { href: "/admin/keys", label: "Answer keys" },
  { href: "/admin/scans", label: "Scan & score" },
  { href: "/admin/scores", label: "Final scores" },
];

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const pendingCount = await prisma.pendingStudentChange.count({
    where: { status: "PENDING" },
  });
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
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              <span>{l.label}</span>
              {l.href === "/admin/pending" && pendingCount > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <Link
          href="/admin/settings"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="m19.4 15 1.2 2.1-2 2-2.1-1.2a8.2 8.2 0 0 1-1.8.7L14.3 21h-4.6l-.4-2.4a8.2 8.2 0 0 1-1.8-.7l-2.1 1.2-2-2L4.6 15a8.2 8.2 0 0 1-.7-1.8L1.5 12l2.4-.4a8.2 8.2 0 0 1 .7-1.8L3.4 7.7l2-2 2.1 1.2a8.2 8.2 0 0 1 1.8-.7L9.7 3h4.6l.4 2.4a8.2 8.2 0 0 1 1.8.7l2.1-1.2 2 2-1.2 2.1c.3.6.5 1.2.7 1.8l2.4.4-2.4.4a8.2 8.2 0 0 1-.7 1.8Z" />
          </svg>
          Settings
        </Link>
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
