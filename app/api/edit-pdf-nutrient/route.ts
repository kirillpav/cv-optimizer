import { NextRequest, NextResponse } from "next/server";
import { load } from "@nutrient-sdk/node";

interface TextReplacement {
  originalText: string;
  newText: string;
}

interface EditPdfRequest {
  pdfBase64: string;
  replacements: TextReplacement[];
}

// Normalize text for fuzzy matching
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .toLowerCase()
    .trim();
}

// Check if two texts match (with normalization)
function textsMatch(blockText: string, searchText: string): boolean {
  const normalizedBlock = normalizeText(blockText);
  const normalizedSearch = normalizeText(searchText);

  // Exact match after normalization
  if (normalizedBlock === normalizedSearch) return true;

  // Check if block contains the search text
  if (normalizedBlock.includes(normalizedSearch)) return true;

  // Check if search text contains the block (for partial matches)
  if (normalizedSearch.includes(normalizedBlock) && normalizedBlock.length > 20) return true;

  return false;
}

// Find and apply text replacements
function findAndApplyReplacement(
  blockText: string,
  replacements: TextReplacement[]
): { newText: string; matched: boolean; matchedReplacement?: TextReplacement } {
  for (const replacement of replacements) {
    const normalizedBlock = normalizeText(blockText);
    const normalizedOriginal = normalizeText(replacement.originalText);

    // Check for exact match
    if (normalizedBlock === normalizedOriginal) {
      return { newText: replacement.newText, matched: true, matchedReplacement: replacement };
    }

    // Check if block contains the original text - do substring replacement
    if (normalizedBlock.includes(normalizedOriginal)) {
      // Try to find the original text in the block and replace it
      const lowerBlock = blockText.toLowerCase();
      const lowerOriginal = replacement.originalText.toLowerCase();
      const index = lowerBlock.indexOf(lowerOriginal);

      if (index !== -1) {
        // Replace while preserving the rest of the text
        const before = blockText.slice(0, index);
        const after = blockText.slice(index + replacement.originalText.length);
        return {
          newText: before + replacement.newText + after,
          matched: true,
          matchedReplacement: replacement
        };
      }
    }
  }

  return { newText: blockText, matched: false };
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
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Prepare license if available
    const licenseKey = process.env.NUTRIENT_LICENSE_KEY;
    const appName = process.env.NUTRIENT_APP_NAME || "match-cv";

    console.log("License key present:", !!licenseKey);
    console.log("License key prefix:", licenseKey ? licenseKey.slice(0, 10) + "..." : "none");
    console.log("App name:", appName);

    const loadOptions: { document: Buffer; license?: { key: string; appName: string } } = {
      document: pdfBuffer,
    };

    if (licenseKey) {
      loadOptions.license = {
        key: licenseKey,
        appName: appName,
      };
    }

    // Load the PDF with Nutrient
    console.log("Loading PDF with Nutrient SDK...");
    console.log("Load options has license:", !!loadOptions.license);
    const instance = await load(loadOptions);

    // Get document info
    const docInfo = instance.getDocumentInfo();
    const pageCount = docInfo.pageCount || 1;
    console.log(`Document has ${pageCount} pages`);

    // Start content editing session
    console.log("Starting content editing session...");
    const session = await instance.beginContentEditingSession();

    let totalReplacementsMade = 0;
    const appliedReplacements: string[] = [];
    const remainingReplacements = [...replacements];

    // Process each page
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      console.log(`Processing page ${pageIndex + 1}...`);

      // Get all text blocks on this page
      const textBlocks = await session.getTextBlocks(pageIndex);
      console.log(`Found ${textBlocks.length} text blocks on page ${pageIndex + 1}`);

      const updatedBlocks: Array<{ id: string; text: string }> = [];

      // Check each text block for matches
      for (const block of textBlocks) {
        const result = findAndApplyReplacement(block.text, remainingReplacements);

        if (result.matched && result.matchedReplacement) {
          console.log(`Found match in block: "${block.text.slice(0, 50)}..."`);
          console.log(`Replacing with: "${result.newText.slice(0, 50)}..."`);

          updatedBlocks.push({
            id: block.id,
            text: result.newText,
          });

          // Remove from remaining replacements to avoid duplicate matches
          const idx = remainingReplacements.indexOf(result.matchedReplacement);
          if (idx > -1) {
            remainingReplacements.splice(idx, 1);
          }

          appliedReplacements.push(result.matchedReplacement.originalText.slice(0, 50));
          totalReplacementsMade++;
        }
      }

      // Apply updates for this page
      if (updatedBlocks.length > 0) {
        console.log(`Updating ${updatedBlocks.length} text blocks on page ${pageIndex + 1}`);
        await session.updateTextBlocks(updatedBlocks);
      }
    }

    // Commit all changes
    if (totalReplacementsMade > 0) {
      console.log(`Committing ${totalReplacementsMade} changes...`);
      await session.commit();
    } else {
      console.log("No changes to commit, discarding session");
      await session.discard();
    }

    // Export the modified PDF
    console.log("Exporting PDF...");
    const modifiedPdfBuffer = await instance.exportPDF();

    // Close the instance
    await instance.close();

    if (!modifiedPdfBuffer) {
      throw new Error("Failed to export PDF");
    }

    // Convert ArrayBuffer to base64
    const modifiedPdfBase64 = Buffer.from(modifiedPdfBuffer).toString("base64");

    console.log(`Successfully applied ${totalReplacementsMade} replacements`);

    return NextResponse.json({
      success: totalReplacementsMade > 0,
      pdfBase64: modifiedPdfBase64,
      replacementsMade: totalReplacementsMade,
      appliedReplacements,
      notApplied: remainingReplacements.map(r => r.originalText.slice(0, 50)),
    });
  } catch (error) {
    console.error("Nutrient PDF edit error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("Error name:", error instanceof Error ? error.name : "Unknown");

    // Check for license errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("license") || errorMessage.includes("License") || errorMessage.includes("Content Editor")) {
      return NextResponse.json({
        error: `Nutrient license/feature error: ${errorMessage}. The Content Editor feature may not be included in your license. Get a trial at https://www.nutrient.io/try/`,
        licenseRequired: true,
        details: errorMessage,
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
