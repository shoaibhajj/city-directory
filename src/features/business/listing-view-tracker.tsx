// src/components/business/listing-view-tracker.tsx
"use client";

import { useEffect } from "react";

export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    void fetch(`/api/v1/businesses/${listingId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [listingId]);

  return null;
}
