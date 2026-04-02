import env from "@/env";
// src/lib/prisma.ts
// Location: src/lib/prisma.ts
//
// This file exports a SINGLETON instance of Prisma Client.
//
// WHAT IS A SINGLETON?
// A singleton is a pattern where only ONE instance of something exists
// in the entire application. Here, one PrismaClient = one connection pool
// to the database.
//
// WHY NOT just do: export const prisma = new PrismaClient()?
// Because Next.js runs in development mode with hot-reload (Fast Refresh).
// Every time you save a file, Next.js re-evaluates your modules.
// Without the singleton pattern, each hot-reload creates a NEW PrismaClient,
// which opens NEW database connections. After 10 hot-reloads:
// - You have 10 connection pools × each pool has 5 connections = 50 DB connections
// - PostgreSQL's default max_connections is 100
// - Your app crashes with "too many connections" error
//
// THE FIX: Store the PrismaClient on globalThis (global object).
// globalThis persists across hot-reloads. So we reuse the same instance.
// In production (not dev), hot-reload doesn't happen, so we always create fresh.

import { PrismaClient } from "@prisma/client";
// This is the TypeScript type trick for accessing globalThis properties
// that TypeScript doesn't know about by default
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? // In development: log all SQL queries, errors, and warnings
          // This helps you understand what SQL Prisma generates
          // and catch N+1 query problems early
          ["query", "error", "warn"]
        : // In production: only log errors
          // Logging every query in production creates noise and
          // reveals your database structure in server logs
          ["error"],
  });

// Only cache the instance in development (not production)
if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
