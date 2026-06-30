import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const editorBaseUrl = (process.env.EDITOR_BASE_URL || "https://note-bice-seven.vercel.app").replace(/\/+$/, "");
const root = process.cwd();
const inputPath = path.join(root, ".next", "server", "app", "image-markup.html");
const outputPath = path.join(root, "plugins", "image-markup", "appscript", "Editor.html");

let html = await readFile(inputPath, "utf8");

html = html
  .replace(/((?:href|src)=["'])\/(_next\/[^"']+)/g, `$1${editorBaseUrl}/$2`)
  .replace(/(["'])\/(_next\/[^"']+)/g, `$1${editorBaseUrl}/$2`)
  .replace(
    /(<head[^>]*>)/i,
    `$1<base href="${editorBaseUrl}/"><script>window.__IMAGE_MARKUP_BASE_URL=${JSON.stringify(editorBaseUrl)};</script>`,
  );

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html);

console.log(`Wrote ${outputPath}`);
