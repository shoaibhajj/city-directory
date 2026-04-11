// src/lib/action-response.ts
// للـ Server Actions فقط — ليس لـ API Routes
// API Routes تستخدم src/lib/api-response.ts

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: string, code: string): ActionResult<never> {
  return { ok: false, error, code };
}
