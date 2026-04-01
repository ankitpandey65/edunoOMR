import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from "@/actions/admin-users";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [schools, users, logs] = await Promise.all([
    prisma.school.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, isActive: true },
    }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { email: "asc" }],
      include: { school: { select: { id: true, code: true, name: true } } },
    }),
    (prisma as unknown as { accessLog?: any }).accessLog
      ? (prisma as unknown as { accessLog: any }).accessLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 120,
          include: { user: { select: { email: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Users and access management</h1>
        <p className="mt-2 text-sm text-slate-400">
          Add users, manage credentials and permissions, and review access logs.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-medium text-white">Add user</h2>
        <form action={createUserAction} className="mt-4 grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="label">Email (credential)</label>
            <input name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label">Display name</label>
            <input name="name" className="input" />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="SCHOOL">
              <option value="SCHOOL">SCHOOL</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div>
            <label className="label">School (for SCHOOL role)</label>
            <select name="schoolId" className="input" defaultValue="">
              <option value="">Select school</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Password (credential)</label>
            <input name="password" className="input" type="text" required />
          </div>
          <div className="sm:col-span-5">
            <button type="submit" className="btn btn-primary">
              Create user
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Manage users ({users.length})
        </div>
        <div className="divide-y divide-white/5">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-4">
              <form action={updateUserAction} className="grid gap-3 sm:grid-cols-6">
                <input type="hidden" name="id" value={u.id} />
                <div className="sm:col-span-2">
                  <label className="label">Email (credential)</label>
                  <input name="email" defaultValue={u.email} className="input" required />
                </div>
                <div>
                  <label className="label">Name</label>
                  <input name="name" defaultValue={u.name ?? ""} className="input" />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select name="role" defaultValue={u.role} className="input">
                    <option value="SCHOOL">SCHOOL</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">School</label>
                  <select name="schoolId" defaultValue={u.schoolId ?? ""} className="input">
                    <option value="">No school</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">New password (optional)</label>
                  <input
                    name="password"
                    className="input"
                    placeholder="Leave blank to keep current"
                    type="text"
                  />
                </div>
                <label className="mt-7 inline-flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" name="isActive" defaultChecked={u.isActive} />
                  Active
                </label>
                <div className="sm:col-span-6 flex flex-wrap items-center gap-2">
                  <button type="submit" className="btn btn-primary text-xs">
                    Save
                  </button>
                  <span className="text-xs text-slate-500">
                    Created: {u.createdAt.toISOString().replace("T", " ").slice(0, 19)} | Updated:{" "}
                    {u.updatedAt.toISOString().replace("T", " ").slice(0, 19)}
                  </span>
                </div>
              </form>
              <form action={deleteUserAction} className="mt-2">
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className="btn btn-ghost text-xs">
                  Delete user
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          Access logs ({logs.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row: any) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3 text-white">{row.email}</td>
                  <td className="px-4 py-3 text-slate-300">{row.role ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{row.action}</td>
                  <td className="px-4 py-3 text-slate-300">{row.success ? "SUCCESS" : "FAILED"}</td>
                  <td className="px-4 py-3 text-slate-400">{row.details ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{row.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
