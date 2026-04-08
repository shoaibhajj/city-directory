import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllCategoriesAdmin } from "@/features/categories/queries";
import { CategoriesClient } from "./CategoriesClient";

// Force dynamic — admin always needs fresh data, never a cached page
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const session = await auth();

  // Role is SUPER_ADMIN (with underscore) — matches the Prisma Role enum
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/ar/sign-in");
  }

  const categories = await getAllCategoriesAdmin();

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <CategoriesClient categories={categories} />
    </main>
  );
}
