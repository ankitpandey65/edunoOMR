import { randomBytes } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import { prisma } from "./prisma";
import { examNameByCode, examNameMap } from "./exam-store";
import {
  OMR_GRID,
  OMR_PAGE,
  OMR_SET,
  answerRowCenterY,
  answerRowTopY,
  answerBubbleCenterPdf,
  questionNumberLeftX,
  paperSetBubbleCenterPdf,
} from "./omr-layout";

const PAGE_W = OMR_GRID.pageW;
const PAGE_H = OMR_GRID.pageH;

const BUBBLE_FILL = rgb(0.93, 0.94, 0.96);
const BUBBLE_STROKE = rgb(0.02, 0.03, 0.06);

function drawOmrBubble(
  page: ReturnType<PDFDocument["addPage"]>,
  cx: number,
  cy: number,
  r: number,
  borderW = 1.35
) {
  page.drawCircle({
    x: cx,
    y: cy,
    size: r,
    color: BUBBLE_FILL,
    borderColor: BUBBLE_STROKE,
    borderWidth: borderW,
  });
}

function examAccentRgb(examCode: string) {
  let h = 0;
  for (let i = 0; i < examCode.length; i++) h = (h * 31 + examCode.charCodeAt(i)) % 360;
  const hue = h / 360;
  return rgb(0.08 + hue * 0.12, 0.28 + (1 - hue) * 0.15, 0.42 + hue * 0.2);
}

function drawDetectionBorder(page: ReturnType<PDFDocument["addPage"]>, width: number, height: number) {
  const ins = OMR_PAGE.detectionInset;
  page.drawRectangle({
    x: ins,
    y: ins,
    width: width - ins * 2,
    height: height - ins * 2,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2.75,
  });
}

function drawDashedSafeZone(page: ReturnType<PDFDocument["addPage"]>, width: number, height: number) {
  const inset = OMR_PAGE.safeInset;
  page.drawRectangle({
    x: inset,
    y: inset,
    width: width - inset * 2,
    height: height - inset * 2,
    borderColor: rgb(0.42, 0.44, 0.48),
    borderWidth: 0.9,
    borderDashArray: [5, 4],
  });
}

/** Light tint: timing strip + outer margins (do not write) */
function drawRestrictedMargins(page: ReturnType<PDFDocument["addPage"]>) {
  const gx0 = OMR_GRID.gridLeft - 20;
  const gx1 = OMR_GRID.gridRight + 20;
  const gy0 = OMR_GRID.gridBottom - 4;
  const gy1 = OMR_GRID.gridTop + 4;
  const tint = rgb(0.96, 0.97, 0.99);
  const strip = 14;
  page.drawRectangle({ x: gx0 - strip, y: gy0, width: strip, height: gy1 - gy0, color: tint });
  page.drawRectangle({ x: gx1, y: gy0, width: strip, height: gy1 - gy0, color: tint });
  page.drawRectangle({ x: gx0, y: gy1, width: gx1 - gx0, height: 10, color: tint });
  page.drawRectangle({ x: gx0, y: gy0 - 10, width: gx1 - gx0, height: 10, color: tint });
}

