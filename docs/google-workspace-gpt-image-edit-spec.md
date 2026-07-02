# Google Workspace RunningHub 图片编辑规格

## 背景

本项目正在构建 `Image Markup`，一个面向 Google Docs 的 Google Workspace add-on。当前计划暂时只做 Docs 场景：用户可以从当前文档中选择 inline image，也可以在外部编辑器中上传本地图片；随后打开 `/image-markup` 编辑器，绘制标注，导出标注 PNG，保存 edit brief，并通过 Apps Script 把结果插回当前 Doc。

下一步产品目标是用 RunningHub 图片编辑 API，把 Google Docs 中“带标注的图片”转换成“干净的修订图”。用户应该可以在 Doc 图片上用箭头、框选、自由画笔和文字备注标出修改意见，然后让系统生成一张应用了这些修改、且不包含任何标注痕迹的新图。

## 目标

为 `Image Markup` 增加 AI 修订图流程：

1. 用户在顶部 tab 中选择图片来源：`文档图片` 或 `本地上传`。
2. 用户从当前 Google Doc 中选择一张 inline image，或在外部编辑器中上传本地图片。
3. Add-on 或 editor 加载源图片。
4. 用户用标注工具和可选的全局说明标记修改意见。
5. 编辑器把干净原图、标注 PNG 和结构化 edit brief 发送到 Next.js API route。
6. API route 调用 RunningHub 图片编辑 API。
7. 编辑器展示生成后的干净修订图，供用户检查。
8. 用户确认后，把修订图和 edit brief 保存回 Apps Script。
9. 编辑器将输出上传到 R2，Apps Script 保存 R2 key，并提供插入回当前 Doc 的操作。

## 非目标

- v1 不原位替换 Docs 中的原图。
- 不把 `RUNNINGHUB_API_KEY` 暴露给 Apps Script 卡片、浏览器 JavaScript、URL 或存储对象。
- 不要求任何 Drive scope。
- 不做通用 Photoshop 式图片编辑器。
- 本规格不支持 Drive 选中文件、Slides 图片、Gmail、Sheets、Google Picker 或 Marketplace 发布。
- 本地上传只在外部 `/image-markup` 编辑器中完成，不在 CardService 卡片中实现文件上传。
- 当可获得干净原图时，不只依赖单张标注截图作为改图输入。

## 当前状态

验证日期：2026-07-02。

| 模块 | 当前行为 | 参考 |
| --- | --- | --- |
| Workspace add-on | 现有 `Image Markup` Apps Script 项目已包含 Docs 相关流程，当前计划只落地 Docs。 | `plugins/image-markup/appscript/` |
| 编辑器 | 现有 Next.js 编辑器支持标注工具、PNG 导出和 edit brief 流程。 | `app/image-markup/page.tsx` |
| 数据模型 | `EditBrief` 已经记录全局说明和标注 bounds。 | `lib/image-markup/types.ts` |
| 保存回调 | 编辑器先上传标注图、修订图和 edit brief 到 R2，Apps Script `saveEditorOutput` 只保存 R2 key 和 session metadata。 | `plugins/image-markup/appscript/webapp.js` |
| AI 修订图 | Next.js API route 调用 RunningHub；RunningHub 输入图片通过 R2 签名 URL 提供。 | `app/api/image-markup/ai-revision/route.ts` |

## 架构

```text
Google Docs
        |
        v
Workspace Add-on CardService
        |
        | OpenLink(sessionId)
        v
Next.js /image-markup editor
        |
        | 上传原图和标注图到 R2，换取短期下载 URL
        v
Cloudflare R2 signed URLs
        |
        | imageUrls + edit brief
        v
Next.js /api/image-markup/ai-revision
        |
        | 服务端 RUNNINGHUB_API_KEY
        v
RunningHub 图片编辑 API
        |
        v
生成干净修订图
        |
        | 用户确认保存
        v
R2 output objects + Apps Script session metadata
        |
        v
Docs 插入操作
```

## 模型与固定参数

使用 RunningHub 标准模型 API：

```text
POST https://www.runninghub.cn/openapi/v2/rhart-image-g-2-official/image-to-image
```

该接口文档地址：

```text
https://www.runninghub.cn/call-api/api-detail/2046514150500524035
```

对应文档中的公开 API 路径为：

```text
/openapi/v2/rhart-image-g-2-official/image-to-image
```

