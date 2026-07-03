import { buildImageEditPrompt, hashPrompt, imageMarkupPromptVersion } from "@/lib/image-markup/aiPrompt";
import {
  createImgv2ImageGeneration,
  getConfiguredImageGenerationProvider,
  getImgv2ImageGenerationConfig,
} from "@/lib/image-markup/imageGeneration";
import { createR2DownloadUrl, createR2UploadUrl } from "@/lib/image-markup/r2";
import { describeRunningHubError, normalizeRunningHubAspectRatio, pickScalarString } from "@/lib/image-markup/runninghub";
import { assertAiRevisionSessionAccess } from "@/lib/image-markup/sessionAccess";
import { consumeAiRevisionSessionQuota } from "@/lib/image-markup/sessionRateLimit";
import type { AiRevisionRequest } from "@/lib/image-markup/types";
import { jsonWithCors, optionsWithCors } from "../cors";

const runningHubDefaultEditUrl = "https://www.runninghub.cn/openapi/v2/rhart-image-g-2-official/image-to-image";
const runningHubDefaultQueryUrl = "https://www.runninghub.cn/openapi/v2/query";
const maxDefaultImageBytes = 10 * 1024 * 1024;
const pollDelayMs = 2000;
const maxPollAttempts = 45;

type DecodedImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type RunningHubImageToImagePayload = {
  prompt: string;
  imageUrls: [string, string];
  aspectRatio: string;
  resolution: "1k";
  quality: "low";
};

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  const provider = getConfiguredImageGenerationProvider();
  const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
  const imgv2Config = getImgv2ImageGenerationConfig();
  if (provider === "runninghub" && !runningHubApiKey) {
    return jsonWithCors({ ok: false, error: "RUNNINGHUB_API_KEY is not configured." }, { status: 503 });
  }
  if (provider === "imgv2" && !imgv2Config.apiKey) {
    return jsonWithCors({ ok: false, error: "IMGV2_API_KEY is not configured." }, { status: 503 });
  }

  let payload: AiRevisionRequest;
  try {
    payload = (await request.json()) as AiRevisionRequest;
  } catch {
    return jsonWithCors({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return jsonWithCors({ ok: false, error: validationError }, { status: 400 });
  }

  let tokenClaims: Awaited<ReturnType<typeof assertAiRevisionSessionAccess>> | null = null;
  try {
    tokenClaims = await assertAiRevisionSessionAccess(payload);
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Invalid editing session." },
      { status: 403 },
    );
  }

  try {
    const quota = await consumeAiRevisionSessionQuota({
      sessionId: payload.sessionId,
      resetAt: tokenClaims?.exp ? new Date(tokenClaims.exp * 1000).toISOString() : undefined,
    });
    if (!quota.allowed) {
      return jsonWithCors(
        {
          ok: false,
          error: `This editing session has reached the ${quota.limit} generation limit.`,
          limit: quota.limit,
          remaining: quota.remaining,
          resetAt: quota.resetAt,
        },
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
      { ok: false, error: error instanceof Error ? error.message : "Could not verify generation limit." },
      { status: 503 },
    );
  }

  try {
    const maxImageBytes = Number(process.env.IMAGE_MARKUP_MAX_IMAGE_BYTES || maxDefaultImageBytes);
    const imageUrls = getPreparedImageUrls(payload);
    if (!imageUrls) {
      decodeImageDataUrl(payload.originalImageDataUrl || "", maxImageBytes);
      decodeImageDataUrl(payload.annotatedImageDataUrl || "", maxImageBytes);
    }
    const prompt = buildImageEditPrompt({
      editBrief: payload.editBrief,
      aspectRatio: payload.aspectRatio,
    });
    const promptHash = hashPrompt(prompt);

    const revision =
      provider === "imgv2"
        ? await createImgv2ImageGeneration(
            imgv2Config,
            buildImgv2RevisionPrompt({
              prompt,
              imageUrls: imageUrls || (await prepareRunningHubImageUrls(payload)),
            }),
          )
        : await createRunningHubRevision(runningHubApiKey || "", payload, prompt, imageUrls);

    return jsonWithCors({
      ok: true,
      revisedImageDataUrl: revision.revisedImageDataUrl,
      provider,
      taskId: revision.taskId,
      promptVersion: imageMarkupPromptVersion,
      promptHash,
      resolution: provider === "runninghub" ? "1k" : imgv2Config.size,
      quality: provider === "runninghub" ? "low" : imgv2Config.modelConfigKey,
      model: provider === "imgv2" ? imgv2Config.model : "rhart-image-g-2-official",
      modelConfigKey: provider === "imgv2" ? imgv2Config.modelConfigKey : undefined,
      size: provider === "imgv2" ? imgv2Config.size : undefined,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonWithCors(
      {
        ok: false,
        error: error instanceof Error ? error.message : "AI revision failed.",
      },
      { status: 502 },
    );
  }
}

async function createRunningHubRevision(
  apiKey: string,
  payload: AiRevisionRequest,
  prompt: string,
  imageUrls: [string, string] | null,
) {
  const runningHubImageUrls = imageUrls || (await prepareRunningHubImageUrls(payload));
  const taskId = await createRunningHubTask(apiKey, {
    prompt,
    imageUrls: runningHubImageUrls,
    aspectRatio: normalizeRunningHubAspectRatio(payload.aspectRatio || inferAspectRatio()),
    resolution: "1k",
    quality: "low",
  });
  const outputUrl = await waitForRunningHubResult(apiKey, taskId);
  return {
    revisedImageDataUrl: await fetchResultAsPngDataUrl(outputUrl),
    taskId,
  };
}

function buildImgv2RevisionPrompt(args: { prompt: string; imageUrls: [string, string] }) {
  return `
${args.prompt}

Reference images:
- Original image URL: ${args.imageUrls[0]}
- Annotated instruction image URL: ${args.imageUrls[1]}

Use the original image URL as the base image and the annotated instruction image URL only to understand the requested edits.
`.trim();
}

function validatePayload(payload: Partial<AiRevisionRequest>) {
  if (!payload.sessionId) return "sessionId is required.";
  if (!payload.preparedImageUrls && !payload.originalImageDataUrl) return "originalImageDataUrl is required.";
  if (!payload.preparedImageUrls && !payload.annotatedImageDataUrl) return "annotatedImageDataUrl is required.";
  if (!payload.editBrief || typeof payload.editBrief !== "object") return "editBrief is required.";
  if (!Array.isArray(payload.editBrief.annotations)) return "editBrief.annotations must be an array.";
  return "";
}

function getPreparedImageUrls(payload: Partial<AiRevisionRequest>): [string, string] | null {
  if (!payload.preparedImageUrls) return null;
  if (!Array.isArray(payload.preparedImageUrls) || payload.preparedImageUrls.length !== 2) {
    throw new Error("preparedImageUrls must contain original and annotated image URLs.");
  }
  const [originalUrl, annotatedUrl] = payload.preparedImageUrls;
  if (!isHttpUrl(originalUrl) || !isHttpUrl(annotatedUrl)) {
    throw new Error("preparedImageUrls must be HTTP image URLs.");
  }
  return [originalUrl, annotatedUrl];
}

function isHttpUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function decodeImageDataUrl(dataUrl: string, maxBytes: number): DecodedImage {
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Only PNG, JPEG, and WebP image data URLs are supported.");
  }

  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  if (bytes.byteLength > maxBytes) {
    throw new Error("Image payload is too large.");
  }

  return {
    bytes,
    mimeType: match[1] as DecodedImage["mimeType"],
  };
}

async function prepareRunningHubImageUrls(payload: AiRevisionRequest): Promise<[string, string]> {
  if (!payload.originalImageDataUrl || !payload.annotatedImageDataUrl) {
    throw new Error("originalImageDataUrl and annotatedImageDataUrl are required when preparedImageUrls are missing.");
  }
  const [originalKey, annotatedKey] = await Promise.all([
    uploadDataUrlToR2(payload.originalImageDataUrl, `${payload.sessionId}-runninghub-original.png`),
    uploadDataUrlToR2(payload.annotatedImageDataUrl, `${payload.sessionId}-runninghub-annotated.png`),
  ]);
  const [original, annotated] = await Promise.all([
    createR2DownloadUrl({ key: originalKey, ttlSeconds: 3600 }),
    createR2DownloadUrl({ key: annotatedKey, ttlSeconds: 3600 }),
  ]);
  return [original.downloadUrl, annotated.downloadUrl];
}

async function uploadDataUrlToR2(dataUrl: string, filename: string) {
  const image = decodeImageDataUrl(dataUrl, Number(process.env.IMAGE_MARKUP_MAX_IMAGE_BYTES || maxDefaultImageBytes));
  const upload = await createR2UploadUrl({
    contentType: image.mimeType,
    filename,
    prefix: "image-markup/runninghub",
    ttlSeconds: 900,
  });
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": image.mimeType },
    body: Buffer.from(image.bytes),
  });
  if (!response.ok) {
    throw new Error("Could not upload image to R2.");
  }
  return upload.key;
}

