import { prisma } from "./prisma";
import { EXAMS } from "./exams";

export type ExamOption = { code: string; name: string };

function fallbackExams(): ExamOption[] {
  return EXAMS.map((e, i) => ({ code: e.code, name: e.name, sortOrder: (i + 1) * 10 }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ code, name }) => ({ code, name }));
}

function examModel() {
  return (prisma as unknown as { exam?: any }).exam;
}

export async function listActiveExams(): Promise<ExamOption[]> {
  const model = examModel();
  if (!model) return fallbackExams();
  const rows = await model.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { code: true, name: true },
  });
  return rows?.length ? rows : fallbackExams();
}

export async function listAllExams() {
  const model = examModel();
  if (!model) return fallbackExams().map((e, idx) => ({ ...e, isActive: true, sortOrder: (idx + 1) * 10 }));
  return model.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function isValidExamCodeDb(code: string): Promise<boolean> {
  if (!code) return false;
  const model = examModel();
  if (!model) return EXAMS.some((e) => e.code === code.toUpperCase());
  const row = await model.findUnique({
    where: { code: code.toUpperCase() },
    select: { code: true, isActive: true },
  });
  return !!row?.isActive;
}

export async function filterValidExamCodesDb(codes: string[]): Promise<string[]> {
  const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (!normalized.length) return [];
  const model = examModel();
  if (!model) {
    const valid = new Set(EXAMS.map((e) => e.code));
    return normalized.filter((c) => valid.has(c));
  }
  const rows = await model.findMany({
    where: { code: { in: normalized }, isActive: true },
    select: { code: true },
  });
  const valid = new Set(rows.map((r) => r.code));
  return normalized.filter((c) => valid.has(c));
}

export async function examNameByCode(code: string): Promise<string> {
  const model = examModel();
  if (!model) return EXAMS.find((e) => e.code === code.toUpperCase())?.name ?? code;
  const row = await model.findUnique({
    where: { code: code.toUpperCase() },
    select: { name: true },
  });
  return row?.name ?? code;
}

export async function examNameMap(codes: string[]): Promise<Record<string, string>> {
  const normalized = [...new Set(codes.map((c) => c.toUpperCase()))];
  if (!normalized.length) return {};
  const model = examModel();
  if (!model) {
    const out: Record<string, string> = {};
    for (const c of normalized) out[c] = EXAMS.find((e) => e.code === c)?.name ?? c;
    return out;
  }
  const rows = await model.findMany({
    where: { code: { in: normalized } },
    select: { code: true, name: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) out[r.code] = r.name;
  return out;
}
