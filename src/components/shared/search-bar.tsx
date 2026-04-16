// src/components/shared/search-bar.tsx
// Search bar with results dropdown

"use client";

import { useState, useTransition } from "react";
import { searchListingsAction } from "@/features/business/actions";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function SearchBar() {
  const t = useTranslations("search");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<unknown[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (value.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      const response = await searchListingsAction({ query: value });
      if (response.ok && response.data) {
        setResults(response.data.results as unknown[]);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    });
  }

  function handleSearch(_formData: FormData) {
    // This is just to suppress the form action warning
    // The actual search is done in handleInputChange
  }

  return (
    <div className="relative max-w-xl mx-auto">
      <form action={handleSearch} className="relative">
        <input
          type="search"
          name="query"
          value={query}
          onChange={handleInputChange}
          placeholder={t("placeholder")}
          className="w-full px-6 py-4 text-lg rounded-full border-2 border-gray-200 dark:border-gray-700 focus:border-primary focus:outline-none bg-white dark:bg-gray-900"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isPending}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        >
          🔍
        </button>
      </form>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden z-50">
          {results.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">
              {t("noResults")}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((listing: unknown) => {
                const l = listing as {
                  id: string;
                  nameAr: string;
                  nameEn: string | null;
                  slug: string;
                  category: { slug: string };
                };
                return (
                  <Link
                    key={l.id}
                    href={`/ar/al-nabik/${l.category.slug}/${l.slug}`}
                    onClick={() => setIsOpen(false)}
                    className="block p-4 hover:bg-muted transition-colors border-b last:border-b-0"
                  >
                    <div className="font-medium">{l.nameEn || l.nameAr}</div>
                    <div className="text-sm text-gray-500">
                      {l.category.slug}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
