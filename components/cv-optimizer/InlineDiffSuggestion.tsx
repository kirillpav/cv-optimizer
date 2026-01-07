"use client";

import * as React from "react";
import { diffWords } from "diff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick01Icon,
  Cancel01Icon,
  PencilEdit01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { Suggestion, RiskLevel } from "@/lib/types";

interface InlineDiffSuggestionProps {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
  onEdit?: (newText: string) => void;
  onClose?: () => void;
  position?: { x: number; y: number };
  className?: string;
}

const riskColors: Record<RiskLevel, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function InlineDiffSuggestion({
  suggestion,
  onAccept,
  onReject,
  onEdit,
  onClose,
  position,
  className,
}: InlineDiffSuggestionProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(suggestion.proposedText);
  const popupRef = React.useRef<HTMLDivElement>(null);

  // Close on escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && onClose) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleAccept = () => {
    if (isEditing && onEdit) {
      onEdit(editValue);
    }
    onAccept();
  };

  return (
    <div
      ref={popupRef}
      className={cn(
        "z-50 w-96 rounded-lg border bg-white shadow-lg dark:bg-gray-900",
        position ? "fixed" : "relative",
        className
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge className={riskColors[suggestion.riskLevel]}>
            {suggestion.riskLevel} risk
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {suggestion.section}
          </Badge>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Original text */}
        <div>
          <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase tracking-wide">
            Current text
          </span>
          <div className="rounded bg-red-50 p-2 dark:bg-red-950/30">
            <p className="text-sm text-red-900 dark:text-red-200 line-through">
              {suggestion.originalSnippet}
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="text-muted-foreground"
            size={20}
          />
        </div>

        {/* Proposed text / Edit mode */}
        <div>
          <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase tracking-wide">
            Suggested change
          </span>
          {isEditing ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
          ) : (
            <div className="rounded bg-green-50 p-2 dark:bg-green-950/30">
              <WordDiff
                original={suggestion.originalSnippet}
                proposed={suggestion.proposedText}
              />
            </div>
          )}
        </div>

        {/* Reason */}
        <p className="text-muted-foreground text-xs italic border-l-2 border-muted pl-2">
          {suggestion.reason}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t px-4 py-3">
        <Button size="sm" onClick={handleAccept} className="flex-1">
          <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} size={16} />
          {isEditing ? "Apply Edit" : "Accept"}
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} size={16} />
          Reject
        </Button>
        {!isEditing && onEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

// Word-level diff visualization
interface WordDiffProps {
  original: string;
  proposed: string;
}

function WordDiff({ original, proposed }: WordDiffProps) {
  const diffs = diffWords(original, proposed);

  return (
    <p className="text-sm">
      {diffs.map((part, i) => (
        <span
          key={i}
          className={cn(
            part.added && "bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100",
            part.removed && "bg-red-200 text-red-900 line-through dark:bg-red-800 dark:text-red-100",
            !part.added && !part.removed && "text-gray-700 dark:text-gray-300"
          )}
        >
          {part.value}
        </span>
      ))}
    </p>
  );
}

// Compact inline version for displaying in the suggestions list
interface InlineDiffPreviewProps {
  original: string;
  proposed: string;
}

export function InlineDiffPreview({ original, proposed }: InlineDiffPreviewProps) {
  return <WordDiff original={original} proposed={proposed} />;
}
