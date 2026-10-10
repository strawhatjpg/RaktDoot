import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

const globalDb = globalThis as unknown as { raktdootDb?: PrismaClient };

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production");
  return `file:${resolve(process.cwd(), "prisma/dev.db").replaceAll("\\", "/")}`;
}

/** Lazy connection: builds need no database or credentials. */
export function getDb(): PrismaClient {
  globalDb.raktdootDb ??= new PrismaClient({ datasourceUrl: databaseUrl() });
  return globalDb.raktdootDb;
}