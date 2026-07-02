import { createR2DownloadUrl, isR2Configured } from "@/lib/image-markup/r2";
import { jsonWithCors, optionsWithCors } from "../../cors";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return jsonWithCors({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }

  let payload: { key?: string; ttlSeconds?: number };
  try {
    payload = await request.json();
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.key) {
    return jsonWithCors({ ok: false, error: "key is required." }, { status: 400 });
  }

  try {
    const result = await createR2DownloadUrl({
      key: payload.key,
      ttlSeconds: payload.ttlSeconds,
    });
    return jsonWithCors({ ok: true, ...result });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not create download URL." },
      { status: 400 },
    );
  }
}
