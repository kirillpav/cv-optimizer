import { NextRequest, NextResponse } from "next/server";
import { convertPdfToHtml } from "@/lib/pdf-conversion/pdf2html";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("resumePdf") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await convertPdfToHtml(arrayBuffer);

    return NextResponse.json({
      html: result.html,
      css: result.css,
      extractedText: result.extractedText,
      pageCount: result.pageCount,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("PDF to HTML conversion error:", error);
    return NextResponse.json(
      { error: "Failed to convert PDF to HTML" },
      { status: 500 }
    );
  }
}
