"use client";

import { useMemo, useState } from "react";

export type ScoreRow = {
  id: string;
  processedAt: string;
  schoolName?: string;
  studentName: string;
  rollNo: string;
  className: string;
  examCode: string;
  paperSet?: string | null;
  attemptedQuestions?: number | null;
  totalQuestions?: number | null;
  correctAnswers?: number | null;
  score?: number | null;
  maxScore?: number | null;
  scanSource?: string | null;
};

export function ScoreTable({ rows, showSchool = false }: { rows: ScoreRow[]; showSchool?: boolean }) {
  const [q, setQ] = useState("");
  const [exam, setExam] = useState("");
  const [className, setClassName] = useState("");
  const [setCode, setSetCode] = useState("");

  const exams = useMemo(() => [...new Set(rows.map((r) => r.examCode))].sort(), [rows]);
  const classes = useMemo(() => [...new Set(rows.map((r) => r.className))].sort(), [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (exam && r.examCode !== exam) return false;
      if (className && r.className !== className) return false;
      if (setCode && (r.paperSet ?? "") !== setCode) return false;
      if (!term) return true;
      const hay = [
        r.studentName,
        r.rollNo,
        r.examCode,
        r.className,
        r.schoolName ?? "",
        r.scanSource ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, exam, className, setCode]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          className="input"
          placeholder="Search student / roll / exam"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={exam} onChange={(e) => setExam(e.target.value)}>
          <option value="">All exams</option>
          {exams.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select className="input" value={className} onChange={(e) => setClassName(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select className="input" value={setCode} onChange={(e) => setSetCode(e.target.value)}>
          <option value="">All sets</option>
          {["A", "B", "C", "D"].map((v) => (
            <option key={v} value={v}>
              Set {v}
            </option>
          ))}
        </select>
      </div>
      <div className="text-xs text-slate-500">Rows: {filtered.length}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              {showSchool ? <th className="px-4 py-3">School</th> : null}
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Roll</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">Set</th>
              <th className="px-4 py-3">Attempted</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Correct</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-500">{r.processedAt.replace("T", " ").slice(0, 19)}</td>
                {showSchool ? <td className="px-4 py-3 text-slate-300">{r.schoolName ?? "—"}</td> : null}
                <td className="px-4 py-3 text-white">{r.studentName}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.rollNo}</td>
                <td className="px-4 py-3 text-slate-300">{r.className}</td>
                <td className="px-4 py-3 font-mono text-xs text-sky-300">{r.examCode}</td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-300">{r.paperSet ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{r.attemptedQuestions ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{r.totalQuestions ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{r.correctAnswers ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">
                  {r.score != null && r.maxScore != null ? `${r.score} / ${r.maxScore}` : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.scanSource ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