统一固定参数：

```json
{
  "resolution": "1k",
  "quality": "low"
}
```

相关 API 操作：

- 发起图生图任务：`POST /openapi/v2/rhart-image-g-2-official/image-to-image`
- 查询任务结果：`POST /openapi/v2/query`

本规格使用图生图能力来实现“根据标注生成修订图”。实现必须把 `resolution` 固定为 `1k`，把 `quality` 固定为 `low`，不要在 v1 暴露给用户配置。

## 用户流程

### Docs

1. 用户打开 Docs add-on 首页。
2. 页面顶部显示来源 tab：`文档图片`、`本地上传`。
3. 默认选中 `文档图片` tab。
4. 在 `文档图片` tab 中，用户扫描当前 Doc 中的图片。
5. 用户选择一张 inline image 并打开编辑器。
6. 在 `本地上传` tab 中，用户直接打开 editor，并在 editor 内上传本地图片。
7. 用户标注并生成干净修订图。
8. 用户保存结果。
9. Add-on 提供 `插入修订副本` 操作。
10. v1 将修订图和 edit brief 追加到 Doc 中，不替换原始 inline image。

## 图片来源

v1 只支持 Docs 场景下的两个来源：

| 来源 | 所在位置 | 行为 | 回写方式 |
| --- | --- | --- | --- |
| 文档图片 | Docs add-on 顶部 `文档图片` tab | 扫描当前 Doc inline images，选择一张进入 editor。 | 保存输出后插入当前 Doc。 |
| 本地上传 | Docs add-on 顶部 `本地上传` tab，实际上传发生在外部 editor | 打开 editor，用户通过 file input 上传本地图片。 | 保存输出后插入当前 Doc。 |

来源 tab 要放在页面顶部，作为主要导航，而不是放在底部或折叠在设置里。切换 tab 不应清空已打开 editor 中的标注；tab 只决定创建新 session 或打开 editor 时的图片来源。

CardService 不直接承载本地文件上传。`本地上传` tab 的按钮先创建一个 `local-upload` session，再通过 `OpenLink` 打开：

```text
/image-markup?sessionId=<session-id>&localUpload=1&sourceLabel=Uploaded%20image
```

本地上传 session 的 `host` 仍为 `docs`，`source.type` 为 `local-upload`。侧边栏或编辑器先把上传图片写入 R2，再把 `r2Key` 写入 session；保存时同样只回传输出对象的 R2 key。

## 产品决策

| 决策点 | v1 决策 | 理由 |
| --- | --- | --- |
| Prompt 语言 | 模板和模型执行指令使用英文；用户中文标注保留原文，并生成英文说明。 | 英文指令更稳定，保留中文原文便于用户和团队复核。 |
| Prompt 持久化 | 默认不保存完整 prompt；只保存 `promptVersion`、`promptHash`、`provider`、`taskId`、`resolution` 和 `quality`。 | 减少敏感内容落盘，同时保留排查和复现所需的版本线索。 |
| 修订图文件名 | 使用 `<session-id>-revised-ai-runninghub-1k-low.png`。 | 文件名直接标记 AI 来源、服务商、分辨率和质量参数。 |
| 输出格式 | v1 统一输出 PNG；输入支持 PNG、JPEG、WebP，不支持 GIF。 | PNG 最适合 Docs 插入和标注保存，统一格式能降低回写复杂度。 |
| RunningHub 图片 URL | v1 使用 R2 签名下载 URL。浏览器或 Next.js 服务端先上传原图和标注图到 R2，再把短期 `imageUrls` 传给 RunningHub。 | RunningHub 接口需要 HTTP 图片 URL；R2 避免 Drive scopes，并可通过 TTL 控制访问窗口。 |

## 提示词策略

提示词必须明确三种输入角色：

- 干净原图：最终画面的视觉事实来源。
- 标注图：只作为视觉修改说明。
- Edit brief：从标注文字和 bounds 提取出的结构化消歧信息。

标注 PNG 不能被模型当作最终画面。箭头、框线、手写标记、文字标签、选中框、编辑器 UI 和其他标注痕迹都只是修改说明，最终输出中必须移除。

### 改图提示词模板

