# Google Workspace 图片标注插件规格

## 背景

这个插件是一个面向 Google Workspace 的图片审阅与标注 add-on，主要运行在 Docs、Slides 和 Drive 中。它不是独立图片编辑器，也不是浏览器扩展。插件的目标是帮助用户从当前 Workspace 场景中选择图片，打开一个专门的标注编辑器，完成圈选、箭头、文字备注等操作，然后把标注结果和编辑说明保存回 Google Workspace。

关键限制：Google Workspace add-on 的主界面是 CardService 卡片。卡片适合做导航、列表、按钮、输入框和预览，但不适合承载复杂画布编辑器。因此，Workspace 侧边栏只做控制面板；真正的图片标注画布需要通过 `OpenLink` 打开到一个外部编辑页面，再把结果写回 Drive、Docs 或 Slides。

## 产品定义

插件名称：`Image Markup`

用途：让用户在 Google Workspace 中审阅图片、绘制修改标注、填写简短修改说明，并把标注图和结构化 edit brief 保存回 Workspace。

主要用户：

- 在 Docs 或 Slides 中审阅 AI 生成图片的人。
- 在 Drive 中管理产品图、营销图、素材图的人。
- 需要把视觉修改意见整理成可执行反馈的人。
- 需要把标注截图交给人工设计师或 AI 图片工具继续修改的人。

## Workspace 适配范围

插件应优先实现为 Google Workspace add-on，后端使用 Apps Script。

第一版支持：

- Google Drive：从选中的图片文件开始标注。
- Google Docs：扫描当前文档中的 inline images，选择其中一张标注。
- Google Slides：扫描当前演示文稿中的图片元素，选择其中一张标注。

后续再评估：

- Gmail：标注邮件附件图片。
- Sheets：提取和标注表格中的图片。

## 官方能力评估

Google 有两类相关扩展形态：Google Workspace add-ons 和 Editor add-ons。Workspace add-ons 可以跨 Gmail、Calendar、Docs、Drive、Sheets、Slides 等应用运行，并使用统一的 CardService UI。Editor add-ons 可以在 Docs、Sheets、Slides、Forms 中提供更自定义的 HTML sidebar 或 dialog，但更偏编辑器专用场景。

本项目优先选择 Google Workspace add-on，因为当前仓库已经是 Apps Script add-on 模板结构，并且目标明确是 Workspace 插件。代价是：侧边栏只能做控制面板，不能直接承载完整画布编辑体验。

已确认的平台事实：

- Workspace add-ons 可以扩展 Docs、Drive、Sheets 和 Slides。
- Workspace add-ons 使用 CardService cards 和 widgets。
- Card widgets 支持图片、文本、按钮、输入框、选择控件和导航。
- `OpenLink` 可以打开一个 URL，显示为 overlay 或 full-size 页面。
- Apps Script 可以用 `*.currentonly` scopes 访问当前 Docs/Slides 文件。
- Apps Script 可以访问 Drive 文件，但宽泛 Drive 权限会增加 OAuth 审核和管理员信任成本。
- Docs inline images 和 Slides image page elements 可以通过 Apps Script 服务读取 blob 或图片信息。

## 产品架构

插件包含两层 UI：

1. Workspace 侧边栏：运行在 Docs、Slides 或 Drive 里的 CardService UI。
2. 标注编辑器：由侧边栏通过 `OpenLink` 打开的外部 Web editor。

侧边栏负责：

- 识别当前 host app。
- 在需要时请求当前文件权限。
- 列出当前文件或选中文件中的图片。
- 展示小预览和图片元数据。
- 为选中的图片创建标注会话。
- 打开标注编辑器。
- 在编辑器保存后展示回写操作。
- 把标注图或 edit brief 插入回 Docs/Slides，或保存到 Drive。

标注编辑器负责：

- 绘制箭头、矩形、自由手绘和文字标签。
- 导出标注后的 PNG。
- 导出结构化 edit brief JSON。
- 把结果与会话 ID 关联，供 Workspace add-on 读取或回写。

## 为什么不把画布直接放进 Add-on 卡片

不要尝试把完整 canvas 编辑器直接嵌入 Workspace add-on card。CardService 是 widget-based UI，不提供任意 HTML canvas 交互能力。真正的图片标注体验必须放在外部 Web 页面中。

实现选择：

