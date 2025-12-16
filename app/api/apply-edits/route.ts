import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { ChangeSet, AppliedEdit } from "@/lib/types";

// Max file size: 15MB
const MAX_FILE_SIZE = 15 * 1024 * 1024;

// Text color (black, like original resume text)
const TEXT_COLOR = rgb(0, 0, 0);
const COVER_COLOR = rgb(1, 1, 1); // White background

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const resumePdf = formData.get("resumePdf") as File | null;
    const changeSetJson = formData.get("changeSet") as string | null;

    // Validation
    if (!resumePdf || !changeSetJson) {
      return NextResponse.json(
        { error: "Missing resumePdf or changeSet" },
        { status: 400 }
      );
    }

    if (resumePdf.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "PDF file exceeds 15MB limit" },
        { status: 400 }
      );
    }

    let changeSet: ChangeSet;
    try {
      changeSet = JSON.parse(changeSetJson);
    } catch {
      return NextResponse.json(
        { error: "Invalid changeSet JSON" },
        { status: 400 }
      );
    }

    if (!changeSet.appliedEdits || changeSet.appliedEdits.length === 0) {
      return NextResponse.json(
        { error: "No edits to apply" },
        { status: 400 }
      );
    }

    // Load PDF
    const pdfBuffer = await resumePdf.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Embed standard fonts - Helvetica is close to Arial/Calibri used in many resumes
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    const pages = pdfDoc.getPages();

    // Apply each edit
    for (const edit of changeSet.appliedEdits) {
      if (edit.pageIndex < 0 || edit.pageIndex >= pages.length) {
        console.warn(`Skipping edit: page ${edit.pageIndex} out of range`);
        continue;
      }

      const page = pages[edit.pageIndex];
      const { height: pageHeight } = page.getSize();

      // The bbox is in screen coordinates (top-left origin)
      // PDF coordinates use bottom-left origin, so we need to flip Y
      const pdfY = pageHeight - edit.bbox.y - edit.bbox.height;

      applyInPlaceEdit(page, edit, pdfY, helvetica);
    }

    // Add metadata about the changes
    pdfDoc.setTitle(`Optimized Resume - ${new Date().toLocaleDateString()}`);
    pdfDoc.setSubject(`Applied ${changeSet.appliedEdits.length} optimizations`);
    pdfDoc.setCreator("CV Optimizer");

    // Save and return
    const modifiedPdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(modifiedPdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="optimized-resume.pdf"',
      },
    });
  } catch (error) {
    console.error("Apply edits error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function applyInPlaceEdit(
  page: PDFPage,
  edit: AppliedEdit,
  pdfY: number,
  font: PDFFont
) {
  const { bbox, newText } = edit;

  // 1. Cover the original text with a white rectangle
  // Add small padding to ensure complete coverage
  const padding = 1;
  page.drawRectangle({
    x: bbox.x - padding,
    y: pdfY - padding,
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2,
    color: COVER_COLOR,
  });

  // 2. Calculate font size to fit the text in the same space
  // Estimate based on the original bbox height (typical line height is ~1.2x font size)
  const estimatedFontSize = Math.min(bbox.height * 0.85, 12);
  const fontSize = fitTextToWidth(newText, bbox.width, font, estimatedFontSize);

  // 3. Draw the replacement text at the same position
  // Baseline is typically at the bottom of the bbox, adjusted for descenders
  const baselineY = pdfY + (bbox.height - fontSize) / 2 + fontSize * 0.2;

  // Check if text needs to wrap
  const textWidth = font.widthOfTextAtSize(newText, fontSize);
  
  if (textWidth <= bbox.width) {
    // Single line - draw directly
    page.drawText(newText, {
      x: bbox.x,
      y: baselineY,
      size: fontSize,
      font: font,
      color: TEXT_COLOR,
    });
  } else {
    // Multi-line - wrap and draw
    const lines = wrapText(newText, bbox.width, font, fontSize);
    const lineHeight = fontSize * 1.15;
    
    lines.forEach((line, index) => {
      const lineY = pdfY + bbox.height - fontSize - (index * lineHeight);
      if (lineY > pdfY - fontSize) {
        page.drawText(line, {
          x: bbox.x,
          y: lineY,
          size: fontSize,
          font: font,
          color: TEXT_COLOR,
        });
      }
    });
  }
}

function fitTextToWidth(
  text: string,
  maxWidth: number,
  font: PDFFont,
  startSize: number
): number {
  // For multi-word text, we'll allow wrapping, so just ensure reasonable size
  const words = text.split(" ");
  if (words.length > 3) {
    // Long text will wrap, use the start size
    return Math.max(startSize, 8);
  }
  
  // For short text, try to fit on one line
  let fontSize = startSize;
  const minSize = 6;
  
  while (fontSize > minSize) {
    const width = font.widthOfTextAtSize(text, fontSize);
    if (width <= maxWidth) {
      return fontSize;
    }
    fontSize -= 0.5;
  }
  
  return minSize;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
