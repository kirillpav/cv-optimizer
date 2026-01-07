// Types for CV Optimizer application

export type RiskLevel = "low" | "medium" | "high";
export type EditMode = "replace" | "insert" | "delete";
export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Suggestion {
  id: string;
  section: string;
  originalSnippet: string;
  proposedText: string;
  reason: string;
  riskLevel: RiskLevel;
  status: SuggestionStatus;
  // New fields for HTML-based editing
  textContext?: {
    before: string;
    after: string;
  };
  confidence?: number;
}

// Legacy types - kept for backwards compatibility
export interface AppliedEdit {
  suggestionId: string;
  pageIndex: number;
  bbox: BoundingBox;
  mode: EditMode;
  originalText: string;
  newText: string;
}

export interface ChangeSet {
  appliedEdits: AppliedEdit[];
  timestamp: string;
  jobDescriptionPreview: string;
}

export interface OptimizeResponse {
  suggestions: Suggestion[];
  extractedText: string;
  pageCount: number;
}

export interface ApplyEditsRequest {
  changeSet: ChangeSet;
}

// New types for HTML-based editing workflow

export interface HtmlConversionResult {
  html: string;
  css: string;
  extractedText: string;
  pageCount: number;
  metadata: {
    width: number;
    height: number;
    fonts: string[];
  };
}

export interface HtmlToPdfRequest {
  html: string;
  css?: string;
  options?: {
    format?: "A4" | "Letter";
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  };
}

export type AppStep = "upload" | "converting" | "editing" | "generating" | "export";

