import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildScorecardPdf } from "@/lib/scorecard-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ pageResultId: string }> }
) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (s.role !== "ADMIN" && s.role !== "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { pageResultId } = await ctx.params;
  const row = await prisma.omrBatchPageResult.findUnique({
    where: { id: pageResultId },
    include: {
      student: { include: { school: true } },
    },
  });

  if (!row?.student || row.score == null || row.maxScore == null || !row.examCode) {
    return NextResponse.json({ error: "Score not available" }, { status: 404 });
  }

  if (s.role === "SCHOOL" && s.schoolId !== row.student.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdf = await buildScorecardPdf({
    schoolName: row.student.school.name,
    schoolCode: row.student.school.code,
    studentName: row.student.name,
    rollNo: row.student.rollNo,
    className: row.student.className,
    section: row.student.section,
    examCode: row.examCode,
    paperSet: row.paperSet ?? undefined,
    score: row.score,
    maxScore: row.maxScore,
    processedAt: row.createdAt,
  });

  const filename = `Scorecard_${row.student.rollNo}_${row.examCode}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
