import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

const DEFAULT_EXAMS = [
  { code: "EMO", name: "Eduno Mathematics Exam", sortOrder: 10 },
  { code: "EEO", name: "Eduno English Exam", sortOrder: 20 },
  { code: "EITO", name: "Eduno Information Technology Olympiad", sortOrder: 30 },
  { code: "EGKO", name: "Eduno General Knowledge Olympiad", sortOrder: 40 },
  { code: "ESO", name: "Eduno Science Olympiad", sortOrder: 50 },
  { code: "ESSO", name: "Eduno Social Science Olympiad", sortOrder: 60 },
  { code: "ECO", name: "Eduno Commerce Olympiad", sortOrder: 70 },
  { code: "PCBO", name: "Physics, Chemistry, Biology Olympiad", sortOrder: 80 },
  { code: "PCMO", name: "Physics, Chemistry, Mathematics Olympiad", sortOrder: 90 },
];

async function main() {
  for (const ex of DEFAULT_EXAMS) {
    await prisma.exam.upsert({
      where: { code: ex.code },
      create: ex,
      update: { name: ex.name, isActive: true },
    });
  }

  await prisma.appSetting.upsert({
    where: { id: "app" },
    create: { id: "app", examSession: "2026-27", theme: "dark" },
    update: { theme: "dark" },
  });

  const adminHash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@eduno.local" },
    create: {
      email: "admin@eduno.local",
      passwordHash: adminHash,
      name: "Platform Admin",
      role: Role.ADMIN,
    },
    update: { passwordHash: adminHash },
  });

  const school = await prisma.school.upsert({
    where: { code: "DEMO0001" },
    create: {
      code: "DEMO0001",
      name: "Demo Public School",
      contact: "+91-0000000000",
    },
    update: {},
  });

  const schoolHash = await bcrypt.hash("school123", 12);
  await prisma.user.upsert({
    where: { email: "school@demo.local" },
    create: {
      email: "school@demo.local",
      passwordHash: schoolHash,
      name: "Demo School Admin",
      role: Role.SCHOOL,
      schoolId: school.id,
    },
    update: { schoolId: school.id, passwordHash: schoolHash },
  });

  console.log("Seed OK. Admin: admin@eduno.local / admin123");
  console.log("School: school@demo.local / school123");
  console.log("School code:", school.code);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
