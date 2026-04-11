import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const ONE_DAY = 60 * 60 * 24;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = getClientIp(request);
  const key = `listing_view:${id}:${ip}`;

  // Rate limit: 1 count per IP per listing per 24 hours
  const already = await redis.get(key);
  if (already) {
    return Response.json({ counted: false });
  }

  // Verify listing is public before counting
  const listing = await prisma.businessProfile.findFirst({
    where: { id, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  if (!listing) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Atomic increment — safe against race conditions
  await prisma.businessProfile.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });

  await redis.setex(key, ONE_DAY, "1");

  return Response.json({ counted: true });
}
