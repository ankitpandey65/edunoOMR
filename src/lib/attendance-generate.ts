import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { prisma } from "./prisma";
import { examNameMap } from "./exam-store";
import { getAppSettings } from "./app-settings";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 36;
const TABLE_X = 20;
const TABLE_W = PAGE_W - TABLE_X * 2;
const ROW_H = 19;
const HEADER_H = 18;

const COLS = [
  { key: "sno", label: "S.No", w: 36 },
  { key: "roll", label: "Roll No", w: 58 },
  { key: "name", label: "Student Name", w: 150 },
  { key: "sec", label: "Sec", w: 34 },
  { key: "father", label: "Father / Guardian", w: 130 },
  { key: "stuSign", label: "Student Signature", w: 75 },
  { key: "invSign", label: "Invigilator Sign", w: 72 },
] as const;

type Row = {
  rollNo: string;
  name: string;
  className: string;
  section: string;
  fatherName: string;
};

function drawPageHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  fontBold: PDFFont,
  schoolName: string,
  schoolCode: string,
  schoolAddress: string,
  examSession: string,
  examCode: string,
  examTitle: string,
  className: string
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 80,
    width: PAGE_W,
    height: 80,
    color: rgb(0.06, 0.18, 0.36),
  });
  page.drawText("EDUNO OLYMPIAD", {
    x: MARGIN_X,
    y: PAGE_H - 34,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("ATTENDANCE SHEET", {
    x: MARGIN_X,
    y: PAGE_H - 52,
    size: 9,
    font,
    color: rgb(0.84, 0.92, 0.99),
  });
  page.drawText(`Session: ${examSession || "—"}`, {
    x: MARGIN_X + 170,
    y: PAGE_H - 52,
    size: 8,
    font,
    color: rgb(0.84, 0.92, 0.99),
  });
  page.drawText(`School: ${schoolName} (${schoolCode})`, {
    x: MARGIN_X,
    y: PAGE_H - 94,
    size: 8.5,
    font: fontBold,
    color: rgb(0.09, 0.12, 0.2),
  });
  page.drawText(`School address: ${schoolAddress || "—"}`, {
    x: MARGIN_X,
    y: PAGE_H - 108,
    size: 8,
    font,
    color: rgb(0.22, 0.26, 0.32),
    maxWidth: PAGE_W - 2 * MARGIN_X,
  });
  page.drawText(`Exam: ${examTitle} [${examCode}]`, {
    x: MARGIN_X,
    y: PAGE_H - 122,
    size: 8,
    font,
    color: rgb(0.22, 0.26, 0.32),
  });
  page.drawText(`Class: ${className}    Date: __________    Room: __________`, {
    x: MARGIN_X,
    y: PAGE_H - 136,
    size: 8,
    font,
    color: rgb(0.22, 0.26, 0.32),
  });
}

function drawTableHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  y: number,
  fontBold: PDFFont
) {
  page.drawRectangle({
    x: TABLE_X,
    y: y - HEADER_H,
    width: TABLE_W,
    height: HEADER_H,
    color: rgb(0.95, 0.97, 1),
    borderColor: rgb(0.7, 0.75, 0.84),
    borderWidth: 0.6,
  });

  let x = TABLE_X;
  for (const c of COLS) {
    page.drawText(c.label, {
      x: x + 3,
      y: y - 11,
      size: 7,
      font: fontBold,
      color: rgb(0.1, 0.14, 0.22),
    });
    page.drawLine({
      start: { x, y: y - HEADER_H },
      end: { x, y },
      thickness: 0.4,
      color: rgb(0.72, 0.76, 0.84),
    });
    x += c.w;
  }
  page.drawLine({
    start: { x: TABLE_X + TABLE_W, y: y - HEADER_H },
    end: { x: TABLE_X + TABLE_W, y },
    thickness: 0.4,
    color: rgb(0.72, 0.76, 0.84),
  });
}

