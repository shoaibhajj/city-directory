import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateCategory, deleteCategory } from "@/features/categories/actions";
import { buildSuccess, buildError } from "@/lib/api-response";

async function requireSuperAdminSession() {
  const session = await auth();
  if (!session?.user) return null;
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireSuperAdminSession())) {
    return NextResponse.json(buildError("FORBIDDEN", "Super Admin only"), {
      status: 403,
    });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const result = await updateCategory({ ...body, id });

    if (!result.success) {
      return NextResponse.json(
        buildError("VALIDATION_ERROR", "Update failed"),
        { status: 400 },
      );
    }

    return NextResponse.json(buildSuccess(result.data));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json(buildError("VALIDATION_ERROR", msg), {
      status: 400,
    });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireSuperAdminSession())) {
    return NextResponse.json(buildError("FORBIDDEN", "Super Admin only"), {
      status: 403,
    });
  }

  const { id } = await context.params;
  const result = await deleteCategory(id);

  if (!result.success) {
    return NextResponse.json(
      buildError("CONSTRAINT_VIOLATION", result.error ?? "Delete failed"),
      { status: 409 },
    );
  }

  return NextResponse.json(buildSuccess(null));
}
