import { createHash } from "node:crypto";

import { consumeFigmaSessionIssueQuota } from "@/lib/image-markup/figmaSessionRateLimit";
import { getR2ObjectMetadata, isR2Configured } from "@/lib/image-markup/r2";
import { signAiSessionToken } from "@/lib/image-markup/sessionToken";
import { jsonWithCors, optionsWithCors } from "../../cors";

type FigmaSessionRequest = {
  sourceR2Key?: string;
  sourceLabel?: string;
  width?: number;
  height?: number;
  size?: number;
};

const figmaSourcePrefix = "figma/image-markup/source/";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return jsonWithCors({ ok: false, error: "R2 is not configured." }, { status: 503 });
  }

  let body: FigmaSessionRequest;
  try {
    body = (await request.json()) as FigmaSessionRequest;
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validationError = validatePayload(body);
  if (validationError) {
    return jsonWithCors({ ok: false, error: validationError }, { status: 400 });
  }

  const limiterKey = getClientLimiterKey(request);
  try {
    const quota = await consumeFigmaSessionIssueQuota({ limiterKey });
    if (!quota.allowed) {
      return jsonWithCors(
        { ok: false, error: `This client has reached the ${quota.limit} Figma session limit.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(60, Math.ceil((new Date(quota.resetAt).getTime() - Date.now()) / 1000))),
          },
        },
      );
    }
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not verify Figma session quota." },
      { status: 503 },
    );
  }

  try {
    const source = await getR2ObjectMetadata({ key: body.sourceR2Key || "" });
    if (!source.contentType.startsWith("image/")) {
      return jsonWithCors({ ok: false, error: "The Figma source object must be an image." }, { status: 400 });
    }

    const sessionId = `figma-${crypto.randomUUID()}`;
    const signed = signAiSessionToken({
      sessionId,
      sourceType: "figma-selection",
      sourceHash: buildFigmaSourceHash({
        key: source.key,
        contentType: source.contentType,
        byteLength: source.contentLength,
        width: body.width,
        height: body.height,
        size: body.size,
      }),
      sourceLabel: normalizeSourceLabel(body.sourceLabel),
    });

    return jsonWithCors({
      ok: true,
      sessionId,
      sessionToken: signed.token,
      expiresAt: signed.expiresAt,
    });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not create Figma editing session." },
      { status: 400 },
    );
  }
}

function validatePayload(payload: FigmaSessionRequest) {
  const key = String(payload.sourceR2Key || "").trim();
  if (!key) return "sourceR2Key is required.";
  if (!key.startsWith(figmaSourcePrefix) || key.includes("..")) {
    return "Invalid Figma source object key.";
  }
  return "";
}

function normalizeSourceLabel(label?: string) {
  return String(label || "Figma selection").trim().slice(0, 120) || "Figma selection";
}

function buildFigmaSourceHash(input: {
  key: string;
  contentType: string;
  byteLength: number;
  width?: number;
  height?: number;
  size?: number;
}) {
  return createHash("sha256").update(JSON.stringify(input)).digest("base64url");
}

function getClientLimiterKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  return `figma:${cfIp || forwardedFor || realIp || "unknown"}`;
}
