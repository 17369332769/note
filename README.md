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
npm install
npm run dev
```

本地开发时打开 `http://localhost:3000` 查看插件目录。线上地址是 `https://note-bice-seven.vercel.app`。

## 常用命令

```powershell
npm run typecheck
npm run lint
npm run build
npm run check
```

## 新增一个插件

1. 在 `plugins/` 下创建一个新目录，例如 `plugins/gmail-followup/`。
2. 添加 `README.md` 和 `appscript/Code.gs`、`appscript/appsscript.json`。
3. 在 `lib/plugins.ts` 里添加插件元数据。
4. 运行 `npm run check` 确认网页项目仍然可构建。

## Apps Script 工作流

每个插件的 `appscript` 目录都可以独立用 clasp 管理。

```powershell
cd plugins/meeting-notes/appscript
npx clasp login
npx clasp create --type standalone --title "Meeting Notes Assistant"
npx clasp push
```

`.clasp.json` 包含 Google 项目 ID，默认已被 `.gitignore` 忽略。

## Google Workspace Add-on 说明

Workspace Add-on 的关键配置在 `appsscript.json` 的 `addOns` 字段里。界面代码使用 Apps Script `CardService` 构建卡片；发布前需要在 Apps Script 编辑器中创建测试部署，并按实际功能收敛 OAuth scopes。
