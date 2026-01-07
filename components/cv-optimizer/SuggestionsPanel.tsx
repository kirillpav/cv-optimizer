"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick01Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  SparklesIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { InlineDiffPreview } from "./InlineDiffSuggestion";
import type { Suggestion, SuggestionStatus } from "@/lib/types";

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onUpdateStatus: (id: string, status: SuggestionStatus) => void;
  onApplySuggestion: (id: string) => void;
  onScrollToSuggestion: (id: string) => void;
  extractedText?: string;
  htmlContent?: string;
}

// Check if text can be found in HTML using multiple methods
function canFindTextInHtml(html: string, searchText: string): boolean {
  // Normalize text for matching
  const normalizeText = (text: string): string => {
    return text
      .replace(/\s+/g, " ")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2013/g, "-")
      .replace(/\u2014/g, "-")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  };

  // Strip HTML tags
  const stripHtmlTags = (htmlStr: string): string => {
    return htmlStr
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Try regex match
  try {
    const normalized = normalizeText(searchText);
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return false;

    const pattern = words
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(?:\\s*(?:<br\\s*/?>)?\\s*|[\\s\\n]+)");

    const regex = new RegExp(pattern, "gi");
    if (regex.test(html)) return true;
  } catch {
    // Ignore regex errors
  }

  // Try plain text comparison
  const plainHtml = stripHtmlTags(html);
  const normalizedHtml = normalizeText(plainHtml);
  const normalizedSearch = normalizeText(searchText);

  return normalizedHtml.toLowerCase().includes(normalizedSearch.toLowerCase());
}

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusColors: Record<SuggestionStatus, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function SuggestionsPanel({
  suggestions,
  onUpdateStatus,
  onApplySuggestion,
  onScrollToSuggestion,
  extractedText,
  htmlContent,
}: SuggestionsPanelProps) {
  const acceptedCount = suggestions.filter((s) => s.status === "accepted").length;
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  // Count how many pending suggestions can be found
  const foundCount = React.useMemo(() => {
    if (!htmlContent) return pendingCount;
    return suggestions.filter((s) => {
      if (s.status !== "pending") return false;
      return canFindTextInHtml(htmlContent, s.originalSnippet);
    }).length;
  }, [htmlContent, suggestions, pendingCount]);

  const notFoundCount = pendingCount - foundCount;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} size={24} />
          AI Suggestions
        </CardTitle>
        <CardDescription>
          Review each suggestion and apply the ones you want to include in your CV.
          <span className="mt-1 block text-xs">
            {pendingCount} pending · {acceptedCount} applied
            {notFoundCount > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400"> · {notFoundCount} not found in document</span>
            )}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
            <HugeiconsIcon
              icon={SparklesIcon}
              strokeWidth={2}
              size={48}
              className="mb-4 opacity-30"
            />
            <p>No suggestions yet.</p>
            <p className="text-sm">Upload your CV and job description first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onUpdateStatus={onUpdateStatus}
                onApplySuggestion={onApplySuggestion}
                onScrollToSuggestion={onScrollToSuggestion}
                htmlContent={htmlContent}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onUpdateStatus: (id: string, status: SuggestionStatus) => void;
  onApplySuggestion: (id: string) => void;
  onScrollToSuggestion: (id: string) => void;
  htmlContent?: string;
}

function SuggestionCard({
  suggestion,
  onUpdateStatus,
  onApplySuggestion,
  onScrollToSuggestion,
  htmlContent,
}: SuggestionCardProps) {
  const {
    id,
    section,
    originalSnippet,
    proposedText,
    reason,
    riskLevel,
    status,
  } = suggestion;

  // Check if this suggestion's text can be found in the HTML
  const canBeApplied = React.useMemo(() => {
    if (!htmlContent || status !== "pending") return true;
    return canFindTextInHtml(htmlContent, originalSnippet);
  }, [htmlContent, originalSnippet, status]);

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        status === "accepted"
          ? "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30"
          : status === "rejected"
          ? "border-muted bg-muted/30 opacity-60"
          : !canBeApplied
          ? "border-yellow-300 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20"
          : "border-border"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">
          {section}
        </Badge>
        <Badge className={riskColors[riskLevel]}>Risk: {riskLevel}</Badge>
        <Badge className={statusColors[status]}>{status}</Badge>
        {!canBeApplied && status === "pending" && (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Text not found
          </Badge>
        )}
      </div>

      <div className="mb-3 space-y-2">
        <div>
          <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase tracking-wide">
            Change Preview
          </span>
          <div className="rounded bg-gray-50 px-2 py-1 dark:bg-gray-900/50">
            <InlineDiffPreview original={originalSnippet} proposed={proposedText} />
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mb-4 text-sm italic">{reason}</p>

      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            <Button
              size="sm"
              onClick={() => onApplySuggestion(id)}
              variant="default"
              disabled={!canBeApplied}
              title={!canBeApplied ? "This text could not be found in the document" : undefined}
            >
              <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} />
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onScrollToSuggestion(id)}
              disabled={!canBeApplied}
            >
              <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
              View in CV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUpdateStatus(id, "rejected")}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Reject
            </Button>
          </>
        )}
        {status === "pending" && !canBeApplied && (
          <p className="text-muted-foreground w-full text-xs">
            The original text could not be matched in the document. This may happen if the text spans multiple lines or contains special formatting.
          </p>
        )}
        {status === "accepted" && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="text-green-600" />
            Applied to CV
          </div>
        )}
        {status === "rejected" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onUpdateStatus(id, "pending")}
          >
            Restore
          </Button>
        )}
      </div>
    </div>
  );
}
