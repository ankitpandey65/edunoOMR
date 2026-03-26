import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "ADMIN" && s.role !== "SCHOOL")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = String(req.nextUrl.searchParams.get("jobId") ?? "").trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await prisma.omrBatchJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      schoolId: true,
      totalPages: true,
      okCount: true,
      errCount: true,
      status: true,
      createdAt: true,
      fileName: true,
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.role === "SCHOOL" && s.schoolId !== job.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pagesProcessed = await prisma.omrBatchPageResult.count({
    where: { jobId: job.id },
  });
  const pageAgg = await prisma.omrBatchPageResult.groupBy({
    by: ["error"],
    where: { jobId: job.id },
    _count: { _all: true },
  });
  const errCount = pageAgg.filter((g) => g.error != null).reduce((a, g) => a + g._count._all, 0);
  const okCount = pagesProcessed - errCount;

  let status = job.status;
  if (status === "processing" && pagesProcessed >= job.totalPages && job.totalPages > 0) {
    status = "completed";
    await prisma.omrBatchJob.update({
      where: { id: job.id },
      data: { status, okCount, errCount },
    });
  }

  return NextResponse.json({
    ok: true,
    job: {
      ...job,
      okCount,
      errCount,
      status,
    },
    processed: pagesProcessed,
  });
}
