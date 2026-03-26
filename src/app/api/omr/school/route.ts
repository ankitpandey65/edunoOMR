import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateOmrPdfForSchool } from "@/lib/omr-generate";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const schoolId = req.nextUrl.searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId required" }, { status: 400 });
  }
  if (s.role === "SCHOOL" && s.schoolId !== schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (s.role !== "ADMIN" && s.role !== "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const pdf = await generateOmrPdfForSchool(schoolId);
    const filename = `OMR_Sheets_School_${schoolId}_${new Date().toISOString().slice(0, 10)}.pdf`;
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
