import OpenAI from "openai";

export type OpenAiOmrDetection = {
  answers: string[];
  ambiguous: boolean[];
  setCode: "A" | "B" | "C" | "D" | null;
  confidence: number;
  examCode: string | null;
  studentId: string | null;
  rollNo: string | null;
  schoolCode: string | null;
};

function sanitizeAnswer(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "A" || s === "B" || s === "C" || s === "D" ? s : "";
}

function sanitizeSet(v: unknown): "A" | "B" | "C" | "D" | null {
  const s = sanitizeAnswer(v);
  return s ? (s as "A" | "B" | "C" | "D") : null;
}

function normalizeDetection(raw: any): OpenAiOmrDetection {
  const inAnswers = Array.isArray(raw?.answers) ? raw.answers : [];
  const answers: string[] = [];
  for (let i = 0; i < 60; i++) {
    answers.push(sanitizeAnswer(inAnswers[i]));
  }
  const inAmb = Array.isArray(raw?.ambiguous) ? raw.ambiguous : [];
  const ambiguous: boolean[] = [];
  for (let i = 0; i < 60; i++) {
    ambiguous.push(Boolean(inAmb[i]));
  }
  const confidenceNum = Number(raw?.confidence ?? 0.75);
  const examCode = String(raw?.examCode ?? "")
    .trim()
    .toUpperCase();
  const studentId = String(raw?.studentId ?? "").trim();
  const rollNo = String(raw?.rollNo ?? "").trim();
  const schoolCode = String(raw?.schoolCode ?? "")
    .trim()
    .toUpperCase();
  return {
    answers,
    ambiguous,
    setCode: sanitizeSet(raw?.setCode),
    confidence: Number.isFinite(confidenceNum) ? Math.max(0, Math.min(1, confidenceNum)) : 0.75,
    examCode: examCode || null,
    studentId: studentId || null,
    rollNo: rollNo || null,
    schoolCode: schoolCode || null,
  };
}

export function hasOpenAiForOmr() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function detectOmrWithOpenAi(imageBuffer: Buffer): Promise<OpenAiOmrDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const client = new OpenAI({ apiKey, timeout: 45000, maxRetries: 1 });
  const model = process.env.OPENAI_OMR_MODEL || "gpt-4.1";
  const dataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

  const prompt = [
    "You are reading an OMR sheet image.",
    "Return STRICT JSON object only with keys: setCode, examCode, studentId, rollNo, schoolCode, answers, ambiguous, confidence.",
    "Rules:",
    "- setCode: one of A/B/C/D or null if unclear.",
    "- examCode: short exam code from header (e.g. EGKO), or null if unclear.",
    "- studentId: QR student id if visible/readable in sheet metadata, else null.",
    "- rollNo: printed roll number text if visible, else null.",
    "- schoolCode: school code text (e.g. VT236EMQ) if visible, else null.",
    "- answers: array length 60, each item one of A/B/C/D or empty string if blank/unclear.",
    "- ambiguous: array length 60, true if multiple marks for that question, else false.",
    "- confidence: number 0..1 for overall extraction confidence.",
    "- Be strict: do NOT guess uncertain bubbles.",
    "- If uncertain between options, keep answer empty and set ambiguous accordingly.",
    "- Prefer accuracy over recall.",
    "- Do not include markdown or any extra text.",
  ].join("\n");

  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const content = res.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON response for OMR extraction.");
  }
  return normalizeDetection(parsed);
}
