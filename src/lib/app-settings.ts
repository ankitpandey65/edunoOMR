import { prisma } from "./prisma";

export async function getAppSettings() {
  const model = (prisma as unknown as { appSetting?: any }).appSetting;
  if (!model) {
    return { examSession: "", omrHeaderNote: "" };
  }
  const row = await model.findUnique({ where: { id: "app" } });
  return {
    examSession: row?.examSession || "",
    omrHeaderNote: row?.omrHeaderNote || "",
  };
}
