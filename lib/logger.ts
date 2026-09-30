// Sanitized structured logger: masks credentials, API keys, private keys, and JWTs

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /authorization/i,
  /private[-_]?key/i,
  /bearer/i,
];

const SECRET_VALUE_PATTERNS = [
  // Circle API Key format: TEST_API_KEY:...
  /TEST_API_KEY:[a-f0-9]+:[a-f0-9]+/gi,
  // 64-char hex strings (entity secrets / private keys)
  /\b[0-9a-f]{64}\b/gi,
  // JWT tokens (3 parts separated by dots)
  /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
];

function sanitizeString(str: string): string {
  let sanitized = str;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
  }
  return sanitized;
}

function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 6) return "[DEPTH_LIMIT]";
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(key));
    if (isSensitiveKey) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = sanitizeObject(value, depth + 1);
    }
  }
  return result;
}

export const logger = {
  info: (message: string, meta?: any) => {
    const cleanMsg = sanitizeString(message);
    if (meta !== undefined) {
      console.log(`[INFO] ${cleanMsg}`, JSON.stringify(sanitizeObject(meta)));
    } else {
      console.log(`[INFO] ${cleanMsg}`);
    }
  },
  warn: (message: string, meta?: any) => {
    const cleanMsg = sanitizeString(message);
    if (meta !== undefined) {
      console.warn(`[WARN] ${cleanMsg}`, JSON.stringify(sanitizeObject(meta)));
    } else {
      console.warn(`[WARN] ${cleanMsg}`);
    }
  },
  error: (message: string, meta?: any) => {
    const cleanMsg = sanitizeString(message);
    if (meta !== undefined) {
      console.error(
        `[ERROR] ${cleanMsg}`,
        JSON.stringify(sanitizeObject(meta)),
      );
    } else {
      console.error(`[ERROR] ${cleanMsg}`);
    }
  },
};
