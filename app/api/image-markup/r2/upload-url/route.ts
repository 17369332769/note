import { createR2UploadUrl, isR2Configured } from "@/lib/image-markup/r2";
import { jsonWithCors, optionsWithCors } from "../../cors";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return jsonWithCors({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }

  let payload: { contentType?: string; filename?: string; prefix?: string; ttlSeconds?: number };
  try {
    payload = await request.json();
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.contentType) {
    return jsonWithCors({ ok: false, error: "contentType is required." }, { status: 400 });
  }

  try {
    const result = await createR2UploadUrl({
      contentType: payload.contentType,
      filename: payload.filename,
      prefix: payload.prefix,
      ttlSeconds: payload.ttlSeconds,
    });
    return jsonWithCors({ ok: true, ...result });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not create upload URL." },
      { status: 400 },
    );
  }
}
