import sharp from "sharp";
import { bubbleBoxPixels } from "./omr-template";
import { PAPER_SET_OPTIONS, paperSetBubbleBoxPixels } from "./omr-layout";

const OPTIONS = ["A", "B", "C", "D"] as const;

async function normalizeScanToOmrCanvas(buffer: Buffer): Promise<Buffer> {
  const oriented = sharp(buffer).rotate();
  const meta = await oriented.metadata();
  const srcW = meta.width ?? 1240;
  const srcH = meta.height ?? 1754;

  const probe = await oriented
    .clone()
    .grayscale()
    .resize(srcW, srcH, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = probe.data;
  const channels = probe.info.channels;
  const stride = srcW * channels;

  const patchW = Math.max(8, Math.floor(srcW * 0.08));
  const patchH = Math.max(8, Math.floor(srcH * 0.08));
  const patchMean = (x0: number, y0: number) => {
    let sum = 0;
    let cnt = 0;
    for (let y = y0; y < Math.min(srcH, y0 + patchH); y++) {
      for (let x = x0; x < Math.min(srcW, x0 + patchW); x++) {
        const idx = y * stride + x * channels;
        sum += data[idx];
        cnt++;
      }
    }
    return cnt ? sum / cnt : 255;
  };
  const corners = [
    patchMean(0, 0),
    patchMean(srcW - patchW, 0),
    patchMean(0, srcH - patchH),
    patchMean(srcW - patchW, srcH - patchH),
  ];
  const darkBackdrop = corners.reduce((a, b) => a + b, 0) / corners.length < 95;

  if (darkBackdrop) {
    let minX = srcW;
    let minY = srcH;
    let maxX = -1;
    let maxY = -1;
    const brightThreshold = 185;

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const idx = y * stride + x * channels;
        if (data[idx] >= brightThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX > minX && maxY > minY) {
      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;
      const areaRatio = (boxW * boxH) / (srcW * srcH);
      const ratio = boxW / boxH;
      const nearA4 = ratio > 0.62 && ratio < 0.78;
      if (areaRatio > 0.45 && areaRatio < 0.995 && nearA4) {
        const pad = 2;
        const left = Math.max(0, minX - pad);
        const top = Math.max(0, minY - pad);
        const width = Math.min(srcW - left, boxW + pad * 2);
        const height = Math.min(srcH - top, boxH + pad * 2);
        return oriented
          .clone()
          .extract({ left, top, width, height })
          .resize(1240, 1754, { fit: "fill" })
          .png()
          .toBuffer();
      }
    }
  }

  return oriented
    .clone()
    .resize(1240, 1754, { fit: "fill" })
    .png()
    .toBuffer();
}

export type Detected = {
  answers: string[];
  confidences: number[];
  /** True when two or more options look filled (multiple marks → treat as invalid / 0) */
  ambiguous: boolean[];
};

export type DetectedPaperSet = {
  setCode: (typeof PAPER_SET_OPTIONS)[number] | null;
  ambiguous: boolean;
  confidence: number;
};

/**
 * Heuristic bubble read: picks darkest region per question.
 * Works best on scans aligned to A4, reasonable contrast, filled bubbles.
 */
export async function detectAnswersFromScan(buffer: Buffer): Promise<Detected> {
  const normalized = await normalizeScanToOmrCanvas(buffer);
  const base = sharp(normalized);
  const meta = await base.metadata();
  const w = meta.width ?? 1240;
  const h = meta.height ?? 1754;
  // Normalize + light sharpen improves fill detection on mobile captures.
  const img = base
    .clone()
    .resize(w, h, { fit: "fill" })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 0.8 })
    .raw();
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const stride = w * channels;

  const answers: string[] = [];
  const confidences: number[] = [];
  const ambiguous: boolean[] = [];

  for (let q = 0; q < 60; q++) {
    const avgs: number[] = [];
    for (let o = 0; o < 4; o++) {
      const box = bubbleBoxPixels(w, h, q, o);
      const centerSize = Math.max(4, Math.round(box.size * 0.48));
      const centerOffset = Math.max(0, Math.floor((box.size - centerSize) / 2));
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < centerSize; dy++) {
        const yy = box.top + centerOffset + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = 0; dx < centerSize; dx++) {
          const xx = box.left + centerOffset + dx;
          if (xx < 0 || xx >= w) continue;
          const idx = yy * stride + xx * channels;
          const v = 255 - data[idx];
          sum += v;
          count++;
        }
      }
      avgs.push(count ? sum / count : 0);
    }
    const intensities = avgs.map((v) => v / 255);
    const sorted = [...intensities].sort((a, b) => b - a);
    const best = sorted[0] ?? 0;
    const second = sorted[1] ?? 0;
    const bestOpt = intensities.indexOf(best);
    const high = intensities.filter((v) => v > 0.6).length;
    const allLow = intensities.every((v) => v < 0.4);

    let picked = "";
    let isMulti = false;
    if (high > 1) {
      isMulti = true;
    } else if (allLow) {
      picked = "";
    } else if (best > 0.6 && best - second >= 0.2 && bestOpt >= 0) {
      picked = OPTIONS[bestOpt];
    } else {
      // strict mode: do not guess if it is not clear
      picked = "";
    }

    ambiguous.push(isMulti);
    answers.push(isMulti ? "" : picked);
    confidences.push(Math.round((best - second) * 1000) / 10);
  }

  return { answers, confidences, ambiguous };
}

