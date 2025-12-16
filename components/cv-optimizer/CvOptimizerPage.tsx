"use client";

import * as React from "react";
import { UploadPanel } from "./UploadPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { PdfReviewPanel } from "./PdfReviewPanel";
import { ExportPanel } from "./ExportPanel";
import type {
  Suggestion,
  SuggestionStatus,
  AppliedEdit,
  OptimizeResponse,
} from "@/lib/types";

type AppStep = "upload" | "review" | "export";

export function CvOptimizerPage() {
  const [step, setStep] = React.useState<AppStep>("upload");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Data state
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = React.useState<Uint8Array | null>(null);
  const [jobDescription, setJobDescription] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [appliedEdits, setAppliedEdits] = React.useState<AppliedEdit[]>([]);
  const [activeMappingSuggestion, setActiveMappingSuggestion] =
    React.useState<Suggestion | null>(null);

  const handleUploadSubmit = async (file: File, jd: string) => {
    setIsLoading(true);
    setError(null);
    setPdfFile(file);
    setJobDescription(jd);

    // Read file bytes for PDF viewer
    // Convert to Uint8Array immediately to avoid detached ArrayBuffer issues
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    setPdfBytes(uint8Array);

    try {
      const formData = new FormData();
      formData.append("resumePdf", file);
      formData.append("jobDescription", jd);

      console.log("Sending request to /api/optimize...");
      const res = await fetch("/api/optimize", {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", res.status);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("API error response:", errData);
        throw new Error(errData.error || `Request failed: ${res.status}`);
      }

      const data: OptimizeResponse = await res.json();
      console.log("Received response data:", data);
      console.log("Suggestions count:", data.suggestions?.length || 0);
      console.log("First suggestion:", data.suggestions?.[0]);
      setSuggestions(data.suggestions || []);
      setStep("review");
    } catch (err) {
      console.error("Error in handleUploadSubmit:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSuggestionStatus = (
    id: string,
    status: SuggestionStatus
  ) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );

    // If rejecting, remove any applied edit for this suggestion
    if (status === "rejected") {
      setAppliedEdits((prev) => prev.filter((e) => e.suggestionId !== id));
    }
  };

  const handleSelectForMapping = (suggestion: Suggestion) => {
    setActiveMappingSuggestion(suggestion);
  };

  const handleMappingComplete = (edit: AppliedEdit) => {
    // Update or add the edit
    setAppliedEdits((prev) => {
      const existing = prev.findIndex(
        (e) => e.suggestionId === edit.suggestionId
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = edit;
        return updated;
      }
      return [...prev, edit];
    });

    // Mark suggestion as mapped
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === edit.suggestionId ? { ...s, status: "mapped" as const } : s
      )
    );

    setActiveMappingSuggestion(null);
  };

  const handleCancelMapping = () => {
    setActiveMappingSuggestion(null);
  };

  const mappedCount = suggestions.filter((s) => s.status === "mapped").length;
  const canExport = mappedCount > 0;

  const handleProceedToExport = () => {
    setStep("export");
  };

  const handleBackToReview = () => {
    setStep("review");
  };

  const handleStartOver = () => {
    setStep("upload");
    setPdfFile(null);
    setPdfBytes(null);
    setJobDescription("");
    setSuggestions([]);
    setAppliedEdits([]);
    setActiveMappingSuggestion(null);
    setError(null);
  };

  return (
    <div className="bg-background min-h-screen w-full">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-foreground mb-2 text-3xl font-bold tracking-tight">
            CV Optimizer
          </h1>
          <p className="text-muted-foreground">
            AI-powered resume optimization with tracked PDF edits
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {(["upload", "review", "export"] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : ["upload", "review", "export"].indexOf(step) > i
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`h-0.5 w-8 ${
                      ["upload", "review", "export"].indexOf(step) > i
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="text-muted-foreground mt-2 flex justify-center gap-8 text-xs">
            <span>Upload</span>
            <span>Review</span>
            <span>Export</span>
          </div>
        </header>

        {/* Error display */}
        {error && (
          <div className="bg-destructive/10 text-destructive mx-auto mb-6 max-w-xl rounded-lg p-4 text-center">
            {error}
          </div>
        )}

        {/* Main content */}
        {step === "upload" && (
          <div className="mx-auto max-w-2xl">
            <UploadPanel onSubmit={handleUploadSubmit} isLoading={isLoading} />
          </div>
        )}

        {step === "review" && pdfBytes && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <SuggestionsPanel
                suggestions={suggestions}
                onUpdateStatus={handleUpdateSuggestionStatus}
                onSelectForMapping={handleSelectForMapping}
                activeMappingId={activeMappingSuggestion?.id ?? null}
              />

              {canExport && (
                <div className="flex gap-2">
                  <button
                    onClick={handleProceedToExport}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 font-medium transition-colors"
                  >
                    Proceed to Export ({mappedCount} edits)
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-2 transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              )}
            </div>

            <PdfReviewPanel
              pdfBytes={pdfBytes}
              activeSuggestion={activeMappingSuggestion}
              appliedEdits={appliedEdits}
              onMappingComplete={handleMappingComplete}
              onCancelMapping={handleCancelMapping}
            />
          </div>
        )}

        {step === "export" && pdfFile && (
          <div className="mx-auto max-w-2xl">
            <ExportPanel
              pdfFile={pdfFile}
              appliedEdits={appliedEdits}
              jobDescription={jobDescription}
              onBack={handleBackToReview}
              onStartOver={handleStartOver}
            />
          </div>
        )}
      </div>
    </div>
  );
}

