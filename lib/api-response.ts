import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiResponseOptions {
  headers?: Record<string, string>;
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  options?: ApiResponseOptions,
): NextResponse {
  const payload =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? { success: true, ...(data as Record<string, any>), data }
      : { success: true, data };

  return NextResponse.json(payload, {
    status,
    headers: options?.headers,
  });
}

export function apiError(
  message: string,
  status = 400,
  details?: any,
  options?: ApiResponseOptions,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    {
      status,
      headers: options?.headers,
    },
  );
}

export function handleApiError(
  err: unknown,
  fallbackMessage = "Internal server error",
): NextResponse {
  if (err instanceof ZodError) {
    return apiError("Validation failed", 400, err.issues);
  }
  if (err instanceof Error) {
    return apiError(err.message, 400);
  }
  return apiError(fallbackMessage, 500);
}
