import { prisma } from "@/lib/prisma";
import { requireSchool } from "@/lib/auth";

export default async function SchoolPendingPage() {
  const { schoolId } = await requireSchool();
  const rows = await prisma.pendingStudentChange.findMany({
    where: { student: { schoolId } },
    orderBy: { createdAt: "desc" },
    include: { student: true },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">My requests</h1>
        <p className="mt-2 text-sm text-slate-400">
          Updates you submit for students stay pending until an administrator approves them.
        </p>
      </div>
      <div className="card overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{r.student.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.status === "PENDING"
                        ? "text-amber-300"
                        : r.status === "APPROVED"
                          ? "text-emerald-400"
                          : "text-red-300"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {r.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
