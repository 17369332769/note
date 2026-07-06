import {
  createOrGetAiRevisionJob,
  getAiRevisionJob,
  markAiRevisionJobCompleted,
  markAiRevisionJobFailed,
  markAiRevisionJobPending,
  type AiRevisionJob,
} from "@/lib/image-markup/aiRevisionJobs";
import { buildImageEditPrompt, hashPrompt } from "@/lib/image-markup/aiPrompt";
import { uploadR2Object } from "@/lib/image-markup/r2";
import { describeRunningHubError, normalizeRunningHubAspectRatio, pickScalarString } from "@/lib/image-markup/runninghub";
import { assertAiRevisionSessionAccess } from "@/lib/image-markup/sessionAccess";
import { consumeAiRevisionSessionQuota } from "@/lib/image-markup/sessionRateLimit";
import type { AiRevisionRequest } from "@/lib/image-markup/types";
import { jsonWithCors, optionsWithCors } from "../cors";

const runningHubDefaultEditUrl = "https://www.runninghub.cn/openapi/v2/rhart-image-g-2-official/image-to-image";
const runningHubDefaultQueryUrl = "https://www.runninghub.cn/openapi/v2/query";
const maxDefaultImageBytes = 10 * 1024 * 1024;

type DecodedImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type GeneratedImage = DecodedImage;

type RunningHubImageToImagePayload = {
  prompt: string;
  imageUrls: [string, string];
  aspectRatio: string;
  resolution: "1k";
  quality: "low";
};