```text
You are editing an existing image.

Input image 1 is the clean original image.
Input image 2 is an annotated reference image. The arrows, boxes, handwriting, labels, UI outlines, and markup in input image 2 are instructions only. Do not include any annotation marks in the final image.

Task:
Create a clean revised version of input image 1 by applying the requested changes from the annotations.

Global instruction:
{GLOBAL_INSTRUCTION}

Edit instructions:
{EDIT_INSTRUCTIONS}

Preservation requirements:
- Preserve the original subject, composition, camera angle, lighting, color palette, and overall style unless an instruction explicitly asks to change them.
- Preserve the original aspect ratio: {ASPECT_RATIO}.
- Keep unmentioned areas unchanged as much as possible.
- Remove all annotation artifacts, including arrows, boxes, labels, handwriting, selection outlines, handles, and editor UI.
- Do not add new text, logos, watermarks, UI chrome, or random labels unless explicitly requested.
- Output only the final clean revised image.
```

说明：模板正文固定使用英文，以提升模型执行稳定性。用户中文标注必须保留原文，同时由 prompt builder 生成英文说明。

### 标注说明格式

把结构化标注转换成编号列表：

```text
1. Replace the object pointed to by the arrow. Location: x=812, y=144, width=120, height=96.
2. Make the boxed headline larger and easier to read. Location: x=120, y=88, width=420, height=140.
3. Remove the item circled in the lower-left. Location: x=32, y=604, width=180, height=140.
4. Keep the rest of the image unchanged.
```

如果某条标注没有文字，使用中性 fallback：

```text
Apply the visual instruction at this marked area.
```

如果用户提供中文备注，应在 edit brief 中保留原文，并为模型生成英文指令。英文指令生成失败时，直接使用中文原文，不阻塞生成流程。

## Prompt Builder

新增 `lib/image-markup/aiPrompt.ts`：

```ts
import type { EditBrief } from "./types";

export function buildImageEditPrompt(args: {
  editBrief: EditBrief;
  aspectRatio?: string;
}) {
  const instructions = args.editBrief.annotations.length
    ? args.editBrief.annotations
        .map((annotation, index) => {
          const text = annotation.text.trim() || "Apply the visual instruction at this marked area";
          const bounds = annotation.bounds;
          return `${index + 1}. ${text}. Location: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}.`;
        })
        .join("\n")
    : "Apply the user's requested visual changes from the annotated reference image.";

  return `
You are editing an existing image.

Input image 1 is the clean original image.
Input image 2 is an annotated reference image. The arrows, boxes, handwriting, labels, UI outlines, and markup in input image 2 are instructions only. Do not include any annotation marks in the final image.

Task:
Create a clean revised version of input image 1 by applying the requested changes from the annotations.

Global instruction:
${args.editBrief.globalInstruction || "Preserve the original image as much as possible while applying the marked edits."}

Edit instructions:
${instructions}

Preservation requirements:
- Preserve the original subject, composition, camera angle, lighting, color palette, and overall style unless an instruction explicitly asks to change them.
- Preserve the original aspect ratio${args.aspectRatio ? `: ${args.aspectRatio}` : ""}.
- Keep unmentioned areas unchanged as much as possible.
- Remove all annotation artifacts, including arrows, boxes, labels, handwriting, selection outlines, handles, and editor UI.
- Do not add new text, logos, watermarks, UI chrome, or random labels unless explicitly requested.
- Output only the final clean revised image.
`.trim();
}
```

## API 设计

### `POST /api/image-markup/ai-revision`

这是服务端 API route，必须使用 `RUNNINGHUB_API_KEY`。

请求：

```ts
type AiRevisionRequest = {
  sessionId: string;
  originalImageDataUrl: string;
  annotatedImageDataUrl: string;
  preparedImageUrls?: [string, string];
  editBrief: EditBrief;
  aspectRatio?: string;
};
```

响应：

```ts
type AiRevisionResponse =
  | {
      ok: true;
      revisedImageDataUrl: string;
      provider: "runninghub";
      taskId: string;
      promptVersion: "image-markup-ai-edit-v1";
      promptHash: string;
      resolution: "1k";
      quality: "low";
    }
  | {
      ok: false;
      error: string;
    };
```

校验规则：

- `sessionId` 必填。
- `originalImageDataUrl` 必须是图片 data URL。
- `annotatedImageDataUrl` 必须是 PNG 图片 data URL。
- `editBrief.annotations.length` 可以为 `0`，但此时 prompt 必须依赖 `globalInstruction`。
- 拒绝超过配置上限的请求体。
- 绝不记录原始 base64 图片数据。

