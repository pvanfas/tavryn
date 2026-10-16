import { NextResponse } from "next/server";

import {
  extractInvoiceData,
  extractTextFromPDFBuffer,
} from "@/lib/invoice-extraction";
import {
  detectRecurringSubscriptions,
  parseStatementCSV,
} from "@/lib/statement-detection";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface ProcessFileResult {
  success: boolean;
  type: string;
  source: string;
  detected: any[];
  fileName: string;
  transactionCount?: number;
  warning?: string;
  error?: string;
}

async function processSingleFile(file: File): Promise<ProcessFileResult> {
  // 1. Validate file size (Max 10 MB)
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      type: "unknown",
      source: "unknown",
      detected: [],
      fileName: file.name,
      error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };
  }

  // 2. Validate MIME type & file extension
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  const isCSV = fileName.endsWith(".csv") || fileType.includes("csv");
  const isPDF = fileName.endsWith(".pdf") || fileType.includes("pdf");
  const isImage =
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileType.startsWith("image/");

  if (!isCSV && !isPDF && !isImage) {
    return {
      success: false,
      type: "unknown",
      source: "unknown",
      detected: [],
      fileName: file.name,
      error: "Unsupported file type. Please upload a CSV statement, PDF invoice, or image (PNG/JPG).",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Process CSV
  if (isCSV) {
    const csvText = buffer.toString("utf-8");
    try {
      const transactions = parseStatementCSV(csvText);
      if (transactions.length === 0) {
        return {
          success: false,
          type: "statement",
          source: "statement-import",
          detected: [],
          fileName: file.name,
          error: "Could not parse transactions from CSV. Please check that it contains Date, Description, and Amount columns.",
        };
      }

      const detected = detectRecurringSubscriptions(transactions);
      return {
        success: true,
        type: "statement",
        source: "statement-import",
        detected,
        transactionCount: transactions.length,
        fileName: file.name,
        warning: detected.length === 0 ? "No recurring vendor charges detected." : undefined,
      };
    } catch (parseErr) {
      return {
        success: false,
        type: "statement",
        source: "statement-import",
        detected: [],
        fileName: file.name,
        error: (parseErr as Error).message,
      };
    }
  }

  // 4. Process PDF
  if (isPDF) {
    try {
      const extractedText = extractTextFromPDFBuffer(buffer);
      const invoiceItem = await extractInvoiceData(extractedText, file.name);

      return {
        success: true,
        type: "invoice",
        source: "invoice-import",
        detected: [invoiceItem],
        fileName: file.name,
      };
    } catch (pdfErr) {
      return {
        success: false,
        type: "invoice",
        source: "invoice-import",
        detected: [],
        fileName: file.name,
        error: (pdfErr as Error).message,
      };
    }
  }

  // 5. Process Image
  if (isImage) {
    try {
      const pseudoText = `Vendor Invoice Scan: ${file.name}\nImage Size: ${file.size} bytes\nData: image/jpeg`;
      const invoiceItem = await extractInvoiceData(pseudoText, file.name);

      return {
        success: true,
        type: "invoice",
        source: "invoice-import",
        detected: [invoiceItem],
        fileName: file.name,
      };
    } catch (imgErr) {
      return {
        success: false,
        type: "invoice",
        source: "invoice-import",
        detected: [],
        fileName: file.name,
        error: (imgErr as Error).message,
      };
    }
  }

  return {
    success: false,
    type: "unknown",
    source: "unknown",
    detected: [],
    fileName: file.name,
    error: "Unable to process file",
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    if (files.length === 0) {
      const single = formData.get("file") as File | null;
      if (single) files.push(single);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No file provided in form submission" },
        { status: 400 },
      );
    }

    // Single file execution (maintains identical shape for existing callers)
    if (files.length === 1) {
      const result = await processSingleFile(files[0]);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        type: result.type,
        source: result.source,
        detected: result.detected,
        fileName: result.fileName,
        transactionCount: result.transactionCount,
        warning: result.warning,
      });
    }

    // Multi-file batch execution
    const results = await Promise.allSettled(
      files.map((file) => processSingleFile(file)),
    );

    const allDetected: any[] = [];
    const fileSummaries = [];
    let hasSuccess = false;

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const originalFile = files[i];

      if (res.status === "fulfilled" && res.value.success) {
        hasSuccess = true;
        allDetected.push(...res.value.detected);
        fileSummaries.push({
          fileName: res.value.fileName,
          success: true,
          detectedCount: res.value.detected.length,
        });
      } else {
        const errorMsg =
          res.status === "fulfilled"
            ? res.value.error
            : (res.reason as Error)?.message || "Failed to parse";
        fileSummaries.push({
          fileName: originalFile.name,
          success: false,
          error: errorMsg,
        });
      }
    }

    if (!hasSuccess) {
      return NextResponse.json(
        {
          error: "None of the uploaded files could be parsed.",
          details: fileSummaries,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      type: "batch",
      source: "multi-file-import",
      detected: allDetected,
      fileCount: files.length,
      fileName: `${files.length} documents (${allDetected.length} contracts)`,
      files: fileSummaries,
    });
  } catch (err) {
    console.error("File import error:", err);
    return NextResponse.json(
      { error: "Failed to process file import: " + (err as Error).message },
      { status: 500 },
    );
  }
}
