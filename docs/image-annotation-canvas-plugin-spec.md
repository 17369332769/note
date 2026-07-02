# Google Workspace 图片标注插件规格

## 当前定位

`Image Markup` 是一个面向 Google Docs 的图片标注和 AI 修订 add-on。用户可以在 Docs 侧边栏中选择当前文档里的 inline image，或在侧边栏上传本地图片；随后打开 Next.js `/image-markup` 大画布完成标注、生成修订图、保存结果，并把输出插入回当前 Doc。

当前版本不使用 Google Drive 作为图片来源或输出存储，不请求 Drive OAuth scope，也不调用 `DriveApp`。图片对象存储使用 Cloudflare R2，Apps Script 只保存 session metadata 和 R2 object key。

`apptype=drive` 仍可作为网页展示/兼容环境类型使用，用于本地或站点视觉环境切换；它不代表 Google Drive API、Drive 文件来源或 Drive 存储。

## 支持范围

v1 支持：

- Google Docs inline images。
- Docs 侧边栏本地上传。
- Next.js 大画布标注。
- RunningHub AI 修订图。
- R2 signed upload/download URL。
- 将标注图或修订图插入当前 Doc。

v1 不支持：

- Google Drive 选中文件作为来源。
- Google Drive 输出文件。
- Slides、Gmail、Sheets、Google Picker。
- 原位替换 Docs 中的源图片。
- Marketplace 发布。

## 架构

```text
Google Docs
        |
        v
Apps Script Sidebar.html iframe
        |
        v
Next.js /image-markup/sidebar
        |
        | 文档图片: Apps Script 读取 Docs inline image
        | 本地上传: 浏览器上传到 R2
        v
Apps Script session metadata
        |
        v
Next.js /image-markup dialog
        |
        | 标注图 / 修订图 / edit brief 上传到 R2
        v
Apps Script saveEditorOutput 记录 R2 key
        |
        | 插入时通过 R2 signed download URL 获取 blob
        v
Google Docs append image + edit brief
```

## 图片来源

| 来源 | UI | 数据流 |
| --- | --- | --- |
| 文档图片 | `文档图片` tab，按钮文案 `选择文档中的图片` | Apps Script 遍历当前 Doc inline images，编辑器打开时返回 data URL。 |
| 本地上传 | `本地上传` tab，按钮文案 `上传本地图片` | 浏览器请求 R2 signed upload URL，PUT 图片到 R2，再把 `r2Key` 写入 session。 |

侧边栏只有在图片会话准备好后才显示 `打开大画布`。

## 数据模型

```ts
type ImageSource =
  | {
      type: "docs-inline-image";
      documentId: string;
      label: string;
      imageIndex: number;
      width?: number;
      height?: number;
    }
  | {
      type: "local-upload";
      documentId: string;
      label: string;
      filename: string;
      originalFilename: string;
      mimeType: "image/png" | "image/jpeg" | "image/webp";
      r2Key: string;
      size?: number;
    };

type AnnotationSession = {
  id: string;
  userKey: string;
  host: "docs";
  source: ImageSource;
  status: "draft" | "saved" | "inserted" | "failed";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  originalImageR2Key?: string;
  annotatedImageR2Key?: string;
  revisedImageR2Key?: string;
  editBriefR2Key?: string;
  editBrief?: EditBrief;
  editorUrl: string;
  aiRevision?: AiRevisionMetadata;
};
```

## Apps Script 文件

```text
plugins/image-markup/appscript/
  appsscript.json
  Code.js
  Sidebar.html
  Dialog.html
  cards.js
  docs.js
  drive.js      # unsupported-source compatibility shim; no Drive API calls
  sessions.js
  slides.js     # legacy/unused path; output insertion uses R2 helper if called
  webapp.js
```

## OAuth Scopes

Apps Script scopes must stay narrow:

- `https://www.googleapis.com/auth/script.locale`
- `https://www.googleapis.com/auth/script.container.ui`
- `https://www.googleapis.com/auth/script.external_request`
- `https://www.googleapis.com/auth/documents.currentonly`

Do not add:

- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/drive.file`

## R2 Storage

The Next.js backend exposes:

- `POST /api/image-markup/r2/upload-url`
- `POST /api/image-markup/r2/download-url`

Stored objects:

- local-upload source images
- RunningHub input images
- annotated PNG
- revised PNG
- edit brief JSON

Apps Script inserts output into Docs by requesting a short-lived R2 download URL from Next.js, fetching the blob with `UrlFetchApp.fetch`, then appending the image to the current document.

## Editor Requirements

The editor must support:

- Select/move annotations and image.
- Freehand, arrow, rectangle, and text annotations.
- Undo and redo keyboard shortcuts.
- Content zoom where image and annotations scale together.
- Original / annotated / revised preview modes.
- `生成修订图`, `仅保存标注图`, and `保存修订图`.

Text input focus must not block later annotation selection or movement.

## Acceptance Criteria

1. Docs sidebar uses the TSX route `/image-markup/sidebar` inside `Sidebar.html`.
2. Sidebar tabs are `文档图片` and `本地上传`.
3. `选择文档中的图片` lists current Doc inline images.
4. Local upload uses R2, not Drive.
5. `打开大画布` only appears after an image session is prepared.
6. Editor save payload contains R2 keys, not image base64 or Drive file IDs.
7. RunningHub image URLs come from R2 signed download URLs.
8. Docs insertion fetches output from R2 and inserts it into the active Doc.
9. Manifest contains no Drive scopes.
10. Source contains no active `DriveApp` usage.