环境变量：

```text
RUNNINGHUB_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=image-markup
RUNNINGHUB_IMAGE_EDIT_URL=https://www.runninghub.cn/openapi/v2/rhart-image-g-2-official/image-to-image
RUNNINGHUB_QUERY_URL=https://www.runninghub.cn/openapi/v2/query
IMAGE_MARKUP_MAX_IMAGE_BYTES=10485760
```

实现说明：

- 调用 RunningHub 前，如果请求未携带 `preparedImageUrls`，Next.js 服务端必须把 data URL 上传到 R2，并创建短期下载 URL。
- 当编辑器运行在 Apps Script HtmlService iframe 中时，浏览器也可以直接调用 Next.js R2 签名 URL API 上传图片；Apps Script 不参与图片暂存。
- 不允许把 OAuth token、base64 data URL 或未鉴权的长期公开链接直接传给 RunningHub。
- 请求体必须包含：
  - `prompt`
  - `imageUrls`
  - `aspectRatio`
  - `resolution: "1k"`
  - `quality: "low"`
- 请求 header 必须包含 `Authorization: Bearer <RUNNINGHUB_API_KEY>`。
- `imageUrls` 传入两张图，并保持顺序：
  1. 干净原图
  2. 标注参考图
- Prompt 必须明确说明标注图只作为指令。
- RunningHub 返回任务 ID 后，服务端轮询查询接口直到成功、失败或超时。
- 成功后，服务端下载结果图，统一转成 PNG data URL 返回给浏览器。
- 响应中包含 provider、taskId、resolution、quality、promptVersion 和 promptHash，便于调试和追踪。

RunningHub 发起任务 payload：

```ts
type RunningHubImageToImagePayload = {
  prompt: string;
  imageUrls: [string, string];
  aspectRatio: string;
  resolution: "1k";
  quality: "low";
};
```

`imageUrls[0]` 必须是干净原图，`imageUrls[1]` 必须是标注参考图。服务端不允许把 `apiKey` 返回给浏览器。

## 保存 Payload

扩展现有 editor save callback payload：

```ts
type EditorSavePayload = {
  sessionId: string;
  annotatedImageR2Key: string;
  revisedImageR2Key?: string;
  originalImageR2Key?: string;
  editBriefR2Key?: string;
  editBrief: EditBrief;
  aiRevision?: {
    provider: "runninghub";
    taskId: string;
    promptVersion: "image-markup-ai-edit-v1";
    promptHash: string;
    resolution: "1k";
    quality: "low";
    generatedAt: string;
  };
};
```

Apps Script 保存 session metadata，不保存图片二进制。

修订图建议对象名：

```text
<session-id>-revised-ai-runninghub-1k-low.png
```

## Session 模型变更

扩展 `ImageSource`：

```ts
type ImageSource =
  | {
      type: "docs-inline-image";
      documentId: string;
      label: string;
      imageIndex: number;
    }
  | {
      type: "local-upload";
      documentId: string;
      label: "Uploaded image";
      originalFilename: string;
      mimeType: "image/png" | "image/jpeg" | "image/webp";
      r2Key: string;
    };
```

扩展 `AnnotationSession`：

```ts
type AnnotationSession = {
  id: string;
  userKey: string;
  host: "docs";
  source: ImageSource;
  status: "draft" | "saved" | "inserted" | "failed";
  createdAt: string;
  updatedAt: string;
  originalImageR2Key?: string;
  annotatedImageR2Key?: string;
  revisedImageR2Key?: string;
  editBriefR2Key?: string;
  editBrief?: EditBrief;
  editorUrl: string;
  aiRevision?: {
    provider: "runninghub";
    taskId: string;
    promptVersion: "image-markup-ai-edit-v1";
    promptHash: string;
    resolution: "1k";
    quality: "low";
    generatedAt: string;
  };
};
```

状态含义：

- `draft`：会话已创建，编辑器已打开。
- `saved`：标注图和/或修订图已保存到 R2，session 已记录对应 key。
- `inserted`：用户已把输出插入 Doc。
- `failed`：session 遇到可恢复错误。

## 编辑器 UI 要求

在 `/image-markup` 中增加：

- 顶部来源 tab：
  - `文档图片`
  - `本地上传`
