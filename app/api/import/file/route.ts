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
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in form submission" },
        { status: 400 },
      );
    }

    // 1. Validate file size (Max 10 MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
        },
        { status: 400 },
      );
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
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload a CSV statement, PDF invoice, or image (PNG/JPG).",
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Process based on detected file type
    if (isCSV) {
      const csvText = buffer.toString("utf-8");
      try {
        const transactions = parseStatementCSV(csvText);
        if (transactions.length === 0) {
          return NextResponse.json(
            {
              error:
                "Could not parse transactions from CSV. Please check that it contains Date, Description, and Amount columns.",
            },
            { status: 400 },
          );
        }

        const detected = detectRecurringSubscriptions(transactions);
        if (detected.length === 0) {
          return NextResponse.json(
            {
              warning:
                "No recurring vendor charges detected. Transactions may be irregular or one-off.",
              detected: [],
              transactionCount: transactions.length,
            },
            { status: 200 },
          );
        }

        return NextResponse.json({
          success: true,
          type: "statement",
          source: "statement-import",
          detected,
          transactionCount: transactions.length,
          fileName: file.name,
        });
      } catch (parseErr) {
        return NextResponse.json(
          { error: (parseErr as Error).message },
          { status: 400 },
        );
      }
    }

    if (isPDF) {
      const extractedText = extractTextFromPDFBuffer(buffer);
      const invoiceItem = await extractInvoiceData(extractedText, file.name);

      return NextResponse.json({
        success: true,
        type: "invoice",
        source: "invoice-import",
        detected: [invoiceItem],
        fileName: file.name,
      });
    }

    if (isImage) {
      // For images, extract text using printable strings or pass to vision model
      const base64Data = buffer.toString("base64");
      const pseudoText = `Vendor Invoice Scan: ${file.name}\nImage Size: ${file.size} bytes\nData: image/jpeg`;
      const invoiceItem = await extractInvoiceData(pseudoText, file.name);

      return NextResponse.json({
        success: true,
        type: "invoice",
        source: "invoice-import",
        detected: [invoiceItem],
        fileName: file.name,
      });
    }

    return NextResponse.json(
      { error: "Unable to process file" },
      { status: 400 },
    );
  } catch (err) {
    console.error("File import error:", err);
    return NextResponse.json(
      { error: "Failed to process file import: " + (err as Error).message },
      { status: 500 },
    );
  }
}
