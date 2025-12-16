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
} from "@hugeicons/core-free-icons";
import type { AppliedEdit, ChangeSet } from "@/lib/types";

interface ExportPanelProps {
  pdfFile: File;
  appliedEdits: AppliedEdit[];
  jobDescription: string;
  onBack: () => void;
  onStartOver: () => void;
}

export function ExportPanel({
  pdfFile,
  appliedEdits,
  jobDescription,
  onBack,
  onStartOver,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportedPdfUrl, setExportedPdfUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const changeSet: ChangeSet = React.useMemo(
    () => ({
      appliedEdits,
      timestamp: new Date().toISOString(),
      jobDescriptionPreview: jobDescription.slice(0, 200) + "...",
    }),
    [appliedEdits, jobDescription]
  );

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("resumePdf", pdfFile);
      formData.append("changeSet", JSON.stringify(changeSet));

      const res = await fetch("/api/apply-edits", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setExportedPdfUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!exportedPdfUrl) return;

    const link = document.createElement("a");
    link.href = exportedPdfUrl;
    link.download = `optimized-${pdfFile.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadChangeSet = () => {
    const blob = new Blob([JSON.stringify(changeSet, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `changeset-${Date.now()}.json`;
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
          Export Edited PDF
        </CardTitle>
        <CardDescription>
          Generate your optimized PDF with tracked changes and download it
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="mb-3 font-medium">Edit Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total edits:</span>
              <span className="font-medium">{appliedEdits.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pages affected:</span>
              <span className="font-medium">
                {new Set(appliedEdits.map((e) => e.pageIndex)).size}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original file:</span>
              <span className="font-medium">{pdfFile.name}</span>
            </div>
          </div>
        </div>

        {/* Edits list */}
        <div>
          <h3 className="mb-3 font-medium">Changes to Apply</h3>
          <div className="max-h-[300px] space-y-2 overflow-auto">
            {appliedEdits.map((edit, idx) => (
              <div
                key={edit.suggestionId}
                className="border-border rounded border p-3"
              >
                <div className="text-muted-foreground mb-1 text-xs">
                  Edit #{idx + 1} · Page {edit.pageIndex + 1}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">From:</span>
                    <span className="text-destructive line-through">
                      {edit.originalText.slice(0, 80)}
                      {edit.originalText.length > 80 ? "..." : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">To:</span>
                    <span className="text-green-600 dark:text-green-400">
                      {edit.newText.slice(0, 80)}
                      {edit.newText.length > 80 ? "..." : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {!exportedPdfUrl ? (
            <Button
              onClick={handleExport}
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
                  Download PDF
                </Button>
                <Button
                  onClick={handleDownloadChangeSet}
                  variant="outline"
                  size="lg"
                >
                  <HugeiconsIcon icon={DownloadIcon} strokeWidth={2} />
                  Download Change Log
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              Back to Review
            </Button>
            <Button variant="ghost" onClick={onStartOver}>
              Start Over
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

