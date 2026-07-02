import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const defaultSignedUrlTtlSeconds = 15 * 60;
const maxSignedUrlTtlSeconds = 60 * 60;
const allowedContentTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/json"]);

export type R2UploadUrlInput = {
  contentType: string;
  filename?: string;
  prefix?: string;
  ttlSeconds?: number;
};

export type R2DownloadUrlInput = {
  key: string;
  ttlSeconds?: number;
};

export type R2ObjectInput = {
  key: string;
};

export type R2ObjectUploadInput = {
  bytes: Uint8Array;
  contentType: string;
  filename?: string;
  prefix?: string;
};

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET are required.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export function createR2Client() {
  const config = getR2Config();
  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: "auto",
  });
}

export async function createR2UploadUrl(input: R2UploadUrlInput) {
  if (!allowedContentTypes.has(input.contentType)) {
    throw new Error("Unsupported content type.");
  }

  const config = getR2Config();
  const client = createR2Client();
  const key = buildObjectKey(input);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    ContentType: input.contentType,
    Key: key,
  });

  return {
    key,
    uploadUrl: await getSignedUrl(client, command, { expiresIn: normalizeTtl(input.ttlSeconds) }),
  };
}

export async function uploadR2Object(input: R2ObjectUploadInput) {
  if (!allowedContentTypes.has(input.contentType)) {
    throw new Error("Unsupported content type.");
  }

  const config = getR2Config();
  const client = createR2Client();
  const key = buildObjectKey({
    contentType: input.contentType,
    filename: input.filename,
    prefix: input.prefix,
  });
  await client.send(
    new PutObjectCommand({
      Body: input.bytes,
      Bucket: config.bucket,
      ContentType: input.contentType,
      Key: key,
    }),
  );

  return { key };
}

export async function createR2DownloadUrl(input: R2DownloadUrlInput) {
  const config = getR2Config();
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: normalizeObjectKey(input.key),
  });

  return {
    key: normalizeObjectKey(input.key),
    downloadUrl: await getSignedUrl(client, command, { expiresIn: normalizeTtl(input.ttlSeconds) }),
  };
}

export async function getR2Object(input: R2ObjectInput) {
  const config = getR2Config();
  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: normalizeObjectKey(input.key),
  });
  const response = await client.send(command);
  const bytes = response.Body ? await response.Body.transformToByteArray() : new Uint8Array();

  return {
    bytes,
    contentType: response.ContentType || "application/octet-stream",
    key: normalizeObjectKey(input.key),
  };
}

function buildObjectKey(input: R2UploadUrlInput) {
  const extension = getExtension(input.contentType, input.filename);
  const prefix = normalizePrefix(input.prefix || "image-markup");
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
}

function normalizePrefix(prefix: string) {
  return prefix
    .split("/")
    .map((part) => part.trim().replace(/[^a-zA-Z0-9._-]/g, "-"))
    .filter(Boolean)
    .join("/")
    .slice(0, 120) || "image-markup";
}

function normalizeObjectKey(key: string) {
  const normalized = key.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid object key.");
  }
  return normalized;
}

function normalizeTtl(ttlSeconds?: number) {
  if (!ttlSeconds || !Number.isFinite(ttlSeconds)) return defaultSignedUrlTtlSeconds;
  return Math.max(60, Math.min(maxSignedUrlTtlSeconds, Math.floor(ttlSeconds)));
}

function getExtension(contentType: string, filename?: string) {
  const filenameExtension = filename?.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]?.toLowerCase();
  if (filenameExtension && [".png", ".jpg", ".jpeg", ".webp", ".json"].includes(filenameExtension)) {
    return filenameExtension;
  }
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "application/json") return ".json";
  return ".png";
}
