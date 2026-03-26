import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processOmrPdfUpload } from "@/lib/omr-batch-process";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (s.role !== "ADMIN" && s.role !== "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  }
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Upload a PDF file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const schoolIdFilter = s.role === "SCHOOL" ? s.schoolId : null;

  try {
    const result = await processOmrPdfUpload({
      pdfBuffer: buf,
      fileName: file.name,
      uploadedByRole: s.role,
      schoolIdFilter,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Batch processing failed" },
      { status: 500 }
    );
  }
}
