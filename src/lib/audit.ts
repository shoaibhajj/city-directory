// src/lib/audit.ts
import { prisma } from "@/lib/prisma";
import { Prisma, AuditAction, Role } from "@prisma/client";

interface AuditParams {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: Role | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Fire-and-forget audit logging.
 * NEVER awaited — audit failure must never block the main operation.
 */
export function writeAuditLog(params: AuditParams): void {
  prisma.auditLog
    .create({
      data: {
        // ?? undefined converts null → undefined
        // WHY: Prisma create() accepts undefined (= omit the field)
        // but rejects null for optional scalar fields.
        // null is valid IN the database (the column IS nullable),
        // but Prisma's TypeScript input type only allows undefined
        // to mean "leave it out of the INSERT statement".
        actorId: params.actorId ?? undefined,
        actorEmail: params.actorEmail ?? undefined,
        actorRole: params.actorRole ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,

        // Cast to Prisma.InputJsonValue — Prisma's JSON columns require this.
        // WHY: Prisma.InputJsonValue is the exact type Prisma expects for Json
        // columns. Record<string, unknown> is technically compatible at runtime
        // but TypeScript cannot prove it without the cast because "unknown"
        // could contain values JSON cannot represent (like functions or symbols).
        previousValues:
          (params.previousValues as Prisma.InputJsonValue) ?? undefined,
        newValues: (params.newValues as Prisma.InputJsonValue) ?? undefined,
        ipAddress: params.ipAddress,
      },
    })
    .catch((err) => console.error("[AuditLog] write failed:", err));
}