type RunningHubQueryResult =
  | { status: "pending" }
  | { status: "completed"; outputUrl: string }
  | { status: "failed"; error: string };

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
  if (!runningHubApiKey) {
    return jsonWithCors({ ok: false, error: "RUNNINGHUB_API_KEY is not configured." }, { status: 503 });
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

  const requestId = payload.requestId || hashPrompt(JSON.stringify(payload));
  let tokenClaims: Awaited<ReturnType<typeof assertAiRevisionSessionAccess>> | null = null;
  try {
    tokenClaims = await assertAiRevisionSessionAccess(payload);
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Invalid editing session." },
      { status: 403 },
    );
  }

  let stage = "prepare";
  let createdJob: AiRevisionJob | null = null;
  try {
    stage = "validate-input-images";
    const imageUrls = getPreparedImageUrls(payload);

    stage = "build-prompt";
    const prompt = buildImageEditPrompt({
      editBrief: payload.editBrief,
      aspectRatio: payload.aspectRatio,
    });
    const promptHash = hashPrompt(prompt);
    const { created, job } = await createOrGetAiRevisionJob({
      requestId,
      sessionId: payload.sessionId,
      provider: "runninghub",
      promptHash,
      resolution: "1k",
      quality: "low",
      model: "rhart-image-g-2-official",
    });

    if (!created) {
      return jsonWithCors(toJobResponse(job));
    }
    createdJob = job;

    stage = "consume-quota";
    const quota = await consumeAiRevisionSessionQuota({
      sessionId: payload.sessionId,
      resetAt: tokenClaims?.exp ? new Date(tokenClaims.exp * 1000).toISOString() : undefined,
    });
    if (!quota.allowed) {
      const failedJob = await markAiRevisionJobFailed({
        sessionId: payload.sessionId,
        jobId: job.jobId,
        error: `This editing session has reached the ${quota.limit} generation limit.`,
      });
      return jsonWithCors(toJobResponse(failedJob), {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(60, Math.ceil((new Date(quota.resetAt).getTime() - Date.now()) / 1000))),
        },
      });
    }

    stage = "create-runninghub-task";
    const taskId = await createRunningHubTask(runningHubApiKey || "", {
      prompt,
      imageUrls,
      aspectRatio: normalizeRunningHubAspectRatio(payload.aspectRatio || inferAspectRatio()),
      resolution: "1k",
      quality: "low",
    });
    const pendingJob = await markAiRevisionJobPending({
      sessionId: payload.sessionId,
      jobId: job.jobId,
      taskId,
    });

    return jsonWithCors(toJobResponse(pendingJob), { status: 202 });
  } catch (error) {
    console.error("[image-markup] AI revision start failed", {
      sessionId: payload.sessionId,
      provider: "runninghub",
      stage,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (createdJob) {
      await markAiRevisionJobFailed({
        sessionId: payload.sessionId,
        jobId: createdJob.jobId,
        error: error instanceof Error ? error.message : "AI revision failed.",
      }).catch(() => null);
    }
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "AI revision failed." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  const runningHubApiKey = process.env.RUNNINGHUB_API_KEY;
  if (!runningHubApiKey) {
    return jsonWithCors({ ok: false, error: "RUNNINGHUB_API_KEY is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || "";
  const sessionToken = searchParams.get("sessionToken") || "";
  const jobId = searchParams.get("jobId") || "";
  if (!sessionId) return jsonWithCors({ ok: false, error: "sessionId is required." }, { status: 400 });
  if (!sessionToken) return jsonWithCors({ ok: false, error: "sessionToken is required." }, { status: 400 });
  if (!jobId) return jsonWithCors({ ok: false, error: "jobId is required." }, { status: 400 });

  try {
    await assertAiRevisionSessionAccess({ sessionId, sessionToken });
  } catch (error) {
    return jsonWithCors(
      { ok: false, error: error instanceof Error ? error.message : "Invalid editing session." },
      { status: 403 },
    );
  }

  let stage = "load-job";
  try {
    const job = await getAiRevisionJob({ sessionId, jobId });
    if (!job) return jsonWithCors({ ok: false, error: "AI revision job was not found." }, { status: 404 });
    if (job.status !== "pending") return jsonWithCors(toJobResponse(job));
    if (!job.taskId) return jsonWithCors(toJobResponse(job));

    stage = "query-runninghub-task";
    const result = await queryRunningHubTask(runningHubApiKey || "", job.taskId);
    if (result.status === "pending") return jsonWithCors(toJobResponse(job), { status: 202 });
    if (result.status === "failed") {
      const failedJob = await markAiRevisionJobFailed({ sessionId, jobId, error: result.error });
      return jsonWithCors(toJobResponse(failedJob), { status: 502 });
    }

    stage = "download-runninghub-result";
    const image = await fetchResultImage(result.outputUrl);
    stage = "save-generated-image";
    const completedJob = await saveCompletedJobImage({
      sessionId,
      job,
      image,
      maxImageBytes: Number(process.env.IMAGE_MARKUP_MAX_IMAGE_BYTES || maxDefaultImageBytes),
    });
    return jsonWithCors(toJobResponse(completedJob));
  } catch (error) {
    console.error("[image-markup] AI revision poll failed", {
      sessionId,
      jobId,
      provider: "runninghub",
      stage,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const failedJob = await markAiRevisionJobFailed({
      sessionId,
      jobId,
      error: error instanceof Error ? error.message : "AI revision polling failed.",
    }).catch(() => null);
    return jsonWithCors(
      failedJob ? toJobResponse(failedJob) : { ok: false, error: "AI revision polling failed." },
      { status: 502 },
    );
  }
}

function validatePayload(payload: Partial<AiRevisionRequest>) {
  if (!payload.sessionId) return "sessionId is required.";
  if (!payload.preparedImageUrls) return "preparedImageUrls is required.";
  if (!payload.editBrief || typeof payload.editBrief !== "object") return "editBrief is required.";
  if (!Array.isArray(payload.editBrief.annotations)) return "editBrief.annotations must be an array.";
  return "";
}

function toJobResponse(job: AiRevisionJob) {
  const base = {
    ok: true,
    status: job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : "pending",
    jobId: job.jobId,
    provider: job.provider,
    taskId: job.taskId,
    promptVersion: job.promptVersion,
    promptHash: job.promptHash,
    resolution: job.resolution,
    quality: job.quality,
    model: job.model,
    generatedAt: job.generatedAt || new Date().toISOString(),
  };
  if (job.status === "completed") {
    return {
      ...base,
      status: "completed",
      revisedImageR2Key: job.revisedImageR2Key,
      revisedImageUrl: job.revisedImageUrl,
    };
  }
  if (job.status === "failed") {
    return {
      ...base,
      status: "failed",
      error: job.error || "AI revision failed.",
    };
  }
  return {
    ...base,
    status: "pending",
  };
}

function getPreparedImageUrls(payload: Partial<AiRevisionRequest>): [string, string] {
  if (!payload.preparedImageUrls) throw new Error("preparedImageUrls is required.");
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

async function queryRunningHubTask(apiKey: string, taskId: string): Promise<RunningHubQueryResult> {
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

  if (!response.ok) {
    return { status: "failed", error: describeRunningHubError(json) || `RunningHub query failed with ${response.status}.` };
  }
  if (outputUrl) return { status: "completed", outputUrl };
  if (["failed", "error", "cancelled", "canceled"].includes(status)) {
    return { status: "failed", error: describeRunningHubError(json) || "RunningHub task failed." };
  }
  return { status: "pending" };
}

async function saveCompletedJobImage(input: {
  sessionId: string;
  job: AiRevisionJob;
  image: GeneratedImage;
  maxImageBytes: number;
}) {
  const revisedImage = validateGeneratedImage(input.image, input.maxImageBytes);
  const revisedUpload = await uploadR2Object({
    bytes: revisedImage.bytes,
    contentType: revisedImage.mimeType,
    filename: `${input.sessionId}-revised-${Date.now()}${getImageExtension(revisedImage.mimeType)}`,
    prefix: "image-markup/output",
  });
  return markAiRevisionJobCompleted({
    sessionId: input.sessionId,
    jobId: input.job.jobId,
    revisedImageR2Key: revisedUpload.key,
    revisedImageUrl: getR2ObjectUrl(revisedUpload.key),
  });
}

async function fetchResultImage(url: string): Promise<GeneratedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not download RunningHub result image.");
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: normalizeImageContentType(response.headers.get("content-type")),
  };
}

function getR2ObjectUrl(key: string) {
  return `/api/image-markup/r2/object?key=${encodeURIComponent(key)}`;
}

function getImageExtension(mimeType: DecodedImage["mimeType"]) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  return ".png";
}

function validateGeneratedImage(image: GeneratedImage, maxBytes: number): GeneratedImage {
  if (image.bytes.byteLength > maxBytes) {
    throw new Error("Generated image payload is too large.");
  }
  return image;
}

function normalizeImageContentType(contentType: string | null): GeneratedImage["mimeType"] {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("image/jpeg")) return "image/jpeg";
  if (normalized.includes("image/webp")) return "image/webp";
  return "image/png";
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
