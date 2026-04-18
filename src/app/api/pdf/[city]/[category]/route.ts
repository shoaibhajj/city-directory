import { NextRequest, NextResponse } from "next/server";
import { getOrGeneratePdf } from "@/features/pdf/generator";

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.timestamp > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ city: string; category: string }> }
) {
  try {
    const { city: citySlug, category: categorySlug } = await params;
    const locale = request.nextUrl.searchParams.get("locale") || "ar";

    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || request.headers.get("x-real-ip") 
      || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Generate PDF
    const pdfBuffer = await getOrGeneratePdf({
      citySlug,
      categorySlug,
      _locale: locale,
    });

    // Return PDF - convert Buffer to Uint8Array
    const filename = `${categorySlug}_${citySlug}_${locale}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}