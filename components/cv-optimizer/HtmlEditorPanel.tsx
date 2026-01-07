"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  PlusSignIcon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";
import { InlineDiffSuggestion } from "./InlineDiffSuggestion";
import type { Suggestion } from "@/lib/types";

interface HtmlEditorPanelProps {
  html: string;
  suggestions: Suggestion[];
  onHtmlChange: (html: string) => void;
  onSuggestionAccept: (id: string, newText?: string) => void;
  onSuggestionReject: (id: string) => void;
  extractedText?: string;
}

// Normalize text for matching - handles whitespace and common variations
function normalizeText(text: string): string {
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
}

// Strip HTML tags from text for plain text matching
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Create a flexible regex for matching text with whitespace and HTML variations
function createFlexibleRegex(text: string): RegExp | null {
  try {
    const normalized = normalizeText(text);
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return null;

    // Allow whitespace, <br> tags, or HTML entities between words
    const pattern = words
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(?:\\s*(?:<br\\s*/?>)?\\s*|[\\s\\n]+)");

    return new RegExp(`(${pattern})`, "gi");
  } catch {
    return null;
  }
}

// Check if text can be found in HTML using multiple methods
function canFindTextInHtml(html: string, searchText: string): boolean {
  // Method 1: Try regex
  const regex = createFlexibleRegex(searchText);
  if (regex && regex.test(html)) return true;

  // Method 2: Try plain text comparison
  const plainHtml = stripHtmlTags(html);
  const normalizedHtml = normalizeText(plainHtml);
  const normalizedSearch = normalizeText(searchText);

  return normalizedHtml.toLowerCase().includes(normalizedSearch.toLowerCase());
}

export function HtmlEditorPanel({
  html,
  suggestions,
  onHtmlChange,
  onSuggestionAccept,
  onSuggestionReject,
  extractedText,
}: HtmlEditorPanelProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = React.useState(0.8);
  const [activeSuggestion, setActiveSuggestion] = React.useState<Suggestion | null>(null);
  const [popupPosition, setPopupPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [processedHtml, setProcessedHtml] = React.useState<string>("");

  // Process HTML to inject suggestion markers
  React.useEffect(() => {
    if (!html) {
      setProcessedHtml("");
      return;
    }

    let result = html;
    const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

    // Inject markers for pending suggestions
    for (const suggestion of pendingSuggestions) {
      const regex = createFlexibleRegex(suggestion.originalSnippet);
      if (!regex) continue;

      // Check if this text exists in the HTML
      if (regex.test(result)) {
        // Reset regex after test
        regex.lastIndex = 0;
        result = result.replace(regex, (match) => {
          return `<mark class="suggestion-marker" data-suggestion-id="${suggestion.id}" style="background-color: rgba(255, 235, 59, 0.5); cursor: pointer; border-radius: 2px; padding: 1px 2px;">${match}</mark>`;
        });
      }
    }

    // Highlight accepted suggestions with green
    const acceptedSuggestions = suggestions.filter((s) => s.status === "accepted");
    for (const suggestion of acceptedSuggestions) {
      const regex = createFlexibleRegex(suggestion.proposedText);
      if (!regex) continue;

      if (regex.test(result)) {
        regex.lastIndex = 0;
        result = result.replace(regex, (match) => {
          // Only wrap if not already wrapped
          if (!match.includes('class="suggestion-applied"')) {
            return `<mark class="suggestion-applied" style="background-color: rgba(76, 175, 80, 0.3); border-radius: 2px; padding: 1px 2px;">${match}</mark>`;
          }
          return match;
        });
      }
    }

    setProcessedHtml(result);
  }, [html, suggestions]);

  // Set up iframe content and click handlers
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !processedHtml) return;

    const setupIframe = () => {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      // Write the HTML content
      iframeDoc.open();
      iframeDoc.write(processedHtml);
      iframeDoc.close();

      // Add click handlers to suggestion markers
      const markers = iframeDoc.querySelectorAll(".suggestion-marker");
      markers.forEach((marker) => {
        (marker as HTMLElement).style.cursor = "pointer";

        marker.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const suggestionId = (marker as HTMLElement).dataset.suggestionId;
          const suggestion = suggestions.find((s) => s.id === suggestionId);

          if (suggestion) {
            const rect = (marker as HTMLElement).getBoundingClientRect();
            const iframeRect = iframe.getBoundingClientRect();

            // Position popup near the clicked marker, accounting for scroll
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const scrollX = window.scrollX || document.documentElement.scrollLeft;

            setPopupPosition({
              x: Math.min(iframeRect.left + scrollX + rect.left * scale, window.innerWidth - 420),
              y: iframeRect.top + scrollY + (rect.bottom * scale) + 8,
            });
            setActiveSuggestion(suggestion);
          }
        });

        // Hover effects
        marker.addEventListener("mouseenter", () => {
          (marker as HTMLElement).style.backgroundColor = "rgba(255, 235, 59, 0.8)";
        });
        marker.addEventListener("mouseleave", () => {
          (marker as HTMLElement).style.backgroundColor = "rgba(255, 235, 59, 0.5)";
        });
      });
    };

    // Small delay to ensure iframe is ready
    const timer = setTimeout(setupIframe, 50);
    return () => clearTimeout(timer);
  }, [processedHtml, suggestions, scale]);

  const handleAccept = (newText?: string) => {
    if (activeSuggestion) {
      onSuggestionAccept(activeSuggestion.id, newText);
      setActiveSuggestion(null);
      setPopupPosition(null);
    }
  };

  const handleReject = () => {
    if (activeSuggestion) {
      onSuggestionReject(activeSuggestion.id);
      setActiveSuggestion(null);
      setPopupPosition(null);
    }
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 2));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.3));

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const acceptedCount = suggestions.filter((s) => s.status === "accepted").length;

  // Count how many suggestions can be found in the text
  const foundCount = React.useMemo(() => {
    if (!html) return 0;
    return suggestions.filter((s) => {
      if (s.status !== "pending") return false;
      return canFindTextInHtml(html, s.originalSnippet);
    }).length;
  }, [html, suggestions]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} size={20} />
            CV Editor
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {foundCount}/{pendingCount} found · {acceptedCount} applied
            </span>
            <div className="flex items-center gap-1 border-l pl-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={scale <= 0.3}
              >
                <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} size={16} />
              </Button>
              <span className="text-muted-foreground w-12 text-center text-xs">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={scale >= 2}
              >
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} size={16} />
              </Button>
            </div>
          </div>
        </div>
        {foundCount > 0 && (
          <p className="text-muted-foreground text-xs">
            Click on highlighted text to review suggestions
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-auto bg-gray-100 dark:bg-gray-900">
          <div
            className="mx-auto my-4 origin-top"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            <iframe
              ref={iframeRef}
              className="bg-white shadow-lg"
              style={{
                width: "8.5in",
                minHeight: "11in",
                border: "none",
              }}
              title="CV Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </CardContent>

      {/* Inline diff popup */}
      {activeSuggestion && popupPosition && (
        <InlineDiffSuggestion
          suggestion={activeSuggestion}
          position={popupPosition}
          onAccept={() => handleAccept()}
          onReject={handleReject}
          onEdit={(newText) => handleAccept(newText)}
          onClose={() => {
            setActiveSuggestion(null);
            setPopupPosition(null);
          }}
        />
      )}
    </Card>
  );
}
