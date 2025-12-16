// Types for CV Optimizer application

export type RiskLevel = "low" | "medium" | "high";
export type EditMode = "replace" | "insert" | "delete";
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "mapped";

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
}

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