- 推荐 v1：Workspace Add-on + `OpenLink` 外部标注编辑器。
- 备选后续：如果产品只面向 Docs/Slides 桌面端，可以考虑 Editor Add-on HTML sidebar/dialog。
- 不推荐：只用 CardService 的静态图片、文本输入和按钮模拟标注，体验会过弱。

## 核心功能

### 1. Host-Aware Home Card

插件首页卡片需要识别当前用户所在的 Workspace 应用，并显示对应操作。

必备操作：

- `标注选中的 Drive 图片`
- `扫描当前 Doc 中的图片`
- `扫描当前 Slides 中的图片`
- `查看最近标注会话`
- `设置`

如果当前 host 不支持，应显示清楚说明：当前插件支持 Drive、Docs 和 Slides。

### 2. 图片来源选择

插件应优先支持 Workspace 原生图片来源，而不是优先做通用网页上传。

| 来源 | v1 决策 | 工作方式 | 可实现性 |
| --- | --- | --- | --- |
| Drive 中选中的图片文件 | 必做 | Drive contextual trigger 提供选中文件信息，Apps Script 在授权后读取 image blob | 可实现 |
| 当前 Docs 文档中的 inline images | 必做 | 请求 current document scope，遍历文档 body，收集 inline image blobs | 可实现，但不能保证精确读取用户当前光标选中的图片 |
| 当前 Slides 中的图片元素 | 必做 | 请求 current presentation scope，遍历 slides/page elements，收集 image blobs | 可实现 |
| 用户输入图片 URL | 建议 | Apps Script 用 `UrlFetchApp.fetch(url)` 获取 blob，再创建标注会话 | 可实现，仅限公开可访问 URL |
| 本地上传 | 后续 | 需要在外部编辑器页面提供 file input，不适合 CardService 内完成 | 可实现，但属于 editor 功能 |
| 剪贴板粘贴 | 后续 | 需要外部编辑器页面读取 Clipboard API，不适合 CardService 内完成 | 可实现，但属于 editor 功能 |
| Gmail 图片附件 | 后续 | 需要 Gmail host、附件读取和额外 scopes | 可实现，但应单独设计 host flow |
| Google Picker / Drive Picker | 后续 | 需要 Picker 配置或自定义 Drive 搜索流程 | 可实现，但增加 OAuth 和配置复杂度 |

### 3. 图片列表卡片

Docs 和 Slides 场景中，插件需要生成图片列表卡片。

每个图片项应展示：

- 小预览图，如果安全且尺寸可控。
- 图片位置：文档中的图片序号、幻灯片页码，或 Drive 文件名。
- 图片尺寸，如果 API 可获得。
- 操作按钮：`标注`、`插入标注副本`、`复制编辑说明`。

如果无法可靠映射原始位置，使用稳定生成标签，例如 `当前文档中的图片 3`。

### 4. 创建并打开标注会话

用户点击 `标注` 后，Apps Script 创建一个 annotation session：

1. 读取源图片 blob。
2. 将源图片保存到 Drive 中的插件文件夹，或用户可见的 Workspace 输出文件夹。
3. 创建 session record，存入 Script Properties、User Properties 或 Drive JSON 文件。
4. 通过 `OpenLink` 打开 editor URL，并附带短期 session ID。

editor URL 不能暴露 OAuth token。它只应接收短期 session ID，并通过服务端或 Apps Script web app 路由校验会话。

### 5. 标注编辑器

标注编辑器是 Web 页面，不是 CardService card。

必备工具：

- 选择和移动。
- 自由手绘。
- 箭头。
- 矩形框。
- 文本标签。
- 颜色和线宽。
- 撤销和重做。
- 导出标注 PNG。
- 保存 edit brief。

编辑器需要保存：

- 原图引用。
- 标注后的 PNG。
- 标注元数据 JSON。
- 人类可读的编辑说明文本。

### 6. 保存回 Workspace

编辑器保存后，add-on 应让用户选择输出方式。

Drive：

- 将标注图保存到原图旁边，或保存到插件文件夹。
- 将 edit brief JSON 或 Google Doc 保存到同一位置。

Docs：

- 在当前光标位置插入标注 PNG，或追加到源图片之后。
- 将 edit brief 文本插入到图片下方。
- v1 不替换原图，除非后续实现了可靠的 source-location 映射。

Slides：

- 将标注 PNG 插入到源图片所在 slide。
- 如果空间允许，放在源图片右侧。
- v1 不替换原图，除非后续实现了可靠的 source element 映射。

### 7. 最近会话

