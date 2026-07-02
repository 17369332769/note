# Image Markup

Image Markup is a Google Docs add-on for marking image edits and generating clean AI revisions. The CardService sidebar scans the current document or starts a local-upload session, while the image markup canvas opens in an external Next.js editor.

## Structure

```text
plugins/image-markup/
  appscript/
    appsscript.json
    Code.js
    cards.js
    docs.js
    drive.js      # unsupported-source compatibility shim; no Drive API calls
    sessions.js
    webapp.js
app/image-markup/page.tsx
lib/image-markup/
  aiPrompt.ts
  export.ts
  types.ts
```

## Setup

1. Deploy the Next.js app and set `EDITOR_BASE_URL` in Apps Script script properties to the deployed origin.
2. Deploy the Apps Script project as a web app if you need the server-side session proxy, and set `APPS_SCRIPT_WEBAPP_URL` in the Next.js environment to that web app URL.
3. Set `RUNNINGHUB_API_KEY` in the Next.js server environment. Do not store it in Apps Script or browser code.
4. Configure Cloudflare R2 for signed image upload/download URLs. R2 is the storage path for local uploads, annotated images, revised images, and edit brief JSON.
5. Copy or push `appscript/` into an Apps Script project with `clasp`.
6. Create a Google Workspace add-on test deployment for Google Docs.
7. Open the add-on from Docs and test the document-image and local-upload tabs.

The Apps Script manifest intentionally uses narrow scopes: `documents.currentonly`, `script.container.ui`, `script.external_request`, and `script.locale`. It does not request Drive scopes and does not call Drive APIs.

## R2 signed URL configuration

Create a private Cloudflare R2 bucket, then create an R2 API token scoped to that bucket with object read/write permissions. Add these variables to the Next.js server environment:

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=image-markup
```

The editor backend exposes:

- `POST /api/image-markup/r2/upload-url` with `{ "contentType": "image/png", "filename": "source.png" }`
- `POST /api/image-markup/r2/download-url` with `{ "key": "image-markup/2026-07-02/object.png" }`

If browser clients call the signed URLs directly, configure bucket CORS:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://YOUR_DEPLOYED_ORIGIN"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Manual Test Checklist

- Docs document image: open a document with inline images, scan images, create a session, generate a revision, save it, then insert the revised image and edit brief.
- Local upload: open the local-upload tab, upload a PNG/JPEG/WebP image in the editor, generate a revision, save it, then insert it into the current Doc.
- Recent sessions: create several sessions and confirm the card lists source, status, timestamps, output links, and the revised-copy insert action.
- Editor: draw freehand, arrows, rectangles, and text; use undo and redo; export PNG and edit brief JSON; confirm AI failure does not block saving only the annotated image.
