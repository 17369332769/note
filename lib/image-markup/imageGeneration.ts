import { pickScalarString } from "./runninghub";

export type ImageGenerationProvider = "runninghub" | "imgv2";

export type Imgv2ImageGenerationConfig = {
  apiKey: string;
  endpoint: string;
  model: string;
  modelConfigKey: string;
  size: string;
};

export type Imgv2ImageGenerationResult = {
  revisedImageDataUrl: string;
  taskId: string;
};

const imgv2DefaultEndpoint = "https://imgv2.aiapis.help/v1/images/generations";
const imgv2DefaultModel = "gpt-image-2";
const imgv2DefaultModelConfigKey = "gpt-image-2-[c4k]";
const imgv2DefaultSize = "4k";

export function getConfiguredImageGenerationProvider(): ImageGenerationProvider {
  const provider = (process.env.IMAGE_GENERATION_PROVIDER || "").trim().toLowerCase();
  if (provider === "imgv2" || provider === "aiapis") return "imgv2";
  if (provider === "runninghub") return "runninghub";
  return process.env.IMGV2_API_KEY || process.env.IMAGE_GENERATION_API_KEY ? "imgv2" : "runninghub";
}

export function getImgv2ImageGenerationConfig(): Imgv2ImageGenerationConfig {
  return {
    apiKey: process.env.IMGV2_API_KEY || process.env.IMAGE_GENERATION_API_KEY || "",
    endpoint: process.env.IMGV2_IMAGE_GENERATION_URL || imgv2DefaultEndpoint,
    model: process.env.IMGV2_IMAGE_MODEL || process.env.IMAGE_GENERATION_MODEL || imgv2DefaultModel,
    modelConfigKey:
      process.env.IMGV2_IMAGE_MODEL_CONFIG_KEY ||
      process.env.IMAGE_GENERATION_MODEL_CONFIG_KEY ||
      imgv2DefaultModelConfigKey,
    size: process.env.IMGV2_IMAGE_SIZE || process.env.IMAGE_GENERATION_SIZE || imgv2DefaultSize,
  };
}

export async function createImgv2ImageGeneration(
  config: Imgv2ImageGenerationConfig,
  prompt: string,
): Promise<Imgv2ImageGenerationResult> {
  if (!config.apiKey) {
    throw new Error("IMGV2_API_KEY is not configured.");
  }

  const body: Record<string, string> = {
    model: config.model,
    prompt,
    size: config.size,
    response_format: "b64_json",
  };
  if (config.modelConfigKey) {
    body.model_config_key = config.modelConfigKey;
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": "workspace-addons-lab/1.0",
    },
    body: JSON.stringify(body),
  });
  const json = await readJson(response);
  const b64Json = pickB64Json(json);
  const outputUrl = pickScalarString(json, [
    "data.0.url",
    "data.url",
    "url",
    "imageUrl",
    "outputUrl",
    "result.0.url",
    "results.0.url",
  ]);
  const taskId =
    pickScalarString(json, ["id", "taskId", "task_id", "created", "data.id", "data.0.id"]) ||
    `imgv2-${Date.now()}`;

  if (!response.ok || (!b64Json && !outputUrl)) {
    throw new Error(describeImgv2Error(json) || "ImgV2 did not return an image.");
  }

  if (b64Json) {
    return {
      revisedImageDataUrl: `data:image/png;base64,${b64Json}`,
      taskId,
    };
  }

  return {
    revisedImageDataUrl: await fetchImageAsDataUrl(outputUrl),
    taskId,
  };
}

function pickB64Json(value: unknown) {
  return pickScalarString(value, [
    "data.0.b64_json",
    "data.b64_json",
    "b64_json",
    "image.b64_json",
    "result.0.b64_json",
    "results.0.b64_json",
  ]);
}

function describeImgv2Error(value: unknown) {
  const parts = [
    pickScalarString(value, ["error.message", "error", "message", "msg"]),
    pickScalarString(value, ["error.code", "code", "error.type", "type"]),
  ].filter(Boolean);

  if (!parts.length) return "";
  return `ImgV2 error: ${parts.join(" | ")}`;
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not download ImgV2 result image.");
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
