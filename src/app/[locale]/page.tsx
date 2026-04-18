// src/app/[locale]/page.tsx
// Homepage - shows hero, categories, and featured listings

import Image from "next/image";
import { getAllCategories } from "@/features/categories/queries";
import { getFeaturedListings } from "@/features/business/queries";
import { getTranslations } from "next-intl/server";
import { SearchBar } from "@/components/shared/search-bar";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-static";
export const dynamicParams = false;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("common");
  const tDir = await getTranslations("directory");
  const tListings = await getTranslations("listings");

  // Fetch categories for directory
  const categories = await getAllCategories();
  const featuredListings = await getFeaturedListings({ limit: 6 });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t("appName")}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            {t("appTagline")}
          </p>

          {/* Search Bar */}
          <SearchBar />
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">
            {tDir("categories")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`al-nabik/${category.slug}`}
                className="block p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div className="text-3xl mb-2">{category.icon || "📁"}</div>
                <h3 className="font-semibold">
                  {locale === "ar" ? category.nameAr : category.nameEn}
                </h3>
                {category.subcategories.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {category.subcategories.length} {tDir("subcategory")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      {featuredListings.length > 0 && (
        <section className="py-12 px-4 bg-muted/30">
          <div className="container mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">
              {tDir("featured")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`al-nabik/${listing.category.slug}/${listing.slug}`}
                  className="block bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="h-40 bg-gray-200 dark:bg-gray-800 relative">
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
                  <div className="p-4">
                    <h3 className="font-semibold">
                      {locale === "ar"
                        ? listing.nameAr
                        : listing.nameEn || listing.nameAr}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {listing.category.nameAr}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
