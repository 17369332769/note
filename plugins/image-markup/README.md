# Image Markup

Image Markup is a Google Docs add-on for marking image edits and generating clean AI revisions. The HtmlService sidebar embeds a Next.js launcher for the selected Docs image or a local-upload session, while the image markup canvas opens in a modal editor.

## Structure

```text
plugins/image-markup/
  appscript/
    appsscript.json
    Code.js
    Dialog.html
    Sidebar.html
    docs.js
    sessions.js
    webapp.js
app/image-markup/editor/page.tsx
lib/image-markup/
  aiPrompt.ts
  export.ts
  types.ts
```

## Setup

1. Deploy the Next.js app at `https://www.addlet.pro`.
2. Set `IMAGE_MARKUP_SESSION_EXCHANGE_SECRET` in both Apps Script script properties and the Next.js server environment. Set `IMAGE_MARKUP_SESSION_SIGNING_SECRET` only in the Next.js server environment.
3. Set the RunningHub API key in the Next.js server environment. Do not store it in Apps Script or browser code.
4. Configure Neon Postgres for structured state such as AI generation quota.
5. Configure Cloudflare R2 for image storage. R2 is the storage path for local uploads, annotated images, revised images, and edit brief JSON.
6. Copy or push `appscript/` into an Apps Script project with `clasp`.
7. Create a Google Workspace add-on test deployment for Google Docs.
8. Open the add-on from Docs and test the document-image and local-upload tabs.

Current Apps Script script properties:

```env
IMAGE_MARKUP_SESSION_EXCHANGE_SECRET=...
```

Do not set `IMAGE_MARKUP_SESSION_SIGNING_SECRET` in Apps Script. It belongs only in the Vercel server environment.

The Apps Script manifest intentionally uses narrow scopes: `documents.currentonly`, `script.container.ui`, `script.external_request`, and `script.locale`. It does not request Drive scopes and does not call Drive APIs.

## R2 storage configuration

Create a private Cloudflare R2 bucket, then create an R2 API token scoped to that bucket with object read/write permissions. Add these variables to the Next.js server environment:

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=image-markup
```

The editor backend exposes:

- `POST /api/image-markup/r2/upload` with multipart form data containing `file`
- `POST /api/image-markup/r2/download-url` with `{ "key": "image-markup/2026-07-02/object.png" }`
- `GET /api/image-markup/r2/object?key=image-markup/.../source.png`

If browser clients call the Next.js API routes from another origin, configure the app origin CORS policy accordingly. The browser uploads images through the Next.js API rather than directly to R2.

## Neon Postgres configuration

Create a Neon database and add its pooled connection string to the Next.js server environment:

```env
DATABASE_URL=postgresql://...
```

The AI revision route creates this table automatically if it does not exist:

```sql
create table if not exists image_markup_ai_session_usage (
  session_id text primary key,
  generation_count integer not null default 0,
  generation_limit integer not null default 10,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`DATABASE_URL` is required for AI revision generation. There is no R2 fallback for generation quota.

## Image generation configuration

The editor calls `/api/image-markup/ai-revision` from the browser, and that server route creates and polls RunningHub tasks. API keys must stay in the Next.js server environment.

AI revision requests require the `sessionId` and signed `sessionToken` created by Apps Script through `/api/image-markup/session-token`. Before calling the provider, the Next.js route verifies that token locally, so the image generation API does not need to call a public Apps Script web app during generation.

```env
IMAGE_MARKUP_SESSION_EXCHANGE_SECRET=...
IMAGE_MARKUP_SESSION_SIGNING_SECRET=...
IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS=7200
IMAGE_MARKUP_AI_SESSION_LIMIT=10
```

The exchange secret is shared only between Apps Script and Next.js. The signing secret must stay only on Next.js.
AI revision generation is limited per editing session. The default limit is 10 generations per `sessionId`.
Figma sessions use the same signing secret but are issued by the Next.js server from uploaded Figma R2 source objects. Figma session creation is rate-limited by client address; optional `IMAGE_MARKUP_FIGMA_SESSION_LIMIT` and `IMAGE_MARKUP_FIGMA_SESSION_WINDOW_SECONDS` overrides fall back to `IMAGE_MARKUP_AI_SESSION_LIMIT` and `IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS`.

RunningHub configuration:

```env
RUNNINGHUB_API_KEY=...
RUNNINGHUB_IMAGE_EDIT_URL=https://www.runninghub.cn/openapi/v2/rhart-image-g-2-official/image-to-image
RUNNINGHUB_QUERY_URL=https://www.runninghub.cn/openapi/v2/query
```

## Manual Test Checklist

- Docs document image: open a document with inline images, scan images, create a session, generate a revision, save it, then insert the revised image and edit brief.
- Local upload: open the local-upload tab, upload a PNG/JPEG/WebP image in the editor, generate a revision, save it, then insert it into the current Doc.
- Recent sessions: create several sessions and confirm the card lists source, status, timestamps, output links, and the revised-copy insert action.
- Editor: draw freehand, arrows, rectangles, and text; use undo and redo; export PNG and edit brief JSON; confirm AI failure does not block saving only the annotated image.
