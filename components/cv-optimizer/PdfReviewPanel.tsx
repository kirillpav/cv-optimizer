"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Suggestion, AppliedEdit } from "@/lib/types";

// Dynamically import the PDF viewer without SSR to avoid DOMMatrix errors
const PdfReviewPanelInner = dynamic(
  () =>
    import("./PdfReviewPanelInner").then((mod) => mod.PdfReviewPanelInner),
  {
    ssr: false,
    loading: () => (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle>PDF Preview</CardTitle>
          <CardDescription>Loading PDF viewer...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border flex h-[600px] items-center justify-center rounded-lg border bg-gray-100 dark:bg-gray-900">
            <span className="text-muted-foreground animate-pulse">
              Initializing PDF viewer...
            </span>
          </div>
        </CardContent>
      </Card>
    ),
  }
);

interface PdfReviewPanelProps {
  pdfBytes: Uint8Array;
  activeSuggestion: Suggestion | null;
  appliedEdits: AppliedEdit[];
  onMappingComplete: (edit: AppliedEdit) => void;
  onCancelMapping: () => void;
}

export function PdfReviewPanel(props: PdfReviewPanelProps) {
  return <PdfReviewPanelInner {...props} />;
}