/** Uniform solid black ticks: same size, even pitch on all four sides */
function drawTimingMarksAndFrame(page: ReturnType<PDFDocument["addPage"]>) {
  const gx0 = OMR_GRID.gridLeft - 18;
  const gx1 = OMR_GRID.gridRight + 18;
  const gy0 = OMR_GRID.gridBottom - 3;
  const gy1 = OMR_GRID.gridTop + 8;
  const tw = 5;
  const th = 5;
  const pitch = 18;
  const spanX = gx1 - gx0;
  const spanY = gy1 - gy0;
  const nx = Math.max(2, Math.round(spanX / pitch) + 1);
  const ny = Math.max(2, Math.round(spanY / pitch) + 1);

  for (let i = 0; i < nx; i++) {
    const tx = gx0 + (spanX * i) / (nx - 1);
    page.drawRectangle({
      x: tx - tw / 2,
      y: gy1 - th / 2,
      width: tw,
      height: th,
      color: rgb(0, 0, 0),
    });
    page.drawRectangle({
      x: tx - tw / 2,
      y: gy0 - th / 2,
      width: tw,
      height: th,
      color: rgb(0, 0, 0),
    });
  }
  for (let j = 0; j < ny; j++) {
    const ty = gy0 + (spanY * j) / (ny - 1);
    page.drawRectangle({
      x: gx0 - tw / 2,
      y: ty - th / 2,
      width: tw,
      height: th,
      color: rgb(0, 0, 0),
    });
    page.drawRectangle({
      x: gx1 - tw / 2,
      y: ty - th / 2,
      width: tw,
      height: th,
      color: rgb(0, 0, 0),
    });
  }

  const mark = 11;
  page.drawRectangle({ x: gx0, y: gy0, width: mark, height: 4, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx0, y: gy0, width: 4, height: mark, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx1 - mark, y: gy0, width: mark, height: 4, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx1 - 4, y: gy0, width: 4, height: mark, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx0, y: gy1 - 4, width: mark, height: 4, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx0, y: gy1 - mark, width: 4, height: mark, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx1 - mark, y: gy1 - 4, width: mark, height: 4, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: gx1 - 4, y: gy1 - mark, width: 4, height: mark, color: rgb(0, 0, 0) });

}

function drawAnswerGrid(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  fontBold: PDFFont
) {
  const labels = ["A", "B", "C", "D"];
  const rBubble = OMR_GRID.answerBubbleRadius;

  drawRestrictedMargins(page);

  let q = 0;
  outer: for (let row = 0; row < OMR_GRID.rows; row++) {
    const rowTop = answerRowTopY(row);
    const band = row % 2 === 0 ? rgb(0.97, 0.985, 1) : rgb(1, 1, 1);
    page.drawRectangle({
      x: OMR_GRID.gridLeft - 1,
      y: rowTop - OMR_GRID.rowH,
      width: OMR_GRID.gridRight - OMR_GRID.gridLeft + 2,
      height: OMR_GRID.rowH - 0.25,
      color: band,
    });

    const rowMid = answerRowCenterY(row);
    for (let col = 0; col < OMR_GRID.cols; col++) {
      q++;
      if (q > 60) break outer;
      const qIdx = q - 1;
      const qx = questionNumberLeftX(qIdx);
      page.drawText(`${q}.`, {
        x: qx,
        y: rowMid - 3,
        size: 7.5,
        font: fontBold,
        color: rgb(0.1, 0.12, 0.16),
      });
      for (let o = 0; o < 4; o++) {
        const { x: cx, y: cy } = answerBubbleCenterPdf(qIdx, o);
        page.drawText(labels[o], {
          x: cx - 2.5,
          y: cy + rBubble + 4,
          size: 6.5,
          font: fontBold,
          color: rgb(0.18, 0.2, 0.26),
        });
        drawOmrBubble(page, cx, cy, rBubble);
      }
    }
  }

  drawTimingMarksAndFrame(page);
}

function drawPaperSetRow(page: ReturnType<PDFDocument["addPage"]>, font: PDFFont, fontBold: PDFFont) {
  const labels = ["A", "B", "C", "D"];
  page.drawText("Question Paper Set (MANDATORY)", {
    x: 40,
    y: OMR_SET.rowCenterY + 34,
    size: 9,
    font: fontBold,
    color: rgb(0.06, 0.12, 0.22),
  });
  page.drawText("Darken exactly one bubble — Set A / B / C / D must match your question booklet.", {
    x: 40,
    y: OMR_SET.rowCenterY + 22,
    size: 6.5,
    font,
    color: rgb(0.28, 0.32, 0.38),
  });
  for (let o = 0; o < 4; o++) {
    const { x: cx, y: cy } = paperSetBubbleCenterPdf(o);
    page.drawText(labels[o], {
      x: cx - 2.5,
      y: cy + OMR_SET.bubbleR + 4,
      size: 7,
      font: fontBold,
      color: rgb(0.18, 0.2, 0.26),
    });
    drawOmrBubble(page, cx, cy, OMR_SET.bubbleR);
  }
}

