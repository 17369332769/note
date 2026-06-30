# Image Markup

Image Markup is a Google Workspace add-on for reviewing images from Drive, Docs, and Slides. The CardService sidebar stays focused on discovery, session management, and Workspace write-back, while the image markup canvas opens in an external Next.js editor.

## Structure

```text
plugins/image-markup/
  appscript/
    appsscript.json
    Code.js
    cards.js
    drive.js
    docs.js
    slides.js
    sessions.js
    webapp.js
app/image-markup/page.tsx
lib/image-markup/
  export.ts
  types.ts
```

## Setup

1. Deploy the Next.js app and set `EDITOR_BASE_URL` in Apps Script script properties to the deployed origin, currently `https://note-bice-seven.vercel.app`.
2. Deploy the Apps Script project as a web app and set `APPS_SCRIPT_WEBAPP_URL` in the Next.js environment to that web app URL.
3. Copy or push `appscript/` into an Apps Script project with `clasp`.
4. Create a Google Workspace add-on test deployment for Drive, Docs, and Slides.
5. Open the add-on from Drive, Docs, or Slides and test the host-specific flows.

The Apps Script manifest intentionally uses narrow scopes: `drive.file`, `documents.currentonly`, `presentations.currentonly`, and `script.external_request`. It does not request full Drive access.

## Manual Test Checklist

- Drive: select an image file, open the add-on, verify unsupported files show a clear error, and create an annotation session for supported images.
- Docs: open a document with inline images, scan images, create a session, save from the editor, then insert the annotated PNG and edit brief.
- Slides: open a deck with image elements, scan images, create a session, save from the editor, then insert the annotated PNG on the source slide or fallback slide.
- Recent sessions: create several sessions and confirm the card lists host, source, status, timestamps, and output links.
- Editor: draw freehand, arrows, rectangles, and text; use undo and redo; export PNG and edit brief JSON.
