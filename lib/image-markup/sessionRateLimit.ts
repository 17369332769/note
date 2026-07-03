import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, getR2Config } from "./r2";

const defaultSessionLimit = 10;

type SessionLimitRecord = {
  sessionId: string;
  count: number;
  limit: number;
  resetAt: string;
  updatedAt: string;
};

export type SessionLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: string;
};

export async function consumeAiRevisionSessionQuota(input: { sessionId: string; resetAt?: string }) {
  const limit = getSessionLimit();
  const resetAt = normalizeResetAt(input.resetAt);
  const key = buildRateLimitKey(input.sessionId);
  const existing = await readLimitRecord(key);
  const currentCount = existing && new Date(existing.resetAt).getTime() > Date.now() ? existing.count : 0;
  const nextCount = currentCount + 1;
  const record: SessionLimitRecord = {
    sessionId: input.sessionId,
    count: nextCount,
    limit,
    resetAt,
    updatedAt: new Date().toISOString(),
  };

  if (nextCount > limit) {
    return {
      allowed: false,
      count: currentCount,
      limit,
      remaining: 0,
      resetAt: existing?.resetAt || resetAt,
    } satisfies SessionLimitResult;
  }

  await writeLimitRecord(key, record);
  return {
    allowed: true,
    count: nextCount,
    limit,
    remaining: Math.max(0, limit - nextCount),
    resetAt,
  } satisfies SessionLimitResult;
}

function getSessionLimit() {
  const configured = Number(process.env.IMAGE_MARKUP_AI_SESSION_LIMIT || defaultSessionLimit);
  if (!Number.isFinite(configured)) return defaultSessionLimit;
  return Math.max(1, Math.min(100, Math.floor(configured)));
}

function normalizeResetAt(resetAt?: string) {
  const parsed = resetAt ? new Date(resetAt).getTime() : NaN;
  if (Number.isFinite(parsed) && parsed > Date.now()) return new Date(parsed).toISOString();
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

function buildRateLimitKey(sessionId: string) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  return `image-markup/rate-limits/${safeSessionId}.json`;
}

async function readLimitRecord(key: string) {
  const config = getR2Config();
  const client = createR2Client();
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    const text = response.Body ? await response.Body.transformToString() : "";
    return JSON.parse(text) as SessionLimitRecord;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw error;
  }
}

async function writeLimitRecord(key: string, record: SessionLimitRecord) {
  const config = getR2Config();
  const client = createR2Client();
  await client.send(
    new PutObjectCommand({
      Body: JSON.stringify(record),
      Bucket: config.bucket,
      ContentType: "application/json",
      Key: key,
    }),
  );
}