function drawRollInfo(page: ReturnType<PDFDocument["addPage"]>, font: PDFFont, fontBold: PDFFont, rollNo: string) {
  page.drawText("Roll Number", {
    x: 44,
    y: 560,
    size: 7,
    font: fontBold,
    color: rgb(0.12, 0.18, 0.28),
  });
  page.drawText(String(rollNo || "—"), {
    x: 44,
    y: 546,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.14),
  });
}

function drawInstructionBlock(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  fontBold: PDFFont,
  bottomY: number,
  topY: number
) {
  const h = topY - bottomY;
  page.drawRectangle({
    x: 36,
    y: bottomY,
    width: PAGE_W - 72,
    height: h,
    borderColor: rgb(0.72, 0.76, 0.82),
    borderWidth: 0.75,
    color: rgb(0.985, 0.99, 1),
  });

  const lines = [
    "Use HB pencil only (dark, soft lead). Do not use ink pen, gel pen, or highlighter.",
    "Fill the circle completely. Light or partial marks may not be read.",
    "Wrong: tick, cross, dot, or marks outside the ring. Right: exactly one fully darkened circle per question.",
    "Scoring: more than one option darkened for a question is treated as invalid (0 marks) for that question.",
    "To change an answer: erase cleanly with a soft eraser; smudges may be read as multiple answers.",
    "Rough work is not allowed on this sheet. QR (header) + barcode (right) + Sheet ID identify this page for scanning.",
  ];
  let y = topY - 10;
  page.drawText("OMR instructions", { x: 44, y, size: 8, font: fontBold, color: rgb(0.1, 0.24, 0.42) });
  y -= 12;
  for (const line of lines) {
    page.drawText(line, { x: 44, y, size: 6.2, font, color: rgb(0.28, 0.32, 0.38), maxWidth: PAGE_W - 88 });
    y -= 9;
  }
}

function drawFooterOfficial(page: ReturnType<PDFDocument["addPage"]>, font: PDFFont, fontBold: PDFFont) {
  const boxBottom = 44;
  const boxTop = 86;
  page.drawRectangle({
    x: 32,
    y: boxBottom,
    width: PAGE_W - 64,
    height: boxTop - boxBottom,
    borderColor: rgb(0.55, 0.58, 0.62),
    borderWidth: 0.85,
    color: rgb(0.99, 0.995, 1),
  });
  page.drawText("Official use only", {
    x: 40,
    y: boxTop - 10,
    size: 6.5,
    font: fontBold,
    color: rgb(0.2, 0.22, 0.26),
  });
  page.drawText(
    "Invigilator sign: __________   Date: ________   Notes: __________________________",
    { x: 40, y: boxBottom + 12, size: 5.8, font, color: rgb(0.32, 0.35, 0.4) }
  );
  page.drawText(
    "If any ambiguity is found, mark issue and verify manually before final score lock.",
    { x: 40, y: boxBottom + 4, size: 5.2, font, color: rgb(0.4, 0.42, 0.46) }
  );
}