插件应显示当前用户的最近标注会话。

每个会话包含：

- 来源应用。
- 来源文件名。
- 创建时间。
- 状态：draft、saved、inserted。
- 原图、标注图和 edit brief 的链接。

## 数据模型

### AnnotationSession

```ts
type AnnotationSession = {
  id: string;
  userEmailHash: string;
  host: "drive" | "docs" | "slides" | "gmail";
  source: ImageSource;
  status: "draft" | "saved" | "inserted" | "failed";
  createdAt: string;
  updatedAt: string;
  originalImageFileId?: string;
  annotatedImageFileId?: string;
  editBriefFileId?: string;
  editorUrl: string;
};
```

### ImageSource

```ts
type ImageSource =
  | {
      type: "drive-file";
      fileId: string;
      filename: string;
      mimeType: string;
    }
  | {
      type: "docs-inline-image";
      documentId: string;
      label: string;
      imageIndex: number;
    }
  | {
      type: "slides-image";
      presentationId: string;
      slideObjectId: string;
      pageElementObjectId: string;
      label: string;
    }
  | {
      type: "public-url";
      url: string;
      fetchedAt: string;
    };
```

### EditBrief

```ts
type EditBrief = {
  sessionId: string;
  sourceLabel: string;
  globalInstruction: string;
  annotations: Array<{
    type: "arrow" | "rectangle" | "freehand" | "text";
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
    color: string;
  }>;
};
```

## Apps Script 文件结构

```text
plugins/
  image-markup/
    README.md
    appscript/
      appsscript.json
      Code.gs
      cards.gs
      drive.gs
      docs.gs
      slides.gs
      sessions.gs
      webapp.gs
```

如果标注编辑器在当前 Next.js 项目中实现，增加：

```text
app/
  image-markup/
    page.tsx
lib/
  image-markup/
    types.ts
    export.ts
```

## Manifest 要求

支持 hosts：

- `drive`
- `docs`
- `slides`

触发器：

- common homepage trigger。
- Drive contextual trigger，用于读取选中文件。
- Docs homepage/context card。
- Slides homepage/context card。

OAuth scopes 应尽量收窄：

- 当前 Docs 文件：`https://www.googleapis.com/auth/documents.currentonly`
- 当前 Slides 文件：`https://www.googleapis.com/auth/presentations.currentonly`
- 用户授权创建或访问的 Drive 文件：`https://www.googleapis.com/auth/drive.file`
- URL 导入或 editor callback：`https://www.googleapis.com/auth/script.external_request`

v1 避免使用完整 Drive scope：`https://www.googleapis.com/auth/drive`。这个 scope 会增加审核和管理员信任成本。

## 可实现性决策

### v1 可实现

- 扫描当前 Doc 中的 inline images。
- 扫描当前 Slides 中的 image page elements。
- 标注 Drive 中选中的图片文件。
- 通过 `OpenLink` 打开外部 editor。
- 将标注 PNG 和 edit brief 保存到 Drive。
- 将标注 PNG 插入回 Docs 或 Slides。

### 可实现但暂缓

- 原位替换 Docs 中的源图片。
- 原位替换 Slides 中的源图片。
- Google Picker。
- Gmail 图片附件。
- 外部编辑器中的本地上传和剪贴板粘贴。

### 不能只靠 CardService 实现

- 自由画布绘制。
- 像素级图片编辑。
- 剪贴板图片粘贴。
- 拖拽上传。
- 多图层标注 UI。

这些能力必须放在外部 editor 中。

## 核心流程

### Drive 流程

1. 用户在 Drive 中选中一个图片文件。
2. 用户打开插件侧边栏。
3. 插件显示选中文件的元数据和预览。
4. 用户点击 `标注`。
5. 插件打开外部 editor。
6. 用户完成标注并保存。
7. 插件刷新后显示输出操作。
8. 用户将标注图保存到原图旁边或插件文件夹。

### Docs 流程

1. 用户打开 Google Doc。
2. 用户打开插件侧边栏。
3. 插件在需要时请求当前文档权限。
4. 插件扫描 inline images 并显示图片列表。
5. 用户选择一张图片并点击 `标注`。
6. editor 打开源图片。
7. 用户保存标注图和 edit brief。
8. 插件将标注图和可选 edit brief 插入文档。

### Slides 流程

