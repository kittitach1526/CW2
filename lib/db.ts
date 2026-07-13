// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// เรียกใช้ได้เลยโดยไม่ต้องยัดค่านพิกัดซ้ำในวงเล็บ เพราะมันอ่านจาก schema.prisma แล้ว
export const db = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;