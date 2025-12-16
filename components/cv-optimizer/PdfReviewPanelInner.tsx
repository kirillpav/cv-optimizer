"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  AddIcon,
  RemoveIcon,
  Cursor01Icon,
  AddSquareIcon,
} from "@hugeicons/core-free-icons";
import type { Suggestion, AppliedEdit, BoundingBox } from "@/lib/types";

// Set up PDF.js worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfReviewPanelInnerProps {
  pdfBytes: Uint8Array;
  activeSuggestion: Suggestion | null;
  appliedEdits: AppliedEdit[];
  onMappingComplete: (edit: AppliedEdit) => void;
  onCancelMapping: () => void;
}

type MappingMode = "text" | "rectangle";

export function PdfReviewPanelInner({
  pdfBytes,
  activeSuggestion,
  appliedEdits,
  onMappingComplete,
  onCancelMapping,
}: PdfReviewPanelInnerProps) {
  const [numPages, setNumPages] = React.useState<number>(0);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [scale, setScale] = React.useState<number>(1.2);
  const [mappingMode, setMappingMode] = React.useState<MappingMode>("text");

  // Rectangle drawing state
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [drawStart, setDrawStart] = React.useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = React.useState<{ x: number; y: number } | null>(null);

  const pageContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Store the PDF file object in state - this creates a stable reference
  const [pdfFile, setPdfFile] = React.useState<{ data: ArrayBuffer } | null>(null);
  const [pdfKey, setPdfKey] = React.useState<number>(0);
  
  // Create a stable copy of PDF data when pdfBytes changes
  React.useEffect(() => {
    if (!pdfBytes || pdfBytes.length === 0) {
      setPdfFile(null);
      return;
    }
    
    // Create a completely independent copy as ArrayBuffer
    // This ensures the data is never detached and is compatible with pdf.js
    const buffer = new ArrayBuffer(pdfBytes.length);
    const view = new Uint8Array(buffer);
    view.set(pdfBytes);
    
    setPdfFile({ data: buffer });
    setPdfKey(prev => prev + 1); // Force Document remount with new data
  }, [pdfBytes]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };
  
  const onDocumentLoadError = (error: Error) => {
    console.error("PDF Document load error:", error);
  };

  const handleTextClick = (e: React.MouseEvent) => {
    if (!activeSuggestion || mappingMode !== "text") return;

    const target = e.target as HTMLElement;

    // Check if we clicked on a text layer span
    if (
      target.closest(".react-pdf__Page__textContent") &&
      target.tagName === "SPAN"
    ) {
      const rect = target.getBoundingClientRect();
      const container = pageContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      // Convert to PDF coordinates (relative to page, accounting for scale)
      const bbox: BoundingBox = {
        x: (rect.left - containerRect.left) / scale,
        y: (rect.top - containerRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      };

      const edit: AppliedEdit = {
        suggestionId: activeSuggestion.id,
        pageIndex: currentPage - 1,
        bbox,
        mode: "replace",
        originalText: target.textContent || "",
        newText: activeSuggestion.proposedText,
      };

      onMappingComplete(edit);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeSuggestion || mappingMode !== "rectangle") return;

    const container = pageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;

    const container = pageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent || !activeSuggestion) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    // Calculate bbox from drawn rectangle
    const minX = Math.min(drawStart.x, drawCurrent.x);
    const minY = Math.min(drawStart.y, drawCurrent.y);
    const maxX = Math.max(drawStart.x, drawCurrent.x);
    const maxY = Math.max(drawStart.y, drawCurrent.y);

    const width = maxX - minX;
    const height = maxY - minY;

    // Only create edit if rectangle is meaningful size
    if (width > 10 && height > 10) {
      const bbox: BoundingBox = {
        x: minX / scale,
        y: minY / scale,
        width: width / scale,
        height: height / scale,
      };

      const edit: AppliedEdit = {
        suggestionId: activeSuggestion.id,
        pageIndex: currentPage - 1,
        bbox,
        mode: "replace",
        originalText: activeSuggestion.originalSnippet,
        newText: activeSuggestion.proposedText,
      };

      onMappingComplete(edit);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  // Get edits for current page for overlay display
  const currentPageEdits = appliedEdits.filter(
    (e) => e.pageIndex === currentPage - 1
  );

  // Calculate drawing rectangle dimensions
  const getDrawingRect = () => {
    if (!drawStart || !drawCurrent) return null;
    return {
      left: Math.min(drawStart.x, drawCurrent.x),
      top: Math.min(drawStart.y, drawCurrent.y),
      width: Math.abs(drawCurrent.x - drawStart.x),
      height: Math.abs(drawCurrent.y - drawStart.y),
    };
  };

  const drawingRect = getDrawingRect();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle>PDF Preview</CardTitle>
        <CardDescription>
          {activeSuggestion ? (
            <span className="text-primary font-medium">
              {mappingMode === "text"
                ? "Click on the text you want to replace"
                : "Draw a rectangle around the area to edit"}
            </span>
          ) : (
            "Select a suggestion to map it to a location"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            >
              <HugeiconsIcon icon={RemoveIcon} strokeWidth={2} />
            </Button>
            <span className="w-16 text-center text-sm">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(2, s + 0.2))}
            >
              <HugeiconsIcon icon={AddIcon} strokeWidth={2} />
            </Button>
          </div>

          {activeSuggestion && (
            <div className="flex items-center gap-2">
              <Button
                variant={mappingMode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setMappingMode("text")}
              >
                <HugeiconsIcon icon={Cursor01Icon} strokeWidth={2} />
                Text
              </Button>
              <Button
                variant={mappingMode === "rectangle" ? "default" : "outline"}
                size="sm"
                onClick={() => setMappingMode("rectangle")}
              >
                <HugeiconsIcon icon={AddSquareIcon} strokeWidth={2} />
                Draw
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelMapping}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* PDF Viewer */}
        <div className="border-border relative overflow-auto rounded-lg border bg-gray-100 dark:bg-gray-900">
          <div
            ref={pageContainerRef}
            className={`relative inline-block ${
              activeSuggestion
                ? mappingMode === "text"
                  ? "cursor-crosshair"
                  : "cursor-cell"
                : ""
            }`}
            onClick={handleTextClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {pdfFile && (
              <Document
                key={`pdf-doc-${pdfKey}`}
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex h-[600px] w-full items-center justify-center">
                    <span className="text-muted-foreground">Loading PDF...</span>
                  </div>
                }
                error={
                  <div className="flex h-[600px] w-full items-center justify-center">
                    <span className="text-destructive">Failed to load PDF</span>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            )}

            {/* Overlay: existing mapped edits */}
            {currentPageEdits.map((edit) => (
              <div
                key={edit.suggestionId}
                className="pointer-events-none absolute border-2 border-green-500 bg-green-500/20"
                style={{
                  left: edit.bbox.x * scale,
                  top: edit.bbox.y * scale,
                  width: edit.bbox.width * scale,
                  height: edit.bbox.height * scale,
                }}
              >
                <span className="absolute -top-5 left-0 rounded bg-green-600 px-1 text-xs text-white">
                  Mapped
                </span>
              </div>
            ))}

            {/* Drawing rectangle preview */}
            {isDrawing && drawingRect && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-500/20"
                style={{
                  left: drawingRect.left,
                  top: drawingRect.top,
                  width: drawingRect.width,
                  height: drawingRect.height,
                }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

