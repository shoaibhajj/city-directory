// src/lib/api-response.ts
// Location: src/lib/api-response.ts
//
// EVERY API route in this project returns the same shape.
// This file provides helper functions that build those responses.
//
// The standard shape:
// {
//   success: boolean           — did this request succeed?
//   data: T | null             — the actual payload (null on error)
//   error: { code, message } | null  — error details (null on success)
//   meta: { timestamp, ...pagination }  — metadata about the response
// }
//
// WHY a standard response shape?
// - Mobile apps can write one response handler for all API calls
// - Frontend code can check response.success without parsing each endpoint uniquely
// - Errors always have a machine-readable 'code' for programmatic handling
// - Humans can read 'message' in the UI

export interface ApiMeta {
  timestamp: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiError {
  code: string; // Machine-readable: "AUTH_001", "LISTING_NOT_FOUND"
  message: string; // Human-readable: "Invalid email or password"
  details?: unknown; // Extra debugging info (never shown to end users)
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

// Builds a success response
// Usage: return Response.json(buildSuccess({ user }))
export function buildSuccess<T>(
  data: T,
  meta?: Partial<ApiMeta>,
): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

// Builds an error response
// Usage: return Response.json(buildError('AUTH_001', 'Invalid credentials'), { status: 401 })
export function buildError(
  code: string,
  message: string,
  details?: unknown,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message, details },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
