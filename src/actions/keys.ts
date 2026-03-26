"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { isValidExamCodeDb } from "@/lib/exam-store";
import { isSetWiseAnswerKeyModelReady } from "@/lib/answer-key-store";

const SETS = ["A", "B", "C", "D"] as const;

function normSet(raw: string) {
  const s = raw.trim().toUpperCase();
  return SETS.includes(s as (typeof SETS)[number]) ? s : "";
}

function normalizeAnswers(raw: string) {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return "";

  const compact = cleaned.replace(/[^A-D]/g, "");
  if (compact.length >= 60) {
    return compact
      .slice(0, 60)
      .split("")
      .join(",");
  }

  const parts = cleaned.split(/[\s,;|]+/).map((s) => s.trim()).filter(Boolean);
  const mapped = parts
    .slice(0, 60)
    .map((s) => (s[0] && "ABCD".includes(s[0]) ? s[0] : ""))
    .filter(Boolean);
  return mapped.join(",");
}

export async function saveAnswerKeyAction(formData: FormData) {
  await requireAdmin();
  const ready = await isSetWiseAnswerKeyModelReady();
  if (!ready) {
    return { error: "Set-wise model not ready in running server. Restart dev server after Prisma generate/db push." };
  }
  const examCode = String(formData.get("examCode") ?? "").trim().toUpperCase();
  const className = String(formData.get("className") ?? "").trim();
  const setCode = normSet(String(formData.get("setCode") ?? ""));
  const answers = normalizeAnswers(String(formData.get("answers") ?? ""));

  const validExam = await isValidExamCodeDb(examCode);
  if (!validExam || !className || !setCode) {
    return { error: "Valid exam code, class, and set (A/B/C/D) are required." };
  }
  if (!answers) {
    return { error: "Answers cannot be empty. Use A/B/C/D values." };
  }

  await prisma.answerKey.upsert({
    where: {
      examCode_className_setCode: { examCode, className, setCode },
    },
    create: { examCode, className, setCode, answers },
    update: { answers },
  });

  revalidatePath("/admin/keys");
  return { ok: true as const };
}

export async function updateAnswerKeyAction(formData: FormData) {
  await requireAdmin();
  const ready = await isSetWiseAnswerKeyModelReady();
  if (!ready) {
    return { error: "Set-wise model not ready in running server. Restart dev server after Prisma generate/db push." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const examCode = String(formData.get("examCode") ?? "").trim().toUpperCase();
  const className = String(formData.get("className") ?? "").trim();
  const setCode = normSet(String(formData.get("setCode") ?? ""));
  const answers = normalizeAnswers(String(formData.get("answers") ?? ""));

  const validExam = await isValidExamCodeDb(examCode);
  if (!id || !validExam || !className || !setCode) {
    return { error: "Valid exam code, class, set, and key ID are required." };
  }
  if (!answers) {
    return { error: "Answers cannot be empty. Use A/B/C/D values." };
  }

  const conflict = await prisma.answerKey.findFirst({
    where: { examCode, className, setCode, NOT: { id } },
    select: { id: true },
  });
  if (conflict) {
    return { error: "Another key already exists for same exam + class + set." };
  }

  await prisma.answerKey.update({
    where: { id },
    data: { examCode, className, setCode, answers },
  });
  revalidatePath("/admin/keys");
  return { ok: true as const };
}

export async function deleteAnswerKeyAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Key ID required." };
  await prisma.answerKey.delete({ where: { id } });
  revalidatePath("/admin/keys");
  return { ok: true as const };
}

type CsvRow = {
  examCode: string;
  className: string;
  setCode: string;
  answers: string;
};

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur.trim());
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur.trim());
      cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const examIdx = header.indexOf("examcode");
  const classIdx = header.indexOf("classname");
  const setIdx = header.indexOf("setcode");
  const ansIdx = header.indexOf("answers");
  if (examIdx < 0 || classIdx < 0 || setIdx < 0 || ansIdx < 0) return [];

  const out: CsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    out.push({
      examCode: (r[examIdx] ?? "").trim().toUpperCase(),
      className: (r[classIdx] ?? "").trim(),
      setCode: normSet(r[setIdx] ?? ""),
      answers: normalizeAnswers(r[ansIdx] ?? ""),
    });
  }
  return out.filter((r) => r.examCode && r.className && r.setCode && r.answers);
}

export async function bulkUploadAnswerKeysAction(formData: FormData) {
  await requireAdmin();
  const ready = await isSetWiseAnswerKeyModelReady();
  if (!ready) {
    return { error: "Set-wise model not ready in running server. Restart dev server after Prisma generate/db push." };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "CSV file required." };
  }
  const raw = String(await file.text());
  const rows = parseCsv(raw);
  if (!rows.length) {
    return { error: "No valid rows found. Use sample CSV header and columns." };
  }

  let saved = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    const validExam = await isValidExamCodeDb(row.examCode);
    if (!validExam) {
      skipped.push(`${row.examCode}/${row.className}/${row.setCode} (invalid exam)`);
      continue;
    }
    await prisma.answerKey.upsert({
      where: {
        examCode_className_setCode: {
          examCode: row.examCode,
          className: row.className,
          setCode: row.setCode,
        },
      },
      create: row,
      update: { answers: row.answers },
    });
    saved++;
  }

  revalidatePath("/admin/keys");
  return {
    ok: true as const,
    saved,
    skipped,
  };
}
