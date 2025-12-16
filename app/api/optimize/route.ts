import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";
import OpenAI from "openai";
import type { Suggestion, OptimizeResponse } from "@/lib/types";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Min text length before triggering OCR fallback
const MIN_TEXT_LENGTH = 100;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const resumePdf = formData.get("resumePdf") as File | null;
    const jobDescription = formData.get("jobDescription") as string | null;

    // Validation
    if (!resumePdf || !jobDescription) {
      return NextResponse.json(
        { error: "Missing resumePdf or jobDescription" },
        { status: 400 }
      );
    }

    if (resumePdf.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "PDF file exceeds 10MB limit" },
        { status: 400 }
      );
    }

    if (resumePdf.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const pdfBuffer = Buffer.from(await resumePdf.arrayBuffer());

    // Extract text from PDF
    let extractedText = "";
    let pageCount = 0;

    try {
      const pdfData = await pdf(pdfBuffer);
      extractedText = pdfData.text || "";
      pageCount = pdfData.numpages || 0;
    } catch (pdfError) {
      console.error("PDF parse error:", pdfError);
      // Continue with OCR fallback
    }

    // OCR fallback if text extraction yielded little/no text
    if (extractedText.trim().length < MIN_TEXT_LENGTH) {
      console.log("Text extraction insufficient, attempting OCR...");
      const ocrText = await performOCR(pdfBuffer);
      if (ocrText) {
        extractedText = ocrText;
      }
    }

    if (extractedText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "Could not extract sufficient text from PDF. Please ensure the PDF contains selectable text or try a different file.",
        },
        { status: 400 }
      );
    }

    // Call OpenAI for suggestions
    console.log("Calling generateSuggestions with text length:", extractedText.length);
    const suggestions = await generateSuggestions(extractedText, jobDescription);
    console.log("Got suggestions count:", suggestions.length);

    const response: OptimizeResponse = {
      suggestions,
      extractedText: extractedText.slice(0, 5000), // Truncate for response
      pageCount,
    };

    console.log("Returning response with", response.suggestions.length, "suggestions");
    return NextResponse.json(response);
  } catch (error) {
    console.error("Optimize API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function performOCR(pdfBuffer: Buffer): Promise<string | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY;

  if (!apiKey) {
    console.warn("OCR_SPACE_API_KEY not configured, skipping OCR");
    return null;
  }

  try {
    const formData = new FormData();
    const uint8Array = new Uint8Array(pdfBuffer);
    const blob = new Blob([uint8Array], { type: "application/pdf" });
    formData.append("file", blob, "resume.pdf");
    formData.append("apikey", apiKey);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("filetype", "PDF");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // More accurate engine

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OCR API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || "OCR processing failed");
    }

    // Combine text from all parsed results
    const text = data.ParsedResults?.map(
      (r: { ParsedText?: string }) => r.ParsedText || ""
    ).join("\n");

    return text || null;
  } catch (error) {
    console.error("OCR error:", error);
    return null;
  }
}

async function generateSuggestions(
  resumeText: string,
  jobDescription: string
): Promise<Suggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  console.log("generateSuggestions called, API key present:", !!apiKey, "Model:", model);

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured. Please add it to your .env.local file.");
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an expert CV/resume optimizer. Your task is to analyze a resume against a job description and provide specific, actionable suggestions to improve the resume's match with the job requirements.

For each suggestion:
1. Identify a specific phrase, sentence, or section that could be improved
2. Provide the exact replacement text
3. Explain why this change improves the match
4. Assess the risk level (low = minor wording change, medium = moderate content change, high = significant claim change)

Focus on:
- Keyword optimization (matching job description terminology)
- Quantifying achievements where possible
- Highlighting relevant skills and experience
- Improving action verbs
- Removing irrelevant information

IMPORTANT:
- Only suggest changes to text that actually exists in the resume
- Keep suggestions realistic and truthful (don't fabricate experience)
- Provide 5-10 high-impact suggestions

Respond with a JSON array of suggestions.`;

  const userPrompt = `RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jobDescription.slice(0, 4000)}

Analyze this resume against the job description and provide optimization suggestions.
Return a JSON object with a "suggestions" array containing 5-10 suggestions:
{
  "suggestions": [
    {
      "id": "suggestion-1",
      "section": "summary|experience|skills|education|other",
      "originalSnippet": "exact text from resume to change",
      "proposedText": "the improved replacement text",
      "reason": "why this improves the match",
      "riskLevel": "low|medium|high"
    },
    {
      "id": "suggestion-2",
      ...
    }
  ]
}

IMPORTANT: Always return multiple suggestions (5-10) in the suggestions array, not just one.`;

  console.log("Calling OpenAI API...");
  
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  console.log("OpenAI response received");
  
  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenAI");
  }
  
  console.log("OpenAI content length:", content.length);

  try {
    const parsed = JSON.parse(content);
    
    // Handle multiple response formats from OpenAI:
    // 1. Direct array: [{...}, {...}]
    // 2. Object with suggestions key: { suggestions: [{...}, {...}] }
    // 3. Single suggestion object: { id: "...", section: "...", ... }
    let suggestionsArray: Array<Omit<Suggestion, "status">>;
    
    if (Array.isArray(parsed)) {
      // Format 1: Direct array
      suggestionsArray = parsed;
    } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      // Format 2: Object with suggestions array
      suggestionsArray = parsed.suggestions;
    } else if (parsed.id && parsed.originalSnippet) {
      // Format 3: Single suggestion object - wrap in array
      suggestionsArray = [parsed];
    } else {
      // Try to find any array property
      const arrayProp = Object.values(parsed).find(v => Array.isArray(v));
      suggestionsArray = (arrayProp as Array<Omit<Suggestion, "status">>) || [];
    }

    console.log("Parsed suggestions count:", suggestionsArray.length);

    // Validate and add status to each suggestion
    const result = suggestionsArray.map((s: Omit<Suggestion, "status">, idx: number) => ({
      id: s.id || `suggestion-${idx + 1}`,
      section: s.section || "other",
      originalSnippet: s.originalSnippet || "",
      proposedText: s.proposedText || "",
      reason: s.reason || "",
      riskLevel: s.riskLevel || "medium",
      status: "pending" as const,
    }));
    
    console.log("Returning", result.length, "suggestions");
    return result;
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", content);
    throw new Error("Failed to parse AI suggestions");
  }
}

