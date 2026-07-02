import { getR2Object, isR2Configured } from "@/lib/image-markup/r2";
import { corsHeaders, jsonWithCors, optionsWithCors } from "../../cors";

export function OPTIONS() {
  return optionsWithCors();
}

export async function GET(request: Request) {
  if (!isR2Configured()) {
    return jsonWithCors({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return jsonWithCors({ ok: false, error: "key is required." }, { status: 400 });
  }

  try {
    const object = await getR2Object({ key });
    const body = object.bytes.buffer.slice(
      object.bytes.byteOffset,
      object.bytes.byteOffset + object.bytes.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Cache-Control": "private, max-age=300",
        "Content-Type": object.contentType,
      },
    });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not download image." },
      { status: 400 },
    );
  }
}
