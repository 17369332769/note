import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function loadTsModule(path) {
  const source = read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  vm.runInNewContext(output, {
    Buffer,
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  });
  return cjsModule.exports;
}

const promptModule = loadTsModule("lib/image-markup/aiPrompt.ts");
const runningHubModule = loadTsModule("lib/image-markup/runninghub.ts");
const prompt = promptModule.buildImageEditPrompt({
  aspectRatio: "16:9",
  editBrief: {
    sessionId: "session-1",
    sourceLabel: "文档图片 1",
    globalInstruction: "整体更清晰，保持风格",
    annotations: [
      {
        type: "rectangle",
        text: "把这里的按钮改成蓝色",
        originalText: "把这里的按钮改成蓝色",
        bounds: { x: 10, y: 20, width: 200, height: 80 },
        color: "#d93025",
      },
    ],
  },
});

assert.match(prompt, /Input image 1 is the clean original image/);
assert.match(prompt, /Input image 2 is an annotated reference image/);
assert.match(prompt, /Remove all annotation artifacts/);
assert.match(prompt, /把这里的按钮改成蓝色/);
assert.match(prompt, /Preserve the original aspect ratio: 16:9/);
assert.equal(promptModule.hashPrompt(prompt), promptModule.hashPrompt(prompt), "prompt hash must be stable");
assert.equal(
  runningHubModule.pickScalarString({ taskId: 12345 }, ["taskId"]),
  "12345",
  "RunningHub task ids may be numeric",
);
assert.match(
  runningHubModule.describeRunningHubError({ errorCode: "BAD_REQUEST", errorMessage: "Invalid image URL" }),
  /BAD_REQUEST/,
  "RunningHub provider errors should be surfaced",
);
assert.equal(
  runningHubModule.normalizeRunningHubAspectRatio("1024:741"),
  "4:3",
  "arbitrary image dimensions should map to the closest RunningHub aspect ratio",
);
assert.equal(
  runningHubModule.normalizeRunningHubAspectRatio("16:9"),
  "16:9",
  "allowed RunningHub aspect ratios should pass through unchanged",
);

const aiRoute = read("app/api/image-markup/ai-revision/route.ts");
assert.match(aiRoute, /Authorization:\s*`Bearer \$\{apiKey\}`/, "RunningHub calls must use bearer auth");
assert.doesNotMatch(aiRoute, /type RunningHubImageToImagePayload = \{[^}]*apiKey/s, "RunningHub body must not include apiKey");
assert.match(aiRoute, /resolution:\s*"1k"/, "resolution must be fixed to 1k");
assert.match(aiRoute, /quality:\s*"low"/, "quality must be fixed to low");
assert.match(aiRoute, /pickScalarString/, "RunningHub ids may be strings or numbers");
assert.match(aiRoute, /describeRunningHubError/, "RunningHub errors must include provider details");
assert.match(aiRoute, /normalizeRunningHubAspectRatio/, "RunningHub aspect ratio must be normalized to allowed options");
assert.match(aiRoute, /data\.results\.0\.url/);
assert.match(aiRoute, /results\.0\.url/);
assert.match(aiRoute, /uploadR2Object/, "AI revision route must persist generated images server-side");
assert.match(aiRoute, /image-markup\/output/, "AI revision route must save generated images in the output prefix");
assert.match(aiRoute, /revisedImageR2Key/, "AI revision response must return the saved generated image key");
assert.match(aiRoute, /revisedImageUrl/, "AI revision response must return a lightweight preview URL");
assert.match(aiRoute, /fetchResultImage/, "RunningHub result images must be downloaded server-side");
assert.match(aiRoute, /export async function GET/, "AI revision route must expose polling for async jobs");
assert.match(aiRoute, /createOrGetAiRevisionJob/, "AI revision route must dedupe duplicate starts by request id");
assert.match(aiRoute, /markAiRevisionJobPending/, "AI revision route must persist provider task ids");
assert.match(aiRoute, /queryRunningHubTask/, "AI revision polling must query RunningHub task status");
assert.match(aiRoute, /status:\s*202/, "AI revision route must return pending jobs without holding the request open");
assert.doesNotMatch(aiRoute, /imgv2|IMGV2|IMAGE_GENERATION_PROVIDER|createImgv2/, "AI revision route must be RunningHub-only");
assert.doesNotMatch(
  aiRoute,
  new RegExp("originalImage" + "DataUrl|annotatedImage" + "DataUrl"),
  "AI revision route must require prepared R2 URLs",
);
assert.doesNotMatch(
  aiRoute,
  /revisedImageDataUrl:\s*revision\.revisedImageDataUrl/,
  "AI revision route must not send generated image data URLs back to the browser",
);
assert.match(aiRoute, /getPreparedImageUrls/);
assert.match(aiRoute, /preparedImageUrls/);
assert.match(aiRoute, /assertAiRevisionSessionAccess/, "AI revision route must verify the editor session before provider calls");
assert.match(aiRoute, /consumeAiRevisionSessionQuota/, "AI revision route must enforce per-session generation quota");
assert.match(aiRoute, /status:\s*429/, "AI revision route must return 429 when the session quota is exceeded");

