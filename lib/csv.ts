import {
  SubscriptionRow,
  SubscriptionRowSchema,
  ValidatedSubscriptionRow,
} from "./schemas";

/**
 * Standard CSV line parser handling quotes and escaped characters
 */
export function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Parses full CSV text and validates each row against SubscriptionRowSchema
 */
export function parseAndValidateSubscriptionsCSV(csvText: string): {
  rows: ValidatedSubscriptionRow[];
  validCount: number;
  invalidCount: number;
  headers: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], validCount: 0, invalidCount: 0, headers: [] };
  }

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[\s_-]+/g, "_"),
  );

  const rows: ValidatedSubscriptionRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let idx = 1; idx < lines.length; idx++) {
    const values = parseCSVLine(lines[idx]);
    const rawRecord: Record<string, string> = {};

    headers.forEach((header, hIdx) => {
      rawRecord[header] = values[hIdx] !== undefined ? values[hIdx] : "";
    });

    // Prepare coerced object for zod
    const candidateObj: Record<string, unknown> = {
      vendor: rawRecord.vendor,
      service: rawRecord.service,
      category: rawRecord.category?.toLowerCase(),
      annual_price:
        rawRecord.annual_price !== ""
          ? Number(rawRecord.annual_price)
          : undefined,
      renewal_date: rawRecord.renewal_date,
      seats:
        rawRecord.seats !== "" && rawRecord.seats !== undefined
          ? Number(rawRecord.seats)
          : null,
      active_seats:
        rawRecord.active_seats !== "" && rawRecord.active_seats !== undefined
          ? Number(rawRecord.active_seats)
          : null,
      usage_decline_pct:
        rawRecord.usage_decline_pct !== "" &&
        rawRecord.usage_decline_pct !== undefined
          ? Number(rawRecord.usage_decline_pct)
          : null,
    };

    const parseResult = SubscriptionRowSchema.safeParse(candidateObj);

    if (parseResult.success) {
      rows.push({
        id: `row-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        raw: rawRecord,
        parsed: parseResult.data,
        isValid: true,
        errors: {},
      });
      validCount++;
    } else {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldName = (issue.path[0] as string) || "general";
        fieldErrors[fieldName] = issue.message;
      });

      rows.push({
        id: `row-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        raw: rawRecord,
        isValid: false,
        errors: fieldErrors,
      });
      invalidCount++;
    }
  }

  return { rows, validCount, invalidCount, headers };
}

/**
 * Validates a single manual subscription entry
 */
export function validateSingleSubscription(input: Record<string, unknown>): {
  isValid: boolean;
  parsed?: SubscriptionRow;
  errors: Record<string, string>;
} {
  const result = SubscriptionRowSchema.safeParse(input);
  if (result.success) {
    return { isValid: true, parsed: result.data, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const fieldName = (issue.path[0] as string) || "general";
    errors[fieldName] = issue.message;
  });

  return { isValid: false, errors };
}
