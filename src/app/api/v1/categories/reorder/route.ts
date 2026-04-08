import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reorderCategories } from "@/features/categories/actions";
import { buildSuccess, buildError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json(buildError("FORBIDDEN", "Super Admin only"), {
      status: 403,
    });

  try {
    const body = await req.json();
    const result = await reorderCategories({ items: body.items });
    return NextResponse.json(buildSuccess(result));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reorder failed";
    return NextResponse.json(buildError("VALIDATION_ERROR", msg), {
      status: 400,
    });
  }
}