const sessionAccess = read("lib/image-markup/sessionAccess.ts");
assert.match(sessionAccess, /verifyAiSessionToken/, "AI session access must verify the signed backend token locally");
assert.doesNotMatch(
  sessionAccess,
  /APPS_SCRIPT_WEBAPP_URL/,
  "AI session access must not call Apps Script during generation",
);

const sessionTokenRoute = read("app/api/image-markup/session-token/route.ts");
assert.match(sessionTokenRoute, /IMAGE_MARKUP_SESSION_EXCHANGE_SECRET|x-image-markup-exchange-secret/);
assert.match(sessionTokenRoute, /signAiSessionToken/);

const sessionRateLimit = read("lib/image-markup/sessionRateLimit.ts");
assert.match(sessionRateLimit, /IMAGE_MARKUP_AI_SESSION_LIMIT/);
assert.match(sessionRateLimit, /defaultSessionLimit\s*=\s*10/);
assert.match(sessionRateLimit, /@neondatabase\/serverless/);
assert.match(sessionRateLimit, /DATABASE_URL/);
assert.match(sessionRateLimit, /image_markup_ai_session_usage/);
assert.doesNotMatch(sessionRateLimit, /createR2Client|getR2Config|rate-limits/);

const editorPage = read("app/image-markup/editor/page.tsx");
assert.match(editorPage, /bridgeEnabled/);
assert.match(editorPage, /callAppsScriptBridge/);
assert.match(editorPage, /sessionToken/, "Editor must pass the session token to backend calls");
assert.match(editorPage, /prepareRunningHubImagesWithR2/);
assert.match(editorPage, /uploadBlobToR2/);
assert.match(editorPage, /parseAiRevisionResponse/);
assert.match(editorPage, /\/api\/image-markup\/ai-revision/);
assert.match(editorPage, /requestId/, "Editor must send an idempotency request id for generation starts");
assert.match(editorPage, /waitForAiRevisionResult/, "Editor must poll async AI revision jobs until completion");
assert.match(editorPage, /jobId:\s*latestResult\.jobId/, "Editor polling must use the backend job id");
assert.match(editorPage, /status === "completed"/, "Editor must handle completed async jobs");
assert.match(editorPage, /status === "failed"/, "Editor must handle failed async jobs");
assert.match(editorPage, /Generate/);
assert.match(editorPage, /insertEditorOutput/);
assert.match(editorPage, /r2Key:\s*result\.revisedImageR2Key/);
assert.match(editorPage, /url:\s*result\.revisedImageUrl/);
assert.doesNotMatch(
  editorPage,
  /revisedImageDataUrl/,
  "Editor must not accept generated image data URLs as an AI revision fallback",
);
assert.doesNotMatch(editorPage, /Save marked-up image/);
assert.doesNotMatch(editorPage, /Save clean revision/);
assert.doesNotMatch(editorPage, /sourceImageDataUrl,\s*\r?\n\s*markedImageDataUrl,\s*\r?\n\s*preparedImageUrls/);

const manifest = read("plugins/image-markup/appscript/appsscript.json");
assert.match(manifest, /documents\.currentonly/);
assert.doesNotMatch(manifest, /drive\.file/, "Docs-only v1 should not request Drive scope");
assert.doesNotMatch(manifest, /presentations\.currentonly/, "Docs-only v1 must not request Slides scope");

const sessions = read("plugins/image-markup/appscript/sessions.js");
assert.doesNotMatch(sessions, /getImageUrlBlob_|getSlidesImageBlob_|getDriveImageBlob_/, "Docs-only session routing must not call unsupported source loaders");
assert.match(sessions, /createHostedSessionToken_/, "Apps Script must exchange trusted sessions for hosted AI tokens");
assert.match(sessions, /IMAGE_MARKUP_SESSION_EXCHANGE_SECRET/, "Apps Script must use the shared exchange secret");

const webapp = read("plugins/image-markup/appscript/webapp.js");
assert.match(webapp, /runImageMarkupBridgeAction/);
assert.match(webapp, /annotatedImageR2Key/);
assert.match(webapp, /revisedImageR2Key/);
assert.match(webapp, /insertEditorOutput/);
assert.doesNotMatch(
  webapp,
  new RegExp("annotatedImage" + "DataUrl"),
  "Apps Script save should receive R2 keys instead of image payloads",
);

const editorShell = read("plugins/image-markup/appscript/Dialog.html");
assert.match(editorShell, /image-markup-request/);
assert.match(editorShell, /google\.script\.run/);
assert.match(editorShell, /runImageMarkupBridgeAction/);
assert.match(editorShell, /insertEditorOutput/);

const aiTypes = read("lib/image-markup/types.ts");
assert.doesNotMatch(aiTypes, new RegExp("imgv2|modelConfigKey|originalImage" + "DataUrl|annotatedImage" + "DataUrl"));

const pluginReadme = read("plugins/image-markup/README.md");
assert.doesNotMatch(pluginReadme, /ImgV2|IMGV2|IMAGE_GENERATION_PROVIDER|IMAGE_GENERATION_API_KEY/);

console.log("Image Markup contracts verified.");
