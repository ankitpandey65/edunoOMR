import { prisma } from "@/lib/prisma";
import { examNameMap } from "@/lib/exam-store";

export type ExamClassRow = {
  examCode: string;
  examTitle: string;
  className: string;
  section: string;
  omrSheets: number;
};

export async function getSchoolExamClassBreakdown(schoolId: string): Promise<{
  rows: ExamClassRow[];
  totalEnrollments: number;
  totalsByExam: { examCode: string; examTitle: string; count: number }[];
}> {
  const enrollments = await prisma.enrollment.findMany({
    where: { student: { schoolId } },
    select: {
      examCode: true,
      student: { select: { className: true, section: true } },
    },
  });

  const cellMap = new Map<string, number>();
  const examTotals = new Map<string, number>();

  for (const e of enrollments) {
    const sec = e.student.section ?? "";
    const key = `${e.examCode}\t${e.student.className}\t${sec}`;
    cellMap.set(key, (cellMap.get(key) ?? 0) + 1);
    examTotals.set(e.examCode, (examTotals.get(e.examCode) ?? 0) + 1);
  }
  const eMap = await examNameMap([...examTotals.keys()]);

  const rows: ExamClassRow[] = [...cellMap.entries()]
    .map(([key, omrSheets]) => {
      const [examCode, className, section] = key.split("\t");
      return {
        examCode,
        examTitle: eMap[examCode] ?? examCode,
        className,
        section,
        omrSheets,
      };
    })
    .sort((a, b) => {
      const ex = a.examCode.localeCompare(b.examCode);
      if (ex !== 0) return ex;
      const cl = a.className.localeCompare(b.className);
      if (cl !== 0) return cl;
      return a.section.localeCompare(b.section);
    });

  const totalsByExam = [...examTotals.entries()]
    .map(([examCode, count]) => ({
      examCode,
      examTitle: eMap[examCode] ?? examCode,
      count,
    }))
    .sort((a, b) => a.examCode.localeCompare(b.examCode));

  return {
    rows,
    totalEnrollments: enrollments.length,
    totalsByExam,
  };
}
