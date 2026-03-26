/**
 * Single source of truth for Eduno OMR sheet geometry (A4 portrait, pdf-lib coords).
 * PDF origin: bottom-left; y increases upward. Scan code uses normalized coords from top-left.
 *
 * Column width limits max bubble size (~5.6–5.8 mm) with ~2 mm clear gap between adjacent circles.
 */

const MM = 2.83465;

export const OMR_PAGE = {
  w: 595.28,
  h: 841.89,
  margin: 40,
  safeInset: 32,
  detectionInset: 14,
} as const;

/** Standard OMR bubble diameter (~5.0 mm) */
const ANSWER_DIAM_PT = 5.0 * MM;
export const ANSWER_R = ANSWER_DIAM_PT / 2;
/** Clear gap between bubble edges (mm) */
const EDGE_GAP_MM = 2;
const ANSWER_BUBBLE_SPACING = 2 * ANSWER_R + EDGE_GAP_MM * MM;

export const OMR_GRID = {
  pageW: OMR_PAGE.w,
  pageH: OMR_PAGE.h,
  cols: 5,
  rows: 12,
  optionsPerQ: 4,
  answerBubbleRadius: ANSWER_R,
  /** Taller rows for larger bubbles + A–D labels above */
  rowH: 29,
  /** Wider band between sections B/C/D so titles clear first answer row */
  sectionGap: 18,
  gridLeft: 46,
  gridRight: OMR_PAGE.w - 46,
  /** gridTop − gridBottom = 12×rowH + 3×sectionGap */
  gridTop: 500,
  gridBottom: 98,
  colW: (OMR_PAGE.w - 92) / 5,
  qLabelWidth: 14,
  gapAfterQ: 5,
  bubbleSpacing: ANSWER_BUBBLE_SPACING,
  gridTopRatio: 0.35,
  gridHeightRatio: 0.29,
  bubbleStartOffset: 0,
} as const;

function gapsBeforeRow(row: number): number {
  let g = 0;
  for (let i = 0; i < row; i++) {
    if (i === 2 || i === 5 || i === 8) g++;
  }
  return g;
}

export function answerRowTopY(row: number): number {
  return (
    OMR_GRID.gridTop - row * OMR_GRID.rowH - gapsBeforeRow(row) * OMR_GRID.sectionGap
  );
}

export function answerRowCenterY(row: number): number {
  return answerRowTopY(row) - OMR_GRID.rowH / 2;
}

export function questionNumberLeftX(questionIndex: number): number {
  const col = questionIndex % OMR_GRID.cols;
  return OMR_GRID.gridLeft + col * OMR_GRID.colW + 3;
}

export function answerBubbleCenterPdf(questionIndex: number, optionIndex: number) {
  const row = Math.floor(questionIndex / OMR_GRID.cols);
  const col = questionIndex % OMR_GRID.cols;
  const colLeft = OMR_GRID.gridLeft + col * OMR_GRID.colW;
  const firstCenterX =
    colLeft + OMR_GRID.qLabelWidth + OMR_GRID.gapAfterQ + OMR_GRID.answerBubbleRadius;
  const cx = firstCenterX + optionIndex * OMR_GRID.bubbleSpacing;
  const cy = answerRowCenterY(row);
  return { x: cx, y: cy };
}

export function bubbleCenterNorm(questionIndex: number, optionIndex: number) {
  const { x, y } = answerBubbleCenterPdf(questionIndex, optionIndex);
  return {
    x: x / OMR_PAGE.w,
    y: 1 - y / OMR_PAGE.h,
  };
}

export function bubbleBoxPixels(
  width: number,
  height: number,
  questionIndex: number,
  optionIndex: number,
  radiusRatio = 0.017
) {
  const c = bubbleCenterNorm(questionIndex, optionIndex);
  const cx = c.x * width;
  const cy = c.y * height;
  const r = Math.min(width, height) * radiusRatio;
  return { left: Math.round(cx - r), top: Math.round(cy - r), size: Math.round(r * 2) };
}

export function sectionTitleCenterY(row: number): number | null {
  if (row !== 3 && row !== 6 && row !== 9) return null;
  const prevRowBottom = answerRowTopY(row - 1) - OMR_GRID.rowH;
  const rowTop = answerRowTopY(row);
  return (prevRowBottom + rowTop) / 2;
}

/** Shifted down because answer grid moved up (taller section bands) */
export const OMR_ROLL = {
  rowH: 12,
  bubbleR: 4.4,
  blockTop: 528,
  blockBottom: 432,
  digit0Left: 122,
  digitSpacing: 10,
} as const;

export function rollBubbleCenterPdf(digitIndex: number, value: number) {
  const rowTop = OMR_ROLL.blockTop - digitIndex * OMR_ROLL.rowH;
  const cy = rowTop - OMR_ROLL.rowH / 2;
  const cx = OMR_ROLL.digit0Left + value * OMR_ROLL.digitSpacing;
  return { x: cx, y: cy };
}

export const OMR_SET = {
  rowCenterY: 590,
  startX: 360,
  spacing: 26,
  bubbleR: OMR_GRID.answerBubbleRadius,
} as const;

export function paperSetBubbleCenterPdf(optionIndex: number) {
  return {
    x: OMR_SET.startX + optionIndex * OMR_SET.spacing,
    y: OMR_SET.rowCenterY,
  };
}

export const PAPER_SET_OPTIONS = ["A", "B", "C", "D"] as const;

export function paperSetBubbleCenterNorm(optionIndex: number) {
  const { x, y } = paperSetBubbleCenterPdf(optionIndex);
  return {
    x: x / OMR_PAGE.w,
    y: 1 - y / OMR_PAGE.h,
  };
}

export function paperSetBubbleBoxPixels(
  width: number,
  height: number,
  optionIndex: number,
  radiusRatio = 0.017
) {
  const c = paperSetBubbleCenterNorm(optionIndex);
  const cx = c.x * width;
  const cy = c.y * height;
  const r = Math.min(width, height) * radiusRatio;
  return { left: Math.round(cx - r), top: Math.round(cy - r), size: Math.round(r * 2) };
}

export function sectionLabelForRow(row: number): string | null {
  if (row === 0) return "Section A — Questions 1–15";
  if (row === 3) return "Section B — Questions 16–30";
  if (row === 6) return "Section C — Questions 31–45";
  if (row === 9) return "Section D — Questions 46–60";
  return null;
}
