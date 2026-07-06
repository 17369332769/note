# Workspace Add-ons Lab

这是一个用于孵化 Google Workspace 插件的 Next.js + React 项目。约定是：`plugins/` 下每个目录代表一个插件，每个插件都有自己的介绍页和 Apps Script 脚本目录。

## 项目结构

```text
app/                         Next.js App Router 页面
app/plugins/[slug]/page.tsx  自动生成的插件介绍页
lib/plugins.ts               插件元数据，首页和详情页都从这里读取
plugins/
  meeting-notes/
    README.md
    appscript/
      Code.gs
      appsscript.json
  sheet-cleanup/
    README.md
    appscript/
      Code.gs
      appsscript.json
```

## 本地开发

```powershell
pnpm install
pnpm dev
```

本地开发时打开 `http://localhost:3000` 查看插件目录。线上地址是 `https://www.addlet.pro`。

图片标注编辑器支持用启动命令指定默认插件环境：

```powershell
pnpm dev:addon
pnpm dev:drive
```

`dev:addon` 会使用 `apptype=addon` 的默认环境，`dev:drive` 会使用 `apptype=drive` 的默认环境；这里的 `drive` 只是网页展示/兼容环境类型，不代表使用 Google Drive API 或 Drive 存储。访问 `/image-markup/editor?apptype=addon` 或 `/image-markup/editor?apptype=drive` 仍然可以覆盖启动默认值。生产构建时使用 `pnpm build:addon` 或 `pnpm build:drive`。

Apps Script 里的 `Dialog.html` 是稳定的轻量 iframe 壳，固定加载 `https://www.addlet.pro/image-markup/editor` 页面。因此发布网页时只需要运行 Next.js 构建，不需要把 `.next` 产物再复制进 Apps Script。

## 常用命令

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm build:addon
pnpm build:drive
pnpm check
```

## 新增一个插件

1. 在 `plugins/` 下创建一个新目录，例如 `plugins/gmail-followup/`。
2. 添加 `README.md` 和 `appscript/Code.gs`、`appscript/appsscript.json`。
3. 在 `lib/plugins.ts` 里添加插件元数据。
4. 运行 `pnpm check` 确认网页项目仍然可构建。

## Apps Script 工作流

每个插件的 `appscript` 目录都可以独立用 clasp 管理。

```powershell
cd plugins/meeting-notes/appscript
pnpm exec clasp login
pnpm exec clasp create --type standalone --title "Meeting Notes Assistant"
pnpm exec clasp push
```

`.clasp.json` 包含 Google 项目 ID，默认已被 `.gitignore` 忽略。

## Google Workspace Add-on 说明

Workspace Add-on 的关键配置在 `appsscript.json` 的 `addOns` 字段里。界面代码使用 Apps Script `CardService` 构建卡片；发布前需要在 Apps Script 编辑器中创建测试部署，并按实际功能收敛 OAuth scopes。
