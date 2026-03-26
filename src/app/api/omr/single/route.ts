import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSingleOmrPdf } from "@/lib/omr-generate";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const studentId = req.nextUrl.searchParams.get("studentId");
  const examCode = req.nextUrl.searchParams.get("examCode");
  if (!studentId || !examCode) {
    return NextResponse.json({ error: "studentId and examCode required" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (s.role === "SCHOOL" && s.schoolId !== student.schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (s.role !== "ADMIN" && s.role !== "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pdf = await generateSingleOmrPdf(studentId, examCode.toUpperCase());
    const filename = `OMR_${examCode}_${studentId}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
