import { isR2Configured, uploadR2Object } from "@/lib/image-markup/r2";
import { jsonWithCors, optionsWithCors } from "../../cors";

const maxDefaultUploadBytes = 12 * 1024 * 1024;

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return jsonWithCors({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid multipart upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonWithCors({ ok: false, error: "file is required." }, { status: 400 });
  }

  const maxBytes = Number(process.env.IMAGE_MARKUP_MAX_IMAGE_BYTES || maxDefaultUploadBytes);
  if (file.size > maxBytes) {
    return jsonWithCors({ ok: false, error: "Image payload is too large." }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = String(formData.get("filename") || file.name || "image.png");
    const result = await uploadR2Object({
      bytes,
      contentType: normalizeUploadContentType(String(formData.get("contentType") || file.type || ""), filename),
      filename,
      prefix: String(formData.get("prefix") || "image-markup"),
    });
    return jsonWithCors({ ok: true, ...result });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not upload image." },
      { status: 400 },
    );
  }
}

function normalizeUploadContentType(contentType: string, filename: string) {
  const normalized = contentType.toLowerCase();
  if (["image/png", "image/jpeg", "image/webp", "application/json"].includes(normalized)) {
    return normalized;
  }

  const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".json") return "application/json";
  return "image/png";
}
