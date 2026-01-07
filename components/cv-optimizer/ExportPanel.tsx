"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DownloadIcon,
  ArrowLeft01Icon,
  RefreshIcon,
  File01Icon,
  FileExportIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import type { Suggestion } from "@/lib/types";

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface ExportPanelProps {
  pdfBytes: Uint8Array;
  htmlContent: string;
  suggestions: Suggestion[];
  onBack: () => void;
  onStartOver: () => void;
}

export function ExportPanel({
  pdfBytes,
  htmlContent,
  suggestions,
  onBack,
  onStartOver,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportedPdfUrl, setExportedPdfUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [exportMethod, setExportMethod] = React.useState<"edited" | "original">("edited");

  const acceptedSuggestions = suggestions.filter((s) => s.status === "accepted");
  const rejectedSuggestions = suggestions.filter((s) => s.status === "rejected");
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  const handleExportEdited = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // Prepare replacements
      const replacements = acceptedSuggestions.map((s) => ({
        originalText: s.originalSnippet,
        newText: s.proposedText,
      }));

      // Try Nutrient SDK first (preserves original PDF format)
      console.log("Attempting PDF edit with Nutrient SDK...");
      const nutrientRes = await fetch("/api/edit-pdf-nutrient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: uint8ArrayToBase64(pdfBytes),
          replacements,
        }),
      });

      if (nutrientRes.ok) {
        const nutrientData = await nutrientRes.json();
        if (nutrientData.success && nutrientData.replacementsMade > 0) {
          // Successfully edited the original PDF with format preserved!
          console.log(`Nutrient: Applied ${nutrientData.replacementsMade} replacements`);
          const pdfBlob = base64ToBlob(nutrientData.pdfBase64, "application/pdf");
          const url = URL.createObjectURL(pdfBlob);
          setExportedPdfUrl(url);
          return;
        } else if (nutrientData.pdfBase64) {
          // Nutrient processed but couldn't match text - still return the PDF
          console.log("Nutrient: No text matches found, returning original PDF");
          const pdfBlob = base64ToBlob(nutrientData.pdfBase64, "application/pdf");
          const url = URL.createObjectURL(pdfBlob);
          setExportedPdfUrl(url);
          setError("Some changes could not be applied automatically. The exported PDF may not include all edits.");
          return;
        }
      } else {
        const nutrientError = await nutrientRes.json().catch(() => ({}));
        console.log("Nutrient API response status:", nutrientRes.status);
        console.log("Nutrient API error:", JSON.stringify(nutrientError, null, 2));

        if (nutrientError.licenseRequired) {
          console.log("Nutrient license/feature required, falling back to HTML export");
          console.log("Details:", nutrientError.details);
        } else {
          console.log("Nutrient error:", nutrientError.error);
          console.log("Nutrient error details:", nutrientError.details);
        }
      }

      // Fallback: Generate from HTML (doesn't preserve original format)
      console.log("Falling back to HTML-to-PDF generation");
      const res = await fetch("/api/html-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlContent,
          options: {
            format: "Letter",
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setExportedPdfUrl(url);

      // Warn user that format wasn't preserved
      setError("Note: Original PDF format could not be preserved. The exported PDF uses a simplified layout. To preserve the original format, add a Nutrient license key.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadOriginal = () => {
    // Create a new ArrayBuffer from the Uint8Array to avoid TypeScript issues
    const arrayBuffer = new ArrayBuffer(pdfBytes.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(pdfBytes);
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `original-resume-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!exportedPdfUrl) return;

    const link = document.createElement("a");
    link.href = exportedPdfUrl;
    link.download = `optimized-resume-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadChangeLog = () => {
    const changeLog = {
      timestamp: new Date().toISOString(),
      appliedChanges: acceptedSuggestions.map((s) => ({
        section: s.section,
        original: s.originalSnippet,
        replacement: s.proposedText,
        reason: s.reason,
      })),
      rejectedChanges: rejectedSuggestions.map((s) => ({
        section: s.section,
        original: s.originalSnippet,
        suggested: s.proposedText,
        reason: s.reason,
      })),
      pendingChanges: pendingSuggestions.map((s) => ({
        section: s.section,
        original: s.originalSnippet,
        suggested: s.proposedText,
        reason: s.reason,
      })),
    };

    const blob = new Blob([JSON.stringify(changeLog, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `change-log-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} size={24} />
          Export Optimized CV
        </CardTitle>
        <CardDescription>
          Generate your optimized CV as a PDF and download it
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="mb-3 font-medium">Changes Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Applied changes:</span>
              <span className="font-medium text-green-600">
                {acceptedSuggestions.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rejected:</span>
              <span className="font-medium text-red-500">
                {rejectedSuggestions.length}
              </span>
            </div>
            {pendingSuggestions.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Not reviewed:</span>
                <span className="font-medium text-yellow-600">
                  {pendingSuggestions.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Applied changes list */}
        {acceptedSuggestions.length > 0 && (
          <div>
            <h3 className="mb-3 font-medium">Applied Changes</h3>
            <div className="max-h-[300px] space-y-2 overflow-auto">
              {acceptedSuggestions.map((suggestion, idx) => (
                <div
                  key={suggestion.id}
                  className="border-green-200 dark:border-green-800 rounded border bg-green-50/50 p-3 dark:bg-green-950/30"
                >
                  <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                    <HugeiconsIcon
                      icon={Tick01Icon}
                      strokeWidth={2}
                      size={14}
                      className="text-green-600"
                    />
                    Change #{idx + 1} · {suggestion.section}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">From:</span>
                      <span className="text-destructive line-through">
                        {suggestion.originalSnippet.slice(0, 80)}
                        {suggestion.originalSnippet.length > 80 ? "..." : ""}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">To:</span>
                      <span className="text-green-600 dark:text-green-400">
                        {suggestion.proposedText.slice(0, 80)}
                        {suggestion.proposedText.length > 80 ? "..." : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {!exportedPdfUrl ? (
            <div className="space-y-3">
              <Button
                onClick={handleExportEdited}
                disabled={isExporting}
                className="w-full"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                    Generate Edited PDF
                  </>
                )}
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                Generates a PDF with your accepted changes applied
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-100 dark:bg-green-900/30 flex items-center gap-3 rounded-lg p-4">
                <HugeiconsIcon
                  icon={File01Icon}
                  strokeWidth={2}
                  size={32}
                  className="text-green-600"
                />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    PDF Ready!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your optimized CV is ready to download
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={handleDownloadPdf} size="lg">
                  <HugeiconsIcon icon={DownloadIcon} strokeWidth={2} />
                  Download Edited PDF
                </Button>
                <Button
                  onClick={handleDownloadChangeLog}
                  variant="outline"
                  size="lg"
                >
                  <HugeiconsIcon icon={DownloadIcon} strokeWidth={2} />
                  Download Change Log
                </Button>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs">Other options:</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadOriginal}>
                <HugeiconsIcon icon={DownloadIcon} strokeWidth={2} />
                Download Original PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={onBack}>
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                Back to Editing
              </Button>
              <Button variant="ghost" size="sm" onClick={onStartOver}>
                Start Over
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
