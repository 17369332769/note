import { createHash } from "node:crypto";
import type { EditBrief } from "./types";

export const imageMarkupPromptVersion = "image-markup-ai-edit-v1" as const;

function hasCjkText(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function buildEnglishInstruction(text: string) {
  if (!text.trim()) return "Apply the visual instruction at this marked area";
  if (!hasCjkText(text)) return text.trim();
  return `Apply this user note at the marked area: "${text.trim()}". Preserve the user's original note exactly as intent.`;
}

export function buildImageEditPrompt(args: {
  editBrief: EditBrief;
  aspectRatio?: string;
}) {
  const instructions = args.editBrief.annotations.length
    ? args.editBrief.annotations
        .map((annotation, index) => {
          const englishInstruction = buildEnglishInstruction(annotation.text);
          const originalText =
            annotation.originalText && annotation.originalText !== annotation.text
              ? ` Original note: "${annotation.originalText}".`
              : "";
          const bounds = annotation.bounds;
          return `${index + 1}. ${englishInstruction}.${originalText} Location: x=${Math.round(bounds.x)}, y=${Math.round(bounds.y)}, width=${Math.round(bounds.width)}, height=${Math.round(bounds.height)}.`;
        })
        .join("\n")
    : "Apply the user's requested visual changes from the annotated reference image.";

  return `
You are editing an existing image.

Input image 1 is the clean original image.
Input image 2 is an annotated reference image. The arrows, boxes, handwriting, labels, UI outlines, and markup in input image 2 are instructions only. Do not include any annotation marks in the final image.

Task:
Create a clean revised version of input image 1 by applying the requested changes from the annotations.

Global instruction:
${args.editBrief.globalInstruction || "Preserve the original image as much as possible while applying the marked edits."}

Edit instructions:
${instructions}

Preservation requirements:
- Preserve the original subject, composition, camera angle, lighting, color palette, and overall style unless an instruction explicitly asks to change them.
- Preserve the original aspect ratio${args.aspectRatio ? `: ${args.aspectRatio}` : ""}.
- Keep unmentioned areas unchanged as much as possible.
- Remove all annotation artifacts, including arrows, boxes, labels, handwriting, selection outlines, handles, and editor UI.
- Do not add new text, logos, watermarks, UI chrome, or random labels unless explicitly requested.
- Output only the final clean revised image.
`.trim();
}

export function hashPrompt(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}
