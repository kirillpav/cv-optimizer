import pdf from "pdf-parse";

export interface TextElement {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
}

export interface PageData {
  pageNumber: number;
  textContent: string;
}

export interface PdfToHtmlResult {
  html: string;
  css: string;
  extractedText: string;
  pageCount: number;
  pages: PageData[];
  metadata: {
    width: number;
    height: number;
    fonts: string[];
  };
}

export async function convertPdfToHtml(pdfBuffer: ArrayBuffer): Promise<PdfToHtmlResult> {
  const buffer = Buffer.from(pdfBuffer);
  const pdfData = await pdf(buffer);

  const extractedText = pdfData.text || "";
  const pageCount = pdfData.numpages || 1;

  // Split text into paragraphs for better HTML structure
  const paragraphs = extractedText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Create pages array - since pdf-parse doesn't give us per-page text easily,
  // we'll treat the whole document as one page for now
  const pages: PageData[] = [
    {
      pageNumber: 1,
      textContent: extractedText,
    },
  ];

  // Generate CSS
  const css = generateCss();

  // Generate HTML
  const html = generateHtml(paragraphs, css);

  return {
    html,
    css,
    extractedText,
    pageCount,
    pages,
    metadata: {
      width: 612, // Letter width in points
      height: 792, // Letter height in points
      fonts: ["Arial", "Helvetica", "sans-serif"],
    },
  };
}

function generateCss(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.5;
      color: #000;
      background: #fff;
    }
    .cv-document {
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.75in;
      background: #fff;
      min-height: 11in;
    }
    .cv-paragraph {
      margin-bottom: 0.75em;
      text-align: left;
    }
    .cv-paragraph:first-child {
      font-size: 1.25em;
      font-weight: bold;
      margin-bottom: 0.5em;
    }
    .suggestion-marker {
      background-color: rgba(255, 235, 59, 0.4);
      cursor: pointer;
      border-radius: 2px;
      transition: background-color 0.2s;
    }
    .suggestion-marker:hover {
      background-color: rgba(255, 235, 59, 0.7);
    }
    .suggestion-applied {
      background-color: rgba(76, 175, 80, 0.3);
      border-radius: 2px;
    }
    @media print {
      .cv-document {
        padding: 0;
        margin: 0;
      }
    }
  `;
}

function generateHtml(paragraphs: string[], css: string): string {
  const paragraphsHtml = paragraphs
    .map((p) => {
      const escapedText = escapeHtml(p);
      // Preserve line breaks within paragraphs
      const withBreaks = escapedText.replace(/\n/g, "<br>");
      return `<p class="cv-paragraph">${withBreaks}</p>`;
    })
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV Document</title>
  <style>${css}</style>
</head>
<body>
  <div class="cv-document">
    ${paragraphsHtml}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Utility function to find text in the HTML and wrap it with suggestion markers
export function injectSuggestionMarkers(
  html: string,
  suggestions: Array<{ id: string; originalSnippet: string }>
): string {
  let result = html;

  for (const suggestion of suggestions) {
    const escapedSnippet = escapeHtml(suggestion.originalSnippet);

    // Escape regex special characters
    const regexSafe = escapedSnippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Find and wrap the text
    const regex = new RegExp(`(${regexSafe})`, "gi");

    result = result.replace(regex, (match) => {
      return `<mark class="suggestion-marker" data-suggestion-id="${suggestion.id}">${match}</mark>`;
    });
  }

  return result;
}

// Apply a suggestion by replacing text in the HTML
export function applySuggestionToHtml(
  html: string,
  suggestionId: string,
  newText: string
): string {
  const markerRegex = new RegExp(
    `<mark[^>]*data-suggestion-id="${suggestionId}"[^>]*>([^<]*)</mark>`,
    "gi"
  );

  return html.replace(markerRegex, () => {
    const escapedNewText = escapeHtml(newText);
    return `<span class="suggestion-applied">${escapedNewText}</span>`;
  });
}
