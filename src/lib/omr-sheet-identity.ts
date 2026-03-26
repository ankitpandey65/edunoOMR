/**
 * Central identity keys for linking PDF sheets ↔ students ↔ exams.
 * Each generated sheet has a unique `sheetId` (sh) embedded in QR + barcode + print.
 *
 * Composite key for lookups / analytics:
 *   studentId + examCode + sheetId  (sheetId is globally unique per generated page)
 */
export function sheetCompositeKey(studentId: string, examCode: string, sheetId: string): string {
  return `${studentId}::${examCode}::${sheetId}`;
}

export function parseCompositeKey(key: string): { studentId: string; examCode: string; sheetId: string } | null {
  const parts = key.split("::");
  if (parts.length !== 3) return null;
  const [studentId, examCode, sheetId] = parts;
  if (!studentId || !examCode || !sheetId) return null;
  return { studentId, examCode, sheetId };
}
