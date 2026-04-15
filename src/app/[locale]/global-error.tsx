"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "4rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          حدث خطأ حرج في التطبيق
        </h1>
        <p style={{ color: "#666", marginBottom: "2rem" }}>
          يرجى تحديث الصفحة أو العودة لاحقاً.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.5rem",
            background: "#01696f",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
