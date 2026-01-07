import puppeteer, { Browser, Page } from "puppeteer";

export interface HtmlToPdfOptions {
  format?: "A4" | "Letter";
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  scale?: number;
}

const DEFAULT_OPTIONS: HtmlToPdfOptions = {
  format: "A4",
  margin: {
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
  },
  printBackground: true,
  scale: 1,
};

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Serverless environment (Vercel)
    // Try to use @sparticuz/chromium for production
    try {
      const chromium = await import("@sparticuz/chromium");
      const execPath = await chromium.default.executablePath();

      browserInstance = await puppeteer.launch({
        args: chromium.default.args,
        executablePath: execPath,
        headless: true,
      });
    } catch (err) {
      console.warn("Failed to load @sparticuz/chromium, falling back to regular puppeteer:", err);
      // Fall back to regular puppeteer
      browserInstance = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
    }
  } else {
    // Development environment - use local Chrome
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }

  return browserInstance;
}

export async function convertHtmlToPdf(
  html: string,
  css?: string,
  options: HtmlToPdfOptions = {}
): Promise<Buffer> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Inject additional CSS if provided
    let fullHtml = html;
    if (css) {
      fullHtml = html.replace("</head>", `<style>${css}</style></head>`);
    }

    await page.setContent(fullHtml, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Set viewport to match PDF dimensions
    const viewportWidth = mergedOptions.format === "Letter" ? 816 : 794; // 8.5" or 210mm at 96dpi
    const viewportHeight = mergedOptions.format === "Letter" ? 1056 : 1123; // 11" or 297mm at 96dpi

    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 2, // Higher quality
    });

    const pdfBuffer = await page.pdf({
      format: mergedOptions.format,
      margin: mergedOptions.margin,
      printBackground: mergedOptions.printBackground,
      scale: mergedOptions.scale,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// Clean up browser on process exit
if (typeof process !== "undefined") {
  process.on("exit", async () => {
    if (browserInstance) {
      await browserInstance.close();
    }
  });
}

// Export for testing
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
