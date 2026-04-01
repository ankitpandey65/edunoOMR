import { prisma } from "./prisma";

export async function getAppSettings() {
  const model = (prisma as unknown as { appSetting?: any }).appSetting;
  if (!model) {
    return { examSession: "", omrHeaderNote: "", theme: "dark" as const };
  }
  try {
    const row = await model.findUnique({ where: { id: "app" } });
    const theme = String(row?.theme ?? "dark").toLowerCase();
    return {
      examSession: row?.examSession || "",
      omrHeaderNote: row?.omrHeaderNote || "",
      theme: theme === "light" ? "light" : "dark",
    };
  } catch {
    return { examSession: "", omrHeaderNote: "", theme: "dark" as const };
  }
}
