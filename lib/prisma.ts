// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Next.js'de hot-reload sırasında PrismaClient birden fazla kez
// oluşturulup "too many clients" hatası vermesin diye global'e atıyoruz.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // istersen kaldır
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
