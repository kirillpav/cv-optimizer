"use client";

import * as React from "react";
import { UploadPanel } from "./UploadPanel";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { HtmlEditorPanel } from "./HtmlEditorPanel";
import { ExportPanel } from "./ExportPanel";
import type {
  Suggestion,
  SuggestionStatus,
  OptimizeResponse,
  AppStep,
  HtmlConversionResult,
} from "@/lib/types";

// Normalize text for matching - handles whitespace and common variations
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to regular
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, "-") // En-dash
    .replace(/\u2014/g, "-") // Em-dash
    .trim();
}

// Find and replace text with fuzzy matching
function replaceTextFuzzy(html: string, originalText: string, newText: string): string {
  // Normalize the search text
  const normalizedSearch = normalizeText(originalText);

  // Create a regex that's flexible with whitespace
  const escapedSearch = normalizedSearch
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+"); // Allow any whitespace between words

  try {
    const regex = new RegExp(escapedSearch, "gi");
    return html.replace(regex, newText);
  } catch {
    // Fallback to simple replace if regex fails
    return html.replace(originalText, newText);
  }
}

export function CvOptimizerPage() {
  const [step, setStep] = React.useState<AppStep>("upload");
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  // Data state
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = React.useState<Uint8Array | null>(null); // Store original PDF for export
  const [jobDescription, setJobDescription] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [extractedText, setExtractedText] = React.useState<string>(""); // Store extracted text for matching

  // HTML state for viewing/editing
  const [htmlContent, setHtmlContent] = React.useState<string>("");
  const [originalHtmlContent, setOriginalHtmlContent] = React.useState<string>("");
  const [htmlMetadata, setHtmlMetadata] = React.useState<HtmlConversionResult["metadata"] | null>(null);

  const handleUploadSubmit = async (file: File, jd: string) => {
    setIsLoading(true);
    setError(null);
    setPdfFile(file);
    setJobDescription(jd);

    // Store original PDF bytes for later export
    const arrayBuffer = await file.arrayBuffer();
    setPdfBytes(new Uint8Array(arrayBuffer));

    try {
      // Step 1: Convert PDF to HTML for viewing
      setStep("converting");
      setLoadingMessage("Converting PDF to HTML...");

      const pdfFormData = new FormData();
      pdfFormData.append("resumePdf", file);

      const htmlRes = await fetch("/api/pdf-to-html", {
        method: "POST",
        body: pdfFormData,
      });

      if (!htmlRes.ok) {
        const errData = await htmlRes.json().catch(() => ({}));
        throw new Error(errData.error || `PDF conversion failed: ${htmlRes.status}`);
      }

      const htmlData: HtmlConversionResult = await htmlRes.json();
      setHtmlContent(htmlData.html);
      setOriginalHtmlContent(htmlData.html);
      setHtmlMetadata(htmlData.metadata);
      setExtractedText(htmlData.extractedText); // Store for text matching

      // Step 2: Generate AI suggestions
      setLoadingMessage("Generating AI suggestions...");

      const optimizeFormData = new FormData();
      optimizeFormData.append("resumePdf", file);
      optimizeFormData.append("jobDescription", jd);

      const suggestRes = await fetch("/api/optimize", {
        method: "POST",
        body: optimizeFormData,
      });

      if (!suggestRes.ok) {
        const errData = await suggestRes.json().catch(() => ({}));
        throw new Error(errData.error || `Suggestion generation failed: ${suggestRes.status}`);
      }

      const suggestData: OptimizeResponse = await suggestRes.json();
      setSuggestions(suggestData.suggestions || []);

      setStep("editing");
    } catch (err) {
      console.error("Error in handleUploadSubmit:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setStep("upload");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleUpdateSuggestionStatus = (
    id: string,
    status: SuggestionStatus
  ) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const handleHtmlChange = (newHtml: string) => {
    setHtmlContent(newHtml);
  };

  const handleSuggestionAccept = (id: string, customText?: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    // Apply the change to HTML using fuzzy matching
    const replacement = customText || suggestion.proposedText;
    const updatedHtml = replaceTextFuzzy(htmlContent, suggestion.originalSnippet, replacement);
    setHtmlContent(updatedHtml);

    // Mark as accepted and store what was applied
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "accepted" as const, appliedText: replacement } : s))
    );
  };

  const handleSuggestionReject = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected" as const } : s))
    );
  };

  const handleApplySuggestion = (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (!suggestion) return;

    // Apply the change to HTML using fuzzy matching
    const updatedHtml = replaceTextFuzzy(htmlContent, suggestion.originalSnippet, suggestion.proposedText);
    setHtmlContent(updatedHtml);

    // Mark as accepted
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "accepted" as const } : s))
    );
  };

  const handleScrollToSuggestion = (id: string) => {
    // This would be handled by the HtmlEditorPanel
    console.log("Scroll to suggestion:", id);
  };

  const acceptedCount = suggestions.filter((s) => s.status === "accepted").length;
  const canExport = acceptedCount > 0 || htmlContent !== originalHtmlContent;

  const handleProceedToExport = () => {
    setStep("export");
  };

  const handleBackToEditing = () => {
    setStep("editing");
  };

  const handleStartOver = () => {
    setStep("upload");
    setPdfFile(null);
    setPdfBytes(null);
    setJobDescription("");
    setSuggestions([]);
    setHtmlContent("");
    setOriginalHtmlContent("");
    setHtmlMetadata(null);
    setExtractedText("");
    setError(null);
  };

  const stepLabels: Record<AppStep, string> = {
    upload: "Upload",
    converting: "Converting",
    editing: "Edit",
    generating: "Generating",
    export: "Export",
  };

  const stepOrder: AppStep[] = ["upload", "converting", "editing", "generating", "export"];
  const displaySteps: AppStep[] = ["upload", "editing", "export"];

  return (
    <div className="bg-background min-h-screen w-full">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-foreground mb-2 text-3xl font-bold tracking-tight">
            CV Optimizer
          </h1>
          <p className="text-muted-foreground">
            AI-powered resume optimization with inline editing
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {displaySteps.map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    step === s || (s === "editing" && (step === "converting" || step === "generating"))
                      ? "bg-primary text-primary-foreground"
                      : stepOrder.indexOf(step) > stepOrder.indexOf(s)
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < displaySteps.length - 1 && (
                  <div
                    className={`h-0.5 w-8 ${
                      stepOrder.indexOf(step) > stepOrder.indexOf(s)
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="text-muted-foreground mt-2 flex justify-center gap-8 text-xs">
            {displaySteps.map((s) => (
              <span key={s}>{stepLabels[s]}</span>
            ))}
          </div>
        </header>

        {/* Error display */}
        {error && (
          <div className="bg-destructive/10 text-destructive mx-auto mb-6 max-w-xl rounded-lg p-4 text-center">
            {error}
          </div>
        )}

        {/* Loading state for conversion */}
        {(step === "converting" || step === "generating") && isLoading && (
          <div className="mx-auto max-w-xl">
            <div className="bg-card rounded-lg border p-8 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* Main content */}
        {step === "upload" && (
          <div className="mx-auto max-w-2xl">
            <UploadPanel onSubmit={handleUploadSubmit} isLoading={isLoading} />
          </div>
        )}

        {step === "editing" && htmlContent && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <SuggestionsPanel
                suggestions={suggestions}
                onUpdateStatus={handleUpdateSuggestionStatus}
                onApplySuggestion={handleApplySuggestion}
                onScrollToSuggestion={handleScrollToSuggestion}
                extractedText={extractedText}
              />

              <div className="flex gap-2">
                {canExport && (
                  <button
                    onClick={handleProceedToExport}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 font-medium transition-colors"
                  >
                    Proceed to Export ({acceptedCount} changes)
                  </button>
                )}
                <button
                  onClick={handleStartOver}
                  className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-2 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>

            <HtmlEditorPanel
              html={htmlContent}
              suggestions={suggestions}
              onHtmlChange={handleHtmlChange}
              onSuggestionAccept={handleSuggestionAccept}
              onSuggestionReject={handleSuggestionReject}
              extractedText={extractedText}
            />
          </div>
        )}

        {step === "export" && pdfBytes && (
          <div className="mx-auto max-w-2xl">
            <ExportPanel
              pdfBytes={pdfBytes}
              suggestions={suggestions}
              onBack={handleBackToEditing}
              onStartOver={handleStartOver}
            />
          </div>
        )}
      </div>
    </div>
  );
}
