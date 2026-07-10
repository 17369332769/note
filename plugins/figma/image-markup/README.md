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
app/api/image-markup/r2/upload/route.ts
app/api/image-markup/r2/object/route.ts
```

## Setup

1. Deploy the Next.js app and configure Cloudflare R2 with the same variables used by Image Markup.
2. Open Figma Desktop.
3. Go to `Plugins > Development > Import plugin from manifest...`.
4. Select `plugins/figma/image-markup/manifest.json`.
5. Select a frame, component, image, or layer in a Figma file.
6. Run `Figma Image Markup` from `Plugins > Development`.
7. Click `Export selection` and then `Open editor`.

The plugin defaults to `https://www.addlet.pro`. For local testing, change the Web app URL in the plugin UI to `http://localhost:3000` or `http://127.0.0.1:3000` while `pnpm dev` is running.

## Data flow

1. `code.js` exports the first selected node with `exportAsync({ format: "PNG" })`.
2. `ui.html` uploads that PNG to `/api/image-markup/r2/upload` with the `figma/image-markup/source` prefix.
3. The Image Markup editor opens at `/image-markup/editor?localUpload=1&sourceR2Key=<key>&sourceLabel=<name>`.
4. The shared editor provides markup, PNG export, and the existing AI revision path.

AI revision for this external/local session follows the existing Image Markup access control. In production, local sessions require `IMAGE_MARKUP_ALLOW_LOCAL_AI=1` before the Generate action can call the image generation API.