export async function detectPaperSetFromScan(buffer: Buffer): Promise<DetectedPaperSet> {
  const normalized = await normalizeScanToOmrCanvas(buffer);
  const base = sharp(normalized);
  const meta = await base.metadata();
  const w = meta.width ?? 1240;
  const h = meta.height ?? 1754;
  const img = base
    .clone()
    .resize(w, h, { fit: "fill" })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 0.8 })
    .raw();
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const stride = w * channels;

  const avgs: number[] = [];
  for (let o = 0; o < 4; o++) {
    const box = paperSetBubbleBoxPixels(w, h, o);
    const centerSize = Math.max(4, Math.round(box.size * 0.48));
    const centerOffset = Math.max(0, Math.floor((box.size - centerSize) / 2));
    let sum = 0;
    let count = 0;
    for (let dy = 0; dy < centerSize; dy++) {
      const yy = box.top + centerOffset + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = 0; dx < centerSize; dx++) {
        const xx = box.left + centerOffset + dx;
        if (xx < 0 || xx >= w) continue;
        const idx = yy * stride + xx * channels;
        const v = 255 - data[idx];
        sum += v;
        count++;
      }
    }
    avgs.push(count ? sum / count : 0);
  }

  const sorted = [...avgs].sort((a, b) => b - a);
  const bestDark = sorted[0] ?? 0;
  const secondDark = sorted[1] ?? 0;
  const bestOpt = avgs.indexOf(bestDark);
  const margin = bestDark - secondDark;
  const darkThreshold = 55;
  const multiMarkRatio = 0.74;
  const blank = avgs.every((v) => v < 32);
  const strongCount = avgs.filter((v) => v >= darkThreshold).length;
  const ambiguous =
    strongCount >= 2 ||
    (bestDark > darkThreshold && secondDark > darkThreshold && secondDark >= bestDark * multiMarkRatio);

  if (!blank && !ambiguous && bestOpt >= 0 && margin > Math.max(10, bestDark * 0.16)) {
    return { setCode: PAPER_SET_OPTIONS[bestOpt], ambiguous: false, confidence: margin };
  }
  return { setCode: null, ambiguous: ambiguous || !blank, confidence: margin };
}

export function parseAnswerKey(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < 60; i++) {
    out.push(parts[i] ?? "");
  }
  return out;
}

export function scoreAnswers(
  studentAnswers: string[],
  keyAnswers: string[],
  marksPerQuestion = 1,
  opts?: {
    /** If true, blank or ambiguous (multiple marks) scores 0 for that item */
    multipleOrBlankIsZero?: boolean;
    ambiguous?: boolean[];
  }
) {
  let correct = 0;
  let counted = 0;
  const multi = opts?.multipleOrBlankIsZero ?? true;
  for (let i = 0; i < 60; i++) {
    const s = (studentAnswers[i] || "").toUpperCase();
    const k = (keyAnswers[i] || "").toUpperCase();
    if (!k) continue;
    counted++;
    if (multi && (!s || opts?.ambiguous?.[i])) continue;
    if (s && s === k) correct += marksPerQuestion;
  }
  return { correct, max: counted * marksPerQuestion };
}
