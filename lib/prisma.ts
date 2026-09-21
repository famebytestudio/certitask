import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function createMissingDatabasePrisma() {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return () => {
        throw new Error("DATABASE_URL is not configured");
      };
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClient = (() => {
  if (!connectionString) {
    return createMissingDatabasePrisma();
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
  });
})();

export const prisma = globalForPrisma.prisma ?? prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