async function drawOmrPage(
  pdfDoc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  opts: {
    schoolName: string;
    schoolCode: string;
    examCode: string;
    examTitle: string;
    studentName: string;
    className: string;
    section: string;
    fatherName: string;
    rollNo: string;
    sheetId: string;
    qrPayload: Record<string, string>;
  }
) {
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const { width, height } = page.getSize();
  const accent = examAccentRgb(opts.examCode);

  drawDetectionBorder(page, width, height);
  drawDashedSafeZone(page, width, height);

  const headerBottom = height - 88;
  page.drawRectangle({
    x: 0,
    y: headerBottom,
    width: 5,
    height: 88,
    color: accent,
  });
  page.drawRectangle({
    x: 0,
    y: headerBottom,
    width,
    height: 88,
    color: rgb(0.06, 0.18, 0.36),
  });
  page.drawRectangle({
    x: 0,
    y: headerBottom,
    width,
    height: 3,
    color: rgb(0.1, 0.38, 0.58),
  });

  page.drawText("EDUNO OLYMPIAD", {
    x: 28,
    y: height - 36,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("OMR", {
    x: 28,
    y: height - 52,
    size: 8,
    font,
    color: rgb(0.82, 0.9, 0.98),
  });

  page.drawText(opts.examTitle, {
    x: 200,
    y: height - 40,
    size: 10,
    font: fontBold,
    color: rgb(0.98, 0.99, 1),
    maxWidth: 260,
  });
  page.drawText(`Code ${opts.examCode}`, {
    x: 200,
    y: height - 56,
    size: 8,
    font,
    color: rgb(0.82, 0.9, 0.98),
  });

  const qrJson = JSON.stringify(opts.qrPayload);
  const qrBuf = await QRCode.toBuffer(qrJson, { width: 128, margin: 1, errorCorrectionLevel: "M" });
  const qrImg = await pdfDoc.embedPng(qrBuf);
  const qrSize = 52;
  const qrRight = OMR_PAGE.w - OMR_PAGE.safeInset - qrSize;
  const qrTop = height - OMR_PAGE.safeInset - qrSize;
  page.drawImage(qrImg, {
    x: qrRight,
    y: qrTop,
    width: qrSize,
    height: qrSize,
  });
  page.drawText("Scan", {
    x: qrRight,
    y: qrTop - 8,
    size: 5,
    font,
    color: rgb(0.75, 0.88, 0.98),
  });

  let barcodeBuf: Buffer;
  try {
    barcodeBuf = await bwipjs.toBuffer({
      bcid: "code128",
      text: opts.sheetId,
      scale: 2,
      height: 11,
      includetext: false,
    });
  } catch {
    barcodeBuf = Buffer.alloc(0);
  }

  page.drawText("School", { x: 44, y: height - 100, size: 6.5, font, color: rgb(0.42, 0.45, 0.5) });
  page.drawText(opts.schoolName, { x: 44, y: height - 114, size: 10, font: fontBold, color: rgb(0.08, 0.1, 0.14) });
  page.drawText(`Code: ${opts.schoolCode}`, { x: 44, y: height - 128, size: 7.5, font, color: rgb(0.35, 0.38, 0.42) });

  page.drawText("Exam", {
    x: 236,
    y: height - 100,
    size: 6.5,
    font,
    color: rgb(0.42, 0.45, 0.5),
  });
  page.drawText(opts.examTitle, {
    x: 236,
    y: height - 114,
    size: 8.8,
    font: fontBold,
    color: rgb(0.1, 0.22, 0.42),
    maxWidth: 180,
  });
  page.drawText(opts.examCode, { x: 236, y: height - 128, size: 7.5, font, color: rgb(0.35, 0.38, 0.42) });

  page.drawText("Candidate", {
    x: 44,
    y: height - 142,
    size: 6.5,
    font: fontBold,
    color: rgb(0.35, 0.38, 0.42),
  });

  const leftColX = 44;
  const rightColX = 420;
  page.drawText(opts.studentName, {
    x: leftColX,
    y: height - 160,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.14),
  });
  page.drawText(`Class ${opts.className}  ·  Sec ${opts.section || "—"}`, {
    x: leftColX,
    y: height - 176,
    size: 9,
    font,
    color: rgb(0.22, 0.25, 0.3),
  });
  page.drawText(`Father / Guardian: ${opts.fatherName || "—"}`, {
    x: leftColX,
    y: height - 192,
    size: 8,
    font,
    color: rgb(0.32, 0.35, 0.4),
  });

  page.drawText("Sheet ID", {
    x: rightColX,
    y: height - 112,
    size: 6,
    font,
    color: rgb(0.4, 0.43, 0.48),
  });
  page.drawText(opts.sheetId, {
    x: rightColX,
    y: height - 124,
    size: 8,
    font: fontBold,
    color: rgb(0.06, 0.1, 0.16),
  });

  drawPaperSetRow(page, font, fontBold);
  drawRollInfo(page, font, fontBold, opts.rollNo);

  if (barcodeBuf.length) {
    const bcImg = await pdfDoc.embedPng(barcodeBuf);
    page.drawImage(bcImg, {
      x: rightColX,
      y: height - 156,
      width: 138,
      height: 24,
    });
  }

  page.drawText("Answers — Questions 1 to 60", {
    x: 36,
    y: OMR_GRID.gridTop + 20,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.28, 0.48),
  });

  drawAnswerGrid(page, font, fontBold);
  drawFooterOfficial(page, font, fontBold);

}

