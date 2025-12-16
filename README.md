# CV Optimizer

AI-powered resume optimization with tracked PDF edits. Upload your CV and a job description to get GPT-4 powered suggestions, then map each change to specific locations in your PDF and export an edited version with visible tracked changes.

## Features

- **PDF Upload & Text Extraction**: Supports text-based PDFs with OCR.Space fallback for scanned documents
- **AI-Powered Suggestions**: Uses GPT-4 to analyze your resume against job descriptions
- **Interactive PDF Mapping**: Click on text or draw rectangles to map suggestions to exact PDF locations
- **Tracked Edits**: Exported PDFs show visual tracked changes (highlights, strikethroughs, new text)
- **Change Log Export**: Download a JSON audit trail of all applied edits

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- OpenAI API key
- (Optional) OCR.Space API key for scanned PDF support

### Environment Setup

Create a `.env.local` file in the project root:

```bash
# Required
OPENAI_API_KEY=your-openai-api-key-here

# Optional: specify model (defaults to gpt-4o)
OPENAI_MODEL=gpt-4o

# Optional: for scanned/image PDF support
# Get a free API key at: https://ocr.space/ocrapi/freekey
OCR_SPACE_API_KEY=your-ocr-space-api-key-here
```

### Installation

```bash
bun install
# or
npm install
```

### Development

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Usage

1. **Upload**: Drop your CV (PDF, max 10MB) and paste the job description
2. **Review Suggestions**: Accept or reject AI suggestions based on relevance and risk level
3. **Map to PDF**: For accepted suggestions, click "Map to PDF" then either:
   - Click on text in the PDF viewer (for text-based PDFs)
   - Draw a rectangle around the target area (for scanned PDFs)
4. **Export**: Generate and download your optimized PDF with tracked edits, plus a JSON change log

## Technical Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: ShadCN components with Base UI
- **PDF Viewing**: react-pdf (PDF.js)
- **PDF Editing**: pdf-lib
- **Text Extraction**: pdf-parse + OCR.Space API
- **AI**: OpenAI GPT-4

## Limitations

- PDF size limit: 10MB
- Page limit: 5-10 pages recommended
- No layout reflow: edits are overlaid within bounding boxes
- Mixed/scanned PDFs require manual rectangle mapping for accuracy

## Deploy on Vercel

The easiest way to deploy is using the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
