import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL é obrigatória para executar o seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.scheduleTemplate.upsert({
    where: { name: "Administrativo — segunda a sexta" },
    update: {},
    create: {
      name: "Administrativo — segunda a sexta",
      description: "Modelo de exemplo sem dados pessoais.",
      days: {
        create: [
          1, 2, 3, 4, 5,
        ].map((weekday) => ({
          weekday,
          isWorkingDay: true,
          expectedEntry: "08:00",
          expectedBreakStart: "12:00",
          expectedBreakEnd: "13:00",
          expectedExit: "17:00",
          expectedMinutes: 480,
        })),
      },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