function drawTableRow(
  page: ReturnType<PDFDocument["addPage"]>,
  y: number,
  idx: number,
  row: Row,
  font: PDFFont
) {
  page.drawRectangle({
    x: TABLE_X,
    y: y - ROW_H,
    width: TABLE_W,
    height: ROW_H,
    borderColor: rgb(0.8, 0.83, 0.88),
    borderWidth: 0.45,
    color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.99, 0.995, 1),
  });

  let x = TABLE_X;
  const textY = y - 12.5;
  const pad = 3;
  page.drawText(String(idx + 1), { x: x + pad, y: textY, size: 7, font, color: rgb(0.2, 0.24, 0.3) });
  x += COLS[0].w;
  page.drawText(row.rollNo, { x: x + pad, y: textY, size: 7, font, color: rgb(0.1, 0.12, 0.16) });
  x += COLS[1].w;
  page.drawText(row.name, {
    x: x + pad,
    y: textY,
    size: 7,
    font,
    color: rgb(0.1, 0.12, 0.16),
    maxWidth: COLS[2].w - 2 * pad,
  });
  x += COLS[2].w;
  page.drawText(row.section || "-", { x: x + pad, y: textY, size: 7, font, color: rgb(0.2, 0.24, 0.3) });
  x += COLS[3].w;
  page.drawText(row.fatherName || "-", {
    x: x + pad,
    y: textY,
    size: 7,
    font,
    color: rgb(0.2, 0.24, 0.3),
    maxWidth: COLS[4].w - 2 * pad,
  });

  // Internal vertical guides for full row (including signature columns)
  x = TABLE_X;
  for (const c of COLS) {
    page.drawLine({
      start: { x, y: y - ROW_H },
      end: { x, y },
      thickness: 0.35,
      color: rgb(0.78, 0.82, 0.88),
    });
    x += c.w;
  }
  page.drawLine({
    start: { x: TABLE_X + TABLE_W, y: y - ROW_H },
    end: { x: TABLE_X + TABLE_W, y },
    thickness: 0.35,
    color: rgb(0.78, 0.82, 0.88),
  });
}

export async function generateAttendancePdfForSchool(schoolId: string): Promise<Uint8Array> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      students: {
        include: { enrollments: true },
      },
    },
  });
  if (!school) throw new Error("School not found");
  const settings = await getAppSettings();

  const byExamClass = new Map<string, Row[]>();
  for (const st of school.students) {
    for (const en of st.enrollments) {
      const classKey = st.className.trim();
      const key = `${en.examCode}|||${classKey}`;
      if (!byExamClass.has(key)) byExamClass.set(key, []);
      byExamClass.get(key)!.push({
        rollNo: st.rollNo,
        name: st.name,
        className: st.className,
        section: st.section || "",
        fatherName: st.fatherName || "",
      });
    }
  }

  const sortedKeys = [...byExamClass.keys()].sort((a, b) => {
    const [ea, ca] = a.split("|||");
    const [eb, cb] = b.split("|||");
    const ex = ea.localeCompare(eb);
    return ex !== 0 ? ex : ca.localeCompare(cb);
  });

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const examCodes = sortedKeys.map((k) => k.split("|||")[0]);
  const eMap = await examNameMap(examCodes);

  for (const key of sortedKeys) {
    const [examCode, className] = key.split("|||");
    const rows = byExamClass.get(key) ?? [];
    rows.sort((a, b) => {
      const r = a.rollNo.localeCompare(b.rollNo);
      return r !== 0 ? r : a.section.localeCompare(b.section);
    });

    const examTitle = eMap[examCode] ?? examCode;
    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawPageHeader(
      page,
      font,
      fontBold,
      school.name,
      school.code,
      school.address || "",
      settings.examSession,
      examCode,
      examTitle,
      className
    );
    let y = PAGE_H - 162;
    drawTableHeader(page, y, fontBold);
    y -= HEADER_H + 4;

    for (let i = 0; i < rows.length; i++) {
      if (y < 86) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawPageHeader(
          page,
          font,
          fontBold,
          school.name,
          school.code,
          school.address || "",
          settings.examSession,
          examCode,
          examTitle,
          className
        );
        y = PAGE_H - 162;
        drawTableHeader(page, y, fontBold);
        y -= HEADER_H + 4;
      }
      drawTableRow(page, y, i, rows[i], font);
      y -= ROW_H;
    }

    page.drawText(`Total students: ${rows.length}`, {
      x: MARGIN_X,
      y: 48,
      size: 8,
      font: fontBold,
      color: rgb(0.16, 0.2, 0.28),
    });
    page.drawText("Teacher signature: ____________________", {
      x: PAGE_W - 240,
      y: 48,
      size: 8,
      font,
      color: rgb(0.16, 0.2, 0.28),
    });
  }

  if (sortedKeys.length === 0) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    page.drawText("No enrolled students found for attendance sheet generation.", {
      x: MARGIN_X,
      y: PAGE_H - 80,
      size: 12,
      font: fontBold,
      color: rgb(0.12, 0.14, 0.2),
    });
  }

  return pdfDoc.save();
}
