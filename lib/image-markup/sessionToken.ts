import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const tokenAudience = "image-markup-ai";
const tokenVersion = 1;
const defaultTtlSeconds = 2 * 60 * 60;
const maxTtlSeconds = 6 * 60 * 60;

export type AiSessionTokenClaims = {
  v: typeof tokenVersion;
  aud: typeof tokenAudience;
  sessionId: string;
  documentId?: string;
  sourceType?: string;
  sourceHash?: string;
  sourceLabel?: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type AiSessionTokenInput = {
  sessionId: string;
  documentId?: string;
  sourceType?: string;
  sourceHash?: string;
  sourceLabel?: string;
  expiresInSeconds?: number;
};

export function signAiSessionToken(input: AiSessionTokenInput) {
  const secret = getSessionSigningSecret();
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = normalizeTtl(input.expiresInSeconds);
  const claims: AiSessionTokenClaims = {
    v: tokenVersion,
    aud: tokenAudience,
    sessionId: input.sessionId,
    documentId: input.documentId || undefined,
    sourceType: input.sourceType || undefined,
    sourceHash: input.sourceHash || undefined,
    sourceLabel: input.sourceLabel || undefined,
    iat: now,
    exp: now + ttlSeconds,
    nonce: randomUUID(),
  };
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = signPayload(payload, secret);
  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    claims,
  };
}

export function verifyAiSessionToken(token: string, expectedSessionId: string) {
  if (!token) throw new Error("sessionToken is required.");
  const secret = getSessionSigningSecret();
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid editing session token.");

  const expectedSignature = signPayload(payload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new Error("Invalid editing session token.");
  }

  let claims: AiSessionTokenClaims;
  try {
    claims = JSON.parse(base64UrlDecode(payload).toString("utf8")) as AiSessionTokenClaims;
  } catch {
    throw new Error("Invalid editing session token.");
  }

  if (claims.v !== tokenVersion || claims.aud !== tokenAudience) {
    throw new Error("Invalid editing session token.");
  }
  if (!claims.sessionId || claims.sessionId !== expectedSessionId) {
    throw new Error("Invalid editing session token.");
  }
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Editing session has expired.");
  }

  return claims;
}

export function getSessionExchangeSecret() {
  const secret = process.env.IMAGE_MARKUP_SESSION_EXCHANGE_SECRET;
  if (!secret) throw new Error("IMAGE_MARKUP_SESSION_EXCHANGE_SECRET is not configured.");
  return secret;
}

export function safeEqualString(left: string, right: string) {
  return safeEqual(left, right);
}

function getSessionSigningSecret() {
  const secret = process.env.IMAGE_MARKUP_SESSION_SIGNING_SECRET;
  if (!secret) throw new Error("IMAGE_MARKUP_SESSION_SIGNING_SECRET is not configured.");
  return secret;
}

function normalizeTtl(ttl?: number) {
  const configured = Number(process.env.IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS || defaultTtlSeconds);
  const requested = Number.isFinite(ttl) && ttl ? Number(ttl) : configured;
  return Math.max(60, Math.min(maxTtlSeconds, Math.floor(requested)));
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer);
}
