import { NextResponse } from "next/server";
import { getAllCategories } from "@/features/categories/queries";
import { buildSuccess, buildError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const categories = await getAllCategories();
    return NextResponse.json(buildSuccess(categories), {
      headers: {
        // CDN-level caching on top of Redis caching
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/categories]", err);
    return NextResponse.json(
      buildError("INTERNAL_ERROR", "Failed to fetch categories"),
      { status: 500 },
    );
  }
}
