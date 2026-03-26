import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvCell(v: unknown) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "ADMIN" && s.role !== "SCHOOL")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolIdParam = String(req.nextUrl.searchParams.get("schoolId") ?? "").trim();
  const schoolId = s.role === "SCHOOL" ? s.schoolId : schoolIdParam || null;
  if (s.role === "SCHOOL" && !schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.scanResult.findMany({
    where: schoolId ? { student: { schoolId } } : {},
    orderBy: [{ processedAt: "desc" }],
    include: { student: { include: { school: true } } },
  });

  const header = [
    "processedAt",
    "schoolCode",
    "schoolName",
    "studentName",
    "rollNo",
    "className",
    "section",
    "examCode",
    "paperSet",
    "attemptedQuestions",
    "totalQuestions",
    "correctAnswers",
    "score",
    "maxScore",
    "scanSource",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.processedAt.toISOString(),
        r.student.school.code,
        r.student.school.name,
        r.student.name,
        r.student.rollNo,
        r.student.className,
        r.student.section,
        r.examCode,
        r.paperSet ?? "",
        r.attemptedQuestions ?? "",
        r.totalQuestions ?? "",
        r.correctAnswers ?? "",
        r.score ?? "",
        r.maxScore ?? "",
        r.scanSource ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const filename = schoolId ? `scores_${schoolId}.csv` : "scores_all_schools.csv";
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
