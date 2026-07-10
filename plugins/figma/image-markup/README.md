# Figma Image Markup

Figma Image Markup is a Figma plugin scaffold that reuses the existing Addlet Image Markup editor. It exports the current Figma selection as a PNG, uploads it through the existing `/api/image-markup/r2/upload` route, then opens `/image-markup/editor` with the uploaded image preloaded through `sourceR2Key`.

## Structure

```text
plugins/figma/
  image-markup/
    manifest.json
    code.js
    ui.html
app/image-markup/editor/page.tsx
app/api/image-markup/figma/session/route.ts
app/api/image-markup/figma/latest-revision/route.ts
app/api/image-markup/r2/upload/route.ts
app/api/image-markup/r2/object/route.ts
```

## Setup

1. Deploy the Next.js app and configure Cloudflare R2, Neon Postgres, and Image Markup session signing with the same variables used by Image Markup.
2. Confirm `IMAGE_MARKUP_AI_SESSION_LIMIT` and `IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS` are set to the desired per-session generation limit and session window.
3. Open Figma Desktop.
4. Go to `Plugins > Development > Import plugin from manifest...`.
5. Select `plugins/figma/image-markup/manifest.json`.
6. Select a frame, component, image, or layer in a Figma file.
7. Run `Figma Image Markup` from `Plugins > Development`.
8. Click `Export selection`, then `Open editor`.
9. Generate a revision in the Image Markup editor.
10. Return to the Figma plugin panel and click `Insert revision`.

The plugin defaults to `https://www.addlet.pro`.

## Data flow

1. `code.js` exports the first selected node with `exportAsync({ format: "PNG" })`.
2. `ui.html` uploads that PNG to `/api/image-markup/r2/upload` with the `figma/image-markup/source` prefix.
3. `ui.html` exchanges the uploaded R2 key for a signed editing session through `/api/image-markup/figma/session`.
4. The Image Markup editor opens at `/image-markup/editor?sessionId=<id>&sessionToken=<token>&localUpload=1&sourceR2Key=<key>&sourceLabel=<name>`.
5. The shared editor provides markup, PNG export, and the existing AI revision path.
6. `ui.html` queries `/api/image-markup/figma/latest-revision` with the same signed session, downloads the latest generated image, and asks `code.js` to insert it into the current Figma page.

AI revision follows the same signed-session access control used by the Google Workspace add-on. The server rate-limits Figma session creation by client address. By default, `IMAGE_MARKUP_FIGMA_SESSION_LIMIT` falls back to `IMAGE_MARKUP_AI_SESSION_LIMIT`, and `IMAGE_MARKUP_FIGMA_SESSION_WINDOW_SECONDS` falls back to `IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS`.
