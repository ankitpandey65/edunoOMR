/** Minimal CSV line parser (supports quoted fields with commas). */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  result.push(current.trim());
  return result.map((cell) => cell.replace(/^"|"$/g, ""));
}
