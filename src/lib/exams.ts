export const EXAMS = [
  { code: "EMO", name: "Eduno Mathematics Exam" },
  { code: "EEO", name: "Eduno English Exam" },
  { code: "EITO", name: "Eduno Information Technology Olympiad" },
  { code: "EGKO", name: "Eduno General Knowledge Olympiad" },
  { code: "ESO", name: "Eduno Science Olympiad" },
  { code: "ESSO", name: "Eduno Social Science Olympiad" },
  { code: "ECO", name: "Eduno Commerce Olympiad" },
  { code: "PCBO", name: "Physics, Chemistry, Biology Olympiad" },
  { code: "PCMO", name: "Physics, Chemistry, Mathematics Olympiad" },
] as const;

export type ExamCode = (typeof EXAMS)[number]["code"];

export function examName(code: string): string {
  return EXAMS.find((e) => e.code === code)?.name ?? code;
}

export function isValidExamCode(code: string): boolean {
  return EXAMS.some((e) => e.code === code);
}
