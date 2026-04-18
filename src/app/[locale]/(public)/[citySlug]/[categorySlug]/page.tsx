// src/app/[locale]/(public)/[citySlug]/[categorySlug]/page.tsx
// Directory browse page - shows all listings in a category

import { notFound } from "next/navigation";
import Image from "next/image";
import { getAllCategories } from "@/features/categories/queries";
import { getCategoryBySlug } from "@/features/categories/queries";
import { getPublicListings } from "@/features/business/queries";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

// ─── generateStaticParams ─────────────────────────────────────────────────────
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await getAllCategories();
    
    return categories.flatMap((category) => [
      {
        locale: "ar",
        citySlug: "al-nabik",
        categorySlug: category.slug,
      },
      {
        locale: "en",
        citySlug: "al-nabik",
        categorySlug: category.slug,
      },
    ]);
  } catch (error) {
    console.warn(
      "generateStaticParams: DB unreachable at build time, pages will render on first request via ISR:",
      error,
    );
    return [];
  }
}

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    citySlug: string;
    categorySlug: string;
  }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, citySlug, categorySlug } = await params;
  const t = await getTranslations("directory");
  const tListings = await getTranslations("listings");

  // Fetch category with subcategories
  const category = await getCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  // Fetch listings in this category
  const listings = await getPublicListings({
    citySlug,
    categorySlug,
    limit: 50,
  });

  const categoryName = locale === "ar" ? category.nameAr : category.nameEn;
  const hasSubcategories =
    category.subcategories && category.subcategories.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{categoryName}</h1>
        {category.descriptionAr && (
          <p className="text-gray-600 dark:text-gray-400">
            {locale === "ar" ? category.descriptionAr : category.descriptionEn}
          </p>
        )}
      </div>

      {/* Subcategory Filter */}
      {hasSubcategories && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`${citySlug}/${categorySlug}`}
            className="px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            {t("allSubcategories")}
          </Link>
          {category.subcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`${citySlug}/${categorySlug}?subcategory=${sub.slug}`}
              className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary/20 transition-colors"
            >
              {locale === "ar" ? sub.nameAr : sub.nameEn}
            </Link>
          ))}
        </div>
      )}

      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>{t("noListings")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`${citySlug}/${categorySlug}/${listing.slug}`}
              className="block bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
            >
              {/* Image or placeholder */}
              <div className="h-48 bg-gray-200 dark:bg-gray-800 relative">
                {listing.mediaFiles[0]?.url ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={listing.mediaFiles[0].url}
                      alt={listing.nameAr}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🏪
                  </div>
                )}
                {listing.isVerified && (
                  <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    {tListings("verified")}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">
                  {locale === "ar"
                    ? listing.nameAr
                    : listing.nameEn || listing.nameAr}
                </h3>
                <p className="text-sm text-gray-500">
                  {listing.category.nameAr}
                </p>
                {listing.phoneNumbers[0] && (
                  <p className="text-sm mt-2">
                    📞 {listing.phoneNumbers[0].number}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
