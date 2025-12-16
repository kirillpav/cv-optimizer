"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  UploadCircle01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

interface UploadPanelProps {
  onSubmit: (pdfFile: File, jobDescription: string) => void;
  isLoading: boolean;
}

export function UploadPanel({ onSubmit, isLoading }: UploadPanelProps) {
  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [jobDescription, setJobDescription] = React.useState("");
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setPdfFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setPdfFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pdfFile && jobDescription.trim()) {
      onSubmit(pdfFile, jobDescription);
    }
  };

  const clearFile = () => {
    setPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={UploadCircle01Icon} strokeWidth={2} size={24} />
          Upload & Analyze
        </CardTitle>
        <CardDescription>
          Upload your CV (PDF) and paste the job description to get AI-powered
          optimization suggestions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Resume PDF</FieldLabel>
              <div
                className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : pdfFile
                      ? "border-green-500 bg-green-500/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {pdfFile ? (
                  <div className="flex flex-col items-center gap-2 p-4">
                    <HugeiconsIcon
                      icon={File01Icon}
                      strokeWidth={2}
                      size={32}
                      className="text-green-600"
                    />
                    <span className="text-sm font-medium">{pdfFile.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      className="mt-1"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-4">
                    <HugeiconsIcon
                      icon={UploadCircle01Icon}
                      strokeWidth={2}
                      size={32}
                      className="text-muted-foreground"
                    />
                    <span className="text-sm font-medium">
                      Drop your PDF here or click to browse
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Max 10MB, PDF files only
                    </span>
                  </div>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="job-description">Job Description</FieldLabel>
              <Textarea
                id="job-description"
                placeholder="Paste the full job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[200px] resize-y"
                required
              />
            </Field>

            <Field orientation="horizontal">
              <Button
                type="submit"
                disabled={!pdfFile || !jobDescription.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze & Get Suggestions"
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

