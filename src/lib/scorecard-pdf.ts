import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { examNameByCode } from "./exam-store";

export async function buildScorecardPdf(opts: {
  schoolName: string;
  schoolCode: string;
  studentName: string;
  rollNo: string;
  className: string;
  section: string;
  examCode: string;
  paperSet?: string;
  score: number;
  maxScore: number;
  processedAt: Date;
}): Promise<Uint8Array> {
  const examTitle = await examNameByCode(opts.examCode);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  const w = page.getWidth();
  const h = page.getHeight();

  const headerH = 108;
  page.drawRectangle({
    x: 0,
    y: h - headerH,
    width: w,
    height: headerH,
    color: rgb(0.07, 0.24, 0.42),
  });
  page.drawRectangle({
    x: 0,
    y: h - 6,
    width: w,
    height: 6,
    color: rgb(0.12, 0.55, 0.75),
  });

  page.drawText("EDUNO OLYMPIAD", {
    x: 40,
    y: h - 44,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("OFFICIAL SCORE CARD", {
    x: 40,
    y: h - 72,
    size: 11,
    font,
    color: rgb(0.82, 0.9, 0.98),
  });

  let y = h - headerH - 32;
  const row = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: 40, y, size: 9, font, color: rgb(0.45, 0.5, 0.58) });
    page.drawText(value, {
      x: 200,
      y,
      size: 10,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.12),
    });
    y -= 22;
  };

  row("School", opts.schoolName, true);
  row("School code", opts.schoolCode);
  row("Student", opts.studentName, true);
  row("Roll no.", opts.rollNo);
  row("Class / Section", `${opts.className}${opts.section ? ` · ${opts.section}` : ""}`);
  row("Exam", `${examTitle} (${opts.examCode})`, true);
  if (opts.paperSet) row("Question paper set", opts.paperSet);

  y -= 12;
  const boxH = 92;
  const boxY = y - boxH;
  page.drawRectangle({
    x: 36,
    y: boxY,
    width: w - 72,
    height: boxH,
    borderColor: rgb(0.75, 0.8, 0.88),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  });
  page.drawText("RESULT", {
    x: 48,
    y: y - 28,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.35, 0.55),
  });
  const pct = opts.maxScore > 0 ? Math.round((opts.score / opts.maxScore) * 1000) / 10 : 0;
  page.drawText(`${opts.score} / ${opts.maxScore}`, {
    x: 48,
    y: y - 58,
    size: 28,
    font: fontBold,
    color: rgb(0.08, 0.35, 0.55),
  });
  page.drawText(`Percentage: ${pct}%`, {
    x: 280,
    y: y - 56,
    size: 12,
    font,
    color: rgb(0.35, 0.4, 0.48),
  });

  const footY = y - boxH - 28;
  page.drawText(`Generated: ${opts.processedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`, {
    x: 40,
    y: footY,
    size: 8,
    font,
    color: rgb(0.55, 0.58, 0.62),
  });
  page.drawText("This document is computer-generated from OMR evaluation.", {
    x: 40,
    y: footY - 14,
    size: 7,
    font,
    color: rgb(0.55, 0.58, 0.62),
  });

  return pdf.save();
}