function newSheetId(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}

export async function generateOmrPdfForSchool(schoolId: string): Promise<Uint8Array> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      students: {
        include: {
          enrollments: true,
        },
      },
    },
  });
  if (!school) throw new Error("School not found");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const enrollmentsFlat: {
    examCode: string;
    student: (typeof school.students)[0];
  }[] = [];

  for (const s of school.students) {
    for (const e of s.enrollments) {
      enrollmentsFlat.push({ examCode: e.examCode, student: s });
    }
  }

  enrollmentsFlat.sort((a, b) => {
    const ex = a.examCode.localeCompare(b.examCode);
    if (ex !== 0) return ex;
    const cl = a.student.className.localeCompare(b.student.className);
    if (cl !== 0) return cl;
    const sec = a.student.section.localeCompare(b.student.section);
    if (sec !== 0) return sec;
    return a.student.rollNo.localeCompare(b.student.rollNo);
  });
  const codes = [...new Set(enrollmentsFlat.map((e) => e.examCode))];
  const names = await examNameMap(codes);
  const examName = (code: string) => names[code] ?? code;

  const distinctStudents = new Set(
    enrollmentsFlat.length ? enrollmentsFlat.map((e) => e.student.id) : []
  );
  const distinctExams = new Set(enrollmentsFlat.map((e) => e.examCode));

  const summaryPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let sy = PAGE_H - 56;
  summaryPage.drawText("OMR SHEETS - OVERALL SUMMARY", {
    x: 40,
    y: sy,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.45),
  });
  sy -= 28;
  summaryPage.drawText(`School: ${school.name}`, { x: 40, y: sy, size: 11, font });
  sy -= 16;
  summaryPage.drawText(`School Code: ${school.code}`, { x: 40, y: sy, size: 10, font });
  sy -= 18;
  summaryPage.drawText(
    `Total Students: ${distinctStudents.size}   Total Exams: ${distinctExams.size}   Total OMR Sheets: ${enrollmentsFlat.length}`,
    { x: 40, y: sy, size: 9, font }
  );
  sy -= 22;

  summaryPage.drawText("Exam Name", { x: 40, y: sy, size: 8, font: fontBold });
  summaryPage.drawText("Code", { x: 260, y: sy, size: 8, font: fontBold });
  summaryPage.drawText("Classes", { x: 310, y: sy, size: 8, font: fontBold });
  summaryPage.drawText("Students", { x: 380, y: sy, size: 8, font: fontBold });
  summaryPage.drawText("OMR Sheets", { x: 460, y: sy, size: 8, font: fontBold });
  sy -= 12;

  const byExam = new Map<string, typeof enrollmentsFlat>();
  for (const row of enrollmentsFlat) {
    if (!byExam.has(row.examCode)) byExam.set(row.examCode, []);
    byExam.get(row.examCode)!.push(row);
  }

  for (const [code, rows] of [...byExam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const classKeys = new Set(rows.map((r) => `${r.student.className}|||${r.student.section}`));
    summaryPage.drawText(examName(code), { x: 40, y: sy, size: 7, font });
    summaryPage.drawText(code, { x: 260, y: sy, size: 7, font });
    summaryPage.drawText(String(classKeys.size), { x: 310, y: sy, size: 7, font });
    summaryPage.drawText(String(rows.length), { x: 380, y: sy, size: 7, font });
    summaryPage.drawText(String(rows.length), { x: 460, y: sy, size: 7, font });
    sy -= 11;
    if (sy < 80) break;
  }

  for (const [examCode, rows] of [...byExam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const classMap = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.student.className}\t${r.student.section}`;
      classMap.set(k, (classMap.get(k) ?? 0) + 1);
    }

    const header = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let hy = PAGE_H - 48;
    header.drawText(`EXAM: ${examName(examCode).toUpperCase()}`, {
      x: 40,
      y: hy,
      size: 13,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.45),
    });
    hy -= 20;
    header.drawText(`Exam Code: ${examCode}`, { x: 40, y: hy, size: 10, font });
    hy -= 14;
    header.drawText(`School: ${school.name}`, { x: 40, y: hy, size: 9, font });
    hy -= 22;
    header.drawText(
      `Total Classes: ${classMap.size}   Total Students: ${rows.length}   Total OMR Sheets: ${rows.length}`,
      { x: 40, y: hy, size: 9, font }
    );
    hy -= 20;
    header.drawText("Class", { x: 48, y: hy, size: 8, font: fontBold });
    header.drawText("Section", { x: 120, y: hy, size: 8, font: fontBold });
    header.drawText("Students", { x: 220, y: hy, size: 8, font: fontBold });
    header.drawText("OMR Sheets", { x: 320, y: hy, size: 8, font: fontBold });
    hy -= 12;
    for (const [key, count] of [...classMap.entries()].sort()) {
      const [cls, sec] = key.split("\t");
      header.drawText(cls, { x: 48, y: hy, size: 7, font });
      header.drawText(sec || "—", { x: 120, y: hy, size: 7, font });
      header.drawText(String(count), { x: 220, y: hy, size: 7, font });
      header.drawText(String(count), { x: 320, y: hy, size: 7, font });
      hy -= 11;
      if (hy < 60) break;
    }

    for (const row of rows) {
      const s = row.student;
      const sheetId = newSheetId();
      await drawOmrPage(pdfDoc, font, fontBold, {
        schoolName: school.name,
        schoolCode: school.code,
        examCode,
        examTitle: examName(examCode),
        studentName: s.name,
        className: s.className,
        section: s.section,
        fatherName: s.fatherName ?? "",
        rollNo: s.rollNo,
        sheetId,
        qrPayload: {
          v: "2",
          sh: sheetId,
          sid: s.id,
          e: examCode,
          sc: school.code,
          r: s.rollNo,
        },
      });
    }
  }

  return pdfDoc.save();
}

export async function generateSingleOmrPdf(studentId: string, examCode: string): Promise<Uint8Array> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { school: true, enrollments: true },
  });
  if (!student) throw new Error("Student not found");
  const has = student.enrollments.some((e) => e.examCode === examCode);
  if (!has) throw new Error("Student not enrolled in this exam");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const sheetId = newSheetId();
  const examTitle = await examNameByCode(examCode.toUpperCase());

  await drawOmrPage(pdfDoc, font, fontBold, {
    schoolName: student.school.name,
    schoolCode: student.school.code,
    examCode,
    examTitle,
    studentName: student.name,
    className: student.className,
    section: student.section,
    fatherName: student.fatherName ?? "",
    rollNo: student.rollNo,
    sheetId,
    qrPayload: {
      v: "2",
      sh: sheetId,
      sid: student.id,
      e: examCode,
      sc: student.school.code,
      r: student.rollNo,
    },
  });

  return pdfDoc.save();
}