1. 用户打开 Google Slides。
2. 用户打开插件侧边栏。
3. 插件在需要时请求当前 presentation 权限。
4. 插件按 slide number 列出图片。
5. 用户选择一张图片并点击 `标注`。
6. editor 打开源图片。
7. 用户保存输出。
8. 插件将标注副本插入到同一张 slide。

## 验收标准

1. Add-on 可以在 Google Drive、Docs 和 Slides 测试部署中出现。
2. Drive 流程能识别选中的图片文件，并对不支持的文件类型显示明确错误。
3. Docs 流程能扫描当前文档，并用稳定标签列出 inline images。
4. Slides 流程能扫描当前 presentation，并按 slide 列出 image page elements。
5. 点击 `标注` 会通过 `OpenLink` 打开外部 editor。
6. Editor 支持箭头、矩形、自由手绘和文本标签。
7. Editor 保存后会生成标注 PNG 和 edit brief JSON。
8. Drive 流程能把输出文件保存到 Drive。
9. Docs 流程能把标注 PNG 插入当前文档。
10. Slides 流程能把标注 PNG 插入源 slide 或 fallback slide。
11. Add-on 会记录当前用户的最近会话。
12. Manifest 使用窄 scopes，v1 不使用完整 Drive scope。
13. 当前目录项目执行 `npm run typecheck`、`npm run lint`、`npm run build` 成功。

## 测试计划

| 层级 | 测试内容 | 数量 |
| --- | --- | --- |
| Apps Script 单测/手测 | Drive 选中文件元数据和不支持类型处理 | +3 |
| Apps Script 单测/手测 | Docs inline image 遍历 | +3 |
| Apps Script 单测/手测 | Slides image page element 遍历 | +3 |
| Apps Script 手测 | 当前文件权限请求流程 | +2 |
| Web editor | 标注工具和 PNG 导出 | +5 |
| E2E | Drive 选图 -> 标注 -> 保存输出 | +1 |
| E2E | Docs 图片 -> 标注 -> 插入标注副本 | +1 |
| E2E | Slides 图片 -> 标注 -> 插入标注副本 | +1 |

## 实施阶段

### Phase 1: Workspace Add-on 骨架

- 创建 `plugins/image-markup/appscript`。
- 添加支持 Drive、Docs、Slides 的 `appsscript.json`。
- 添加不同 host 的首页卡片。
- 添加窄 OAuth scopes。
- 添加 README 和测试部署说明。

### Phase 2: 图片发现

- 实现 Drive 选中图片流程。
- 实现 Docs inline image 扫描。
- 实现 Slides image 扫描。
- 构建图片列表卡片和 unsupported-state cards。

### Phase 3: 会话与 Editor 打开

- 将源图片 blob 保存到 Drive。
- 创建 session record。
- 通过 `OpenLink` 打开 editor。
- 显示最近会话卡片。

### Phase 4: 标注 Editor

- 构建或接入 Web editor。
- 实现标注工具。
- 保存标注 PNG 和 edit brief。
- 将完成状态返回 add-on。

### Phase 5: Workspace 回写

- 将输出保存到 Drive。
- 将标注 PNG 插入 Docs。
- 将标注 PNG 插入 Slides。
- 添加失败恢复卡片。

## v1 不做

- 原位替换源图片。
- 任意网页图片抓取。
- 完整 Drive 搜索或文件夹浏览。
- Gmail 附件图片。
- Sheets 图片。
- Marketplace 发布。
- 移动端优化标注 editor。

## 参考资料

- Google Workspace add-on 类型：https://developers.google.com/workspace/add-ons/concepts/types
- Google Workspace add-on widgets：https://developers.google.com/workspace/add-ons/concepts/widgets
- 构建 Google Workspace add-ons：https://developers.google.com/workspace/add-ons/how-tos/building-workspace-addons
- Apps Script CardService：https://developers.google.com/apps-script/reference/card-service
- Apps Script OpenLink：https://developers.google.com/apps-script/reference/card-service/open-link
- Workspace add-on event objects：https://developers.google.com/workspace/add-ons/concepts/event-objects
- Workspace add-on scopes：https://developers.google.com/workspace/add-ons/concepts/workspace-scopes
- Apps Script Document service：https://developers.google.com/apps-script/reference/document/
- Apps Script InlineImage：https://developers.google.com/apps-script/reference/document/inline-image
- Apps Script Slides service：https://developers.google.com/apps-script/reference/slides/
- Apps Script Slides Image：https://developers.google.com/apps-script/reference/slides/image
