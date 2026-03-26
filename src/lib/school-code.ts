const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateSchoolCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPH[Math.floor(Math.random() * ALPH.length)];
  }
  return s;
}