- 当 URL 包含 `localUpload=1` 时，默认进入 `本地上传` 来源状态。
- 本地上传 file input，支持 PNG、JPEG、WebP；v1 不支持 GIF。
- 全局说明输入框。
- `生成修订图` 按钮。
- AI 请求进行中的 loading 状态。
- 错误状态和重试入口。
- 修订图预览。
- 查看切换或 tab：
  - 原图
  - 标注图
  - 修订图
- 保留 `仅保存标注图`。
- 成功生成后显示 `保存修订图`。

AI 生成失败时，不应阻塞手动标注导出。

Docs add-on 卡片也需要在顶部提供来源 tab：

- `文档图片`：显示扫描当前 Doc 图片的入口。
- `本地上传`：显示打开 editor 上传图片的入口。

两个 tab 的视觉位置必须在页面主要内容上方，用户进入插件后不需要滚动就能看到。

## Workspace 回写

- 如果存在修订图，默认插入修订图。
- 如果不存在修订图，插入标注图。
- 有 edit brief 时，在图片下方插入说明文本。
- 插入时 Apps Script 通过 Next.js `/api/image-markup/r2/download-url` 获取短期下载 URL，再用 `UrlFetchApp.fetch` 读取 blob。

按钮文案：

- `插入修订副本`
- `插入标注副本`

## 安全与隐私

- `RUNNINGHUB_API_KEY` 只能存放在 Next.js 服务端环境变量中。
- 不要把 RunningHub API key 写入仓库文档、前端代码、Apps Script 文件、query 参数或日志。
- v1 不允许 Apps Script 直接调用 RunningHub；不要把 API key 放进 Apps Script script properties。
- 不要把 OAuth token 传进 editor URL。
- 不要在没有短期 session 校验的情况下，把 R2 object key 暴露给不可信页面。
- 不要记录图片 base64、包含敏感用户文字的完整 prompt 或生成图片 payload。
- 使用窄 Workspace scopes：
  - `https://www.googleapis.com/auth/documents.currentonly`
  - `https://www.googleapis.com/auth/script.external_request`
- 原图、标注图、修订图和 edit brief 都保存在 R2 中；Apps Script 不请求 Drive scopes。

## 错误处理

| 错误 | 用户可见行为 |
| --- | --- |
| 缺少 `RUNNINGHUB_API_KEY` | 显示“当前部署尚未配置 AI 修订图”。 |
| RunningHub 请求失败 | 显示重试按钮，并保留当前标注。 |
| RunningHub 任务超时 | 显示“生成时间较长，请稍后重试”，并允许重新发起生成。 |
| 输入图片过大 | 提示用户使用更小图片或导出低分辨率副本。 |
| 标注图没有文字 | 允许使用视觉标注和全局说明生成。 |
| Session 查询失败 | 提示用户从 Workspace 重新打开图片。 |
| 保存回调失败 | 保留生成图预览，并允许重试保存。 |

## 验收标准

1. 编辑器显示全局说明输入框和 `生成修订图` 操作。
2. Docs add-on 顶部显示 `文档图片` 和 `本地上传` tab。
3. `文档图片` tab 能扫描并选择当前 Doc inline image。
4. `本地上传` tab 能打开 editor，并让用户上传本地图片。
5. 编辑器将原图、标注 PNG 和 edit brief 发送到服务端 API route。
6. API route 使用 `RUNNINGHUB_API_KEY` 调用 RunningHub 图片编辑 API。
7. RunningHub 请求固定 `resolution: "1k"` 和 `quality: "low"`。
8. API key 不会出现在 Apps Script、浏览器 JavaScript、query 参数、文档或日志中。
9. 生成结果会以干净修订图预览形式展示。
10. 正常成功场景下，生成结果不包含可见标注痕迹。
11. AI 生成不可用或失败时，用户仍可保存仅标注输出。
12. API 响应和 session metadata 包含 `promptHash`，但不保存完整 prompt。
13. 保存回调接收并持久化 `revisedImageR2Key`。
14. 修订图对象名使用 `<session-id>-revised-ai-runninghub-1k-low.png`。
15. 修订图统一保存为 PNG。
16. 保存修订图后，最近 session 记录包含 `revisedImageR2Key`。
17. Docs 插入操作在存在修订图时使用修订图。
18. 现有 Docs 的仅标注流程继续可用。
19. `pnpm typecheck`、`pnpm lint` 和 `pnpm build` 通过。

