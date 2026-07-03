import { getSessionExchangeSecret, safeEqualString, signAiSessionToken } from "@/lib/image-markup/sessionToken";
import { jsonWithCors, optionsWithCors } from "../cors";

type SessionTokenRequest = {
  sessionId?: string;
  documentId?: string;
  sourceType?: string;
  sourceHash?: string;
  sourceLabel?: string;
  expiresInSeconds?: number;
};

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  let body: SessionTokenRequest;
  try {
    body = (await request.json()) as SessionTokenRequest;
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!body.sessionId) {
    return jsonWithCors({ ok: false, error: "sessionId is required." }, { status: 400 });
  }

  try {
    const expectedSecret = getSessionExchangeSecret();
    const providedSecret = request.headers.get("x-image-markup-exchange-secret") || "";
    if (!safeEqualString(providedSecret, expectedSecret)) {
      return jsonWithCors({ ok: false, error: "Unauthorized session token exchange." }, { status: 401 });
    }

    const signed = signAiSessionToken({
      sessionId: body.sessionId,
      documentId: body.documentId,
      sourceType: body.sourceType,
      sourceHash: body.sourceHash,
      sourceLabel: body.sourceLabel,
      expiresInSeconds: body.expiresInSeconds,
    });

    return jsonWithCors({
      ok: true,
      sessionToken: signed.token,
      expiresAt: signed.expiresAt,
    });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Could not create editing session token." },
      { status: 503 },
    );
  }
}