async function createRunningHubTask(apiKey: string, payload: RunningHubImageToImagePayload) {
  const response = await fetch(process.env.RUNNINGHUB_IMAGE_EDIT_URL || runningHubDefaultEditUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await readJson(response);
  const taskId = pickScalarString(json, ["data.taskId", "data.task_id", "taskId", "task_id", "data.id", "id"]);
  if (!response.ok || !taskId) {
    throw new Error(describeRunningHubError(json) || "RunningHub did not return a task id.");
  }
  return taskId;
}

async function waitForRunningHubResult(apiKey: string, taskId: string) {
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    await sleep(pollDelayMs);
    const response = await fetch(process.env.RUNNINGHUB_QUERY_URL || runningHubDefaultQueryUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskId }),
    });
    const json = await readJson(response);
    const status = String(pickScalarString(json, ["data.status", "status", "data.state", "state"]) || "").toLowerCase();
    const outputUrl = pickScalarString(json, [
      "data.imageUrl",
      "data.image_url",
      "data.outputUrl",
      "data.output_url",
      "data.outputs.0.url",
      "data.results.0.url",
      "results.0.url",
      "data.0.url",
      "data.result.0.url",
      "result.0.url",
      "imageUrl",
      "outputUrl",
    ]);

    if (outputUrl) return outputUrl;
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(describeRunningHubError(json) || "RunningHub task failed.");
    }
  }

  throw new Error("RunningHub task timed out.");
}

async function fetchResultAsPngDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not download RunningHub result image.");
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(text || `Request failed with ${response.status}.`);
  }
}

function inferAspectRatio() {
  return "1:1";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
