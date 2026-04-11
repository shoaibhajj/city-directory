"use client";

import { useEffect } from "react";

export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    void fetch(`/api/v1/businesses/${listingId}/view`, {
      method: "POST",
      keepalive: true, // keeps request alive even if user navigates away
    }).catch(() => {
      // fire-and-forget — never throw, never block render
    });
  }, [listingId]);

  return null;
}
