import type { ApiErrorDTO } from "@raktdoot/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function apiError(error: unknown): Response {
  if (error instanceof ApiError) {
    const body: ApiErrorDTO = { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } };
    return json(body, error.status);
  }
  // Never log bodies, bearer tokens or ORM error strings which may contain personal data.
  console.error("API operation failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: { code: "INTERNAL_ERROR", message: "The operation could not be completed" } }, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json");
  }
  if (!request.body) throw new ApiError(400, "INVALID_JSON", "A JSON body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new ApiError(413, "BODY_TOO_LARGE", "Request body must be at most 16 KiB");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "INVALID_JSON", "Malformed JSON"); }
}