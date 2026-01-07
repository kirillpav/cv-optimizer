import { NextRequest, NextResponse } from "next/server";
import { convertHtmlToPdf, HtmlToPdfOptions } from "@/lib/pdf-conversion/html2pdf";

interface HtmlToPdfRequest {
  html: string;
  css?: string;
  options?: HtmlToPdfOptions;
}

export async function POST(request: NextRequest) {
  try {
    const body: HtmlToPdfRequest = await request.json();

    if (!body.html) {
      return NextResponse.json(
        { error: "No HTML content provided" },
        { status: 400 }
      );
    }

    const pdfBuffer = await convertHtmlToPdf(body.html, body.css, body.options);

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="optimized-resume.pdf"',
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("HTML to PDF conversion error:", error);
    return NextResponse.json(
      { error: "Failed to convert HTML to PDF" },
      { status: 500 }
    );
  }
}

// Configure for longer timeout on Vercel (for PDF generation)
export const maxDuration = 60;
