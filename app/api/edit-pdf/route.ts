import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFPage, PDFPageDrawTextOptions, rgb, StandardFonts } from "pdf-lib";

interface TextReplacement {
  originalText: string;
  newText: string;
}

interface EditPdfRequest {
  pdfBase64: string;
  replacements: TextReplacement[];
}

export async function POST(request: NextRequest) {
  try {
    const body: EditPdfRequest = await request.json();
    const { pdfBase64, replacements } = body;

    if (!pdfBase64 || !replacements || replacements.length === 0) {
      return NextResponse.json(
        { error: "Missing pdfBase64 or replacements" },
        { status: 400 }
      );
    }

    // Decode base64 PDF
    const pdfBytes = Buffer.from(pdfBase64, "base64");

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    // Get all pages
    const pages = pdfDoc.getPages();

    // Track if any replacements were made
    let replacementsMade = 0;

    // For each page, try to find and replace text in content streams
    for (const page of pages) {
      const content = await getPageTextContent(page);

      for (const replacement of replacements) {
        if (content.includes(replacement.originalText)) {
          // Found the text - attempt to replace in content stream
          const success = await replaceTextInPage(
            pdfDoc,
            page,
            replacement.originalText,
            replacement.newText
          );
          if (success) {
            replacementsMade++;
          }
        }
      }
    }

    // If no replacements could be made via content stream editing,
    // we'll use an overlay approach - add the new text on top
    if (replacementsMade === 0) {
      console.log("Content stream editing not successful, using overlay approach");
      // For now, return the original PDF with a flag indicating manual review needed
      const modifiedPdfBytes = await pdfDoc.save();
      return NextResponse.json({
        success: false,
        message: "Could not automatically apply changes. The PDF structure doesn't support direct text editing.",
        pdfBase64: Buffer.from(modifiedPdfBytes).toString("base64"),
        replacementsMade: 0,
      });
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();

    return NextResponse.json({
      success: true,
      pdfBase64: Buffer.from(modifiedPdfBytes).toString("base64"),
      replacementsMade,
    });
  } catch (error) {
    console.error("Edit PDF API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit PDF" },
      { status: 500 }
    );
  }
}

// Extract text content from a PDF page (simplified)
async function getPageTextContent(page: PDFPage): Promise<string> {
  // pdf-lib doesn't have built-in text extraction
  // This is a placeholder - in a real implementation, you'd parse the content stream
  // For now, we return empty to indicate we need the fallback approach
  return "";
}

// Attempt to replace text in a PDF page's content stream
async function replaceTextInPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  originalText: string,
  newText: string
): Promise<boolean> {
  // pdf-lib has limited support for editing existing text
  // Text in PDFs is stored as positioned glyphs, not as searchable strings
  // This would require parsing and modifying the content stream directly

  // For a production implementation, you would:
  // 1. Get the page's content stream
  // 2. Parse the stream to find text operations (Tj, TJ, etc.)
  // 3. Modify the text while preserving positioning
  // 4. Re-encode the content stream

  // This is complex because:
  // - Text may be split across multiple operations
  // - Font encoding affects how text is stored
  // - Positioning needs to be adjusted if text length changes

  // For now, return false to indicate we couldn't do the replacement
  return false;
}
