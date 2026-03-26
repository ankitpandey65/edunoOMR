import { prisma } from "@/lib/prisma";

export type AnswerKeyRowCompat = {
  id: string;
  examCode: string;
  className: string;
  setCode: string;
  answers: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function isSetWiseAnswerKeyModelReady(): Promise<boolean> {
  try {
    await prisma.answerKey.findFirst({
      select: { id: true, setCode: true },
    });
    return true;
  } catch {
    return false;
  }
}

export async function listAnswerKeysCompat(): Promise<AnswerKeyRowCompat[]> {
  try {
    const rows = await prisma.answerKey.findMany({
      orderBy: [{ examCode: "asc" }, { className: "asc" }, { setCode: "asc" }],
    });
    return rows as AnswerKeyRowCompat[];
  } catch {
    const rows = await prisma.answerKey.findMany({
      orderBy: [{ examCode: "asc" }, { className: "asc" }],
    });
    return (rows as Array<Omit<AnswerKeyRowCompat, "setCode">>).map((r) => ({
      ...r,
      setCode: "A",
    }));
  }
}

export async function findAnswerKeysByExamClassCompat(
  examCode: string,
  className: string
): Promise<Array<Pick<AnswerKeyRowCompat, "setCode" | "answers">>> {
  try {
    const rows = await prisma.answerKey.findMany({
      where: { examCode, className },
      orderBy: { setCode: "asc" },
      select: { setCode: true, answers: true },
    });
    return rows;
  } catch {
    const row = await prisma.answerKey.findUnique({
      where: { examCode_className: { examCode, className } },
      select: { answers: true },
    });
    return row ? [{ setCode: "A", answers: row.answers }] : [];
  }
}
