import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processOmrPdfUpload, type BatchDuplicateMode } from "@/lib/omr-batch-process";

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
  const modeRaw = String(form.get("duplicateMode") ?? "ask").trim();
  const duplicateMode: BatchDuplicateMode =
    modeRaw === "replace_latest" || modeRaw === "keep_old" || modeRaw === "keep_both"
      ? modeRaw
      : "ask";

  try {
    const result = await processOmrPdfUpload({
      pdfBuffer: buf,
      fileName: file.name,
      uploadedByRole: s.role,
      schoolIdFilter,
      duplicateMode,
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