## 测试计划

| 层级 | 测试内容 | 数量 |
| --- | --- | --- |
| 单元测试 | Prompt builder 格式化空标注和非空标注 | +4 |
| 单元测试 | Prompt hash 生成稳定，且不持久化完整 prompt | +2 |
| 单元测试 | Data URL 校验拒绝非图片和超大 payload | +4 |
| API 集成测试 | AI revision endpoint 处理缺少 key、非法 payload、mock taskId 和 mock 成功结果 | +4 |
| API 集成测试 | RunningHub payload 固定 `resolution=1k`、`quality=low`，并按顺序传两张 `imageUrls` | +2 |
| 编辑器测试 | 生成按钮 loading、错误、重试和预览状态 | +4 |
| 编辑器测试 | 本地上传 tab、file input、上传后画布加载 | +3 |
| Apps Script 手测 | Docs add-on 顶部 tab 能在文档图片和本地上传之间切换 | +1 |
| Apps Script 手测 | 包含 `revisedImageR2Key` 的保存 payload 会记录 R2 修订图对象 | +1 |
| Apps Script 手测 | 修订图文件名为 `<session-id>-revised-ai-runninghub-1k-low.png` | +1 |
| Docs 手测 | 插入操作优先使用修订图，而不是标注图 | +1 |
| 回归测试 | 没有 AI 输出时，仅标注保存仍然可用 | +2 |
| 自动合约校验 | `scripts/verify-image-markup-contracts.mjs` 校验 prompt、RunningHub header/body、1k/low、R2 URL flow、Docs-only scope 和 save route 不回显图片 payload | +1 |

## 实施计划

### Phase 1：类型和 Prompt Builder

- 新增 `lib/image-markup/aiPrompt.ts`。
- 扩展共享类型，加入 AI revision metadata。
- 如果仓库已有测试栈，添加单元测试或轻量校验测试。

### Phase 2：服务端 API

- 新增 `app/api/image-markup/ai-revision/route.ts`。
- 校验请求 payload。
- 将 data URL 上传 R2 并创建短期下载 URL。
- 调用 RunningHub 图片编辑 API，固定 `resolution=1k`、`quality=low`。
- 轮询查询任务结果。
- 返回修订图 data URL。

### Phase 3：编辑器 UI

- 增加顶部来源 tab。
- 支持 `localUpload=1` 进入本地上传状态。
- 实现本地上传 file input 并加载到画布。
- 增加全局说明输入框。
- 增加生成操作和预览区域。
- 保存 payload 中包含 AI revision metadata。
- 保留仅标注保存流程。

### Phase 4：Apps Script 保存与回写

- 扩展 `saveEditorOutput`，在存在修订 PNG 时记录修订图 R2 key。
- 持久化 `revisedImageR2Key` 和 `aiRevision`。
- 更新 Docs 插入逻辑，优先使用修订图。
- 更新 session action 按钮文案。

### Phase 5：验证

- 运行本地 typecheck、lint 和 build。
- 在测试部署中手动验证 Docs 流程。
- 确认日志中没有 API key 或图片 base64。

## 回滚方案

- 通过取消设置 `RUNNINGHUB_API_KEY` 或隐藏 `生成修订图` 来关闭 AI 修订能力。
- 保持仅标注保存和插入流程不变。
- 如果 AI route 引发回归，回滚 API/UI 改动，同时保留现有 Apps Script 输出兼容性。

## 已决策事项

1. Prompt 模板和模型执行指令使用英文；中文标注保留原文，并生成英文说明。
2. 不保存完整 prompt；只保存 `promptHash`、`promptVersion`、`provider`、`taskId`、`resolution` 和 `quality`。
3. AI 修订图文件名固定为 `<session-id>-revised-ai-runninghub-1k-low.png`。
4. v1 输出统一为 PNG；输入支持 PNG、JPEG、WebP，不支持 GIF。

## 参考资料

- RunningHub 图片编辑 API 文档：https://www.runninghub.cn/call-api/api-detail/2046514150500524035
- RunningHub OpenAPI 文档：https://www.runninghub.cn/runninghub-api-doc-cn/api-448969294
- 现有 Workspace add-on 规格：`docs/image-annotation-canvas-plugin-spec.md`
