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
} from "@hugeicons/core-free-icons";
import type { Suggestion, SuggestionStatus } from "@/lib/types";

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onUpdateStatus: (id: string, status: SuggestionStatus) => void;
  onSelectForMapping: (suggestion: Suggestion) => void;
  activeMappingId: string | null;
}

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusColors: Record<SuggestionStatus, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  accepted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  mapped: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function SuggestionsPanel({
  suggestions,
  onUpdateStatus,
  onSelectForMapping,
  activeMappingId,
}: SuggestionsPanelProps) {
  const acceptedCount = suggestions.filter(
    (s) => s.status === "accepted" || s.status === "mapped"
  ).length;
  const mappedCount = suggestions.filter((s) => s.status === "mapped").length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} size={24} />
          AI Suggestions
        </CardTitle>
        <CardDescription>
          Review each suggestion. Accept the ones you want to apply, then map
          them to specific locations in your PDF.
          <span className="mt-1 block text-xs">
            {acceptedCount} accepted · {mappedCount} mapped to PDF
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
                onSelectForMapping={onSelectForMapping}
                isActiveMapping={activeMappingId === suggestion.id}
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
  onSelectForMapping: (suggestion: Suggestion) => void;
  isActiveMapping: boolean;
}

function SuggestionCard({
  suggestion,
  onUpdateStatus,
  onSelectForMapping,
  isActiveMapping,
}: SuggestionCardProps) {
  const { id, section, originalSnippet, proposedText, reason, riskLevel, status } =
    suggestion;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isActiveMapping
          ? "border-primary ring-primary/20 ring-2"
          : status === "rejected"
            ? "border-muted bg-muted/30 opacity-60"
            : "border-border"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-xs">
          {section}
        </Badge>
        <Badge className={riskColors[riskLevel]}>Risk: {riskLevel}</Badge>
        <Badge className={statusColors[status]}>{status}</Badge>
      </div>

      <div className="mb-3 space-y-2">
        <div>
          <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase tracking-wide">
            Original
          </span>
          <p className="bg-destructive/10 text-destructive rounded px-2 py-1 text-sm line-through">
            {originalSnippet}
          </p>
        </div>
        <div className="flex items-center justify-center">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className="text-muted-foreground rotate-90"
          />
        </div>
        <div>
          <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase tracking-wide">
            Suggested
          </span>
          <p className="rounded bg-green-100 px-2 py-1 text-sm text-green-900 dark:bg-green-900/30 dark:text-green-200">
            {proposedText}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground mb-4 text-sm italic">{reason}</p>

      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            <Button
              size="sm"
              onClick={() => onUpdateStatus(id, "accepted")}
              variant="default"
            >
              <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateStatus(id, "rejected")}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Reject
            </Button>
          </>
        )}
        {status === "accepted" && (
          <>
            <Button
              size="sm"
              onClick={() => onSelectForMapping(suggestion)}
              variant={isActiveMapping ? "secondary" : "default"}
            >
              {isActiveMapping ? "Mapping..." : "Map to PDF"}
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
        {status === "mapped" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectForMapping(suggestion)}
          >
            Re-map location
          </Button>
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

