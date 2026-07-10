export type WorkspaceHost = "Gmail" | "Calendar" | "Drive" | "Docs" | "Sheets" | "Slides";
export type PluginHost = WorkspaceHost | "Figma";

export type Plugin = {
  slug: string;
  name: string;
  tagline: string;
  status: "template" | "prototype" | "ready";
  hosts: PluginHost[];
  summary: string;
  audience: string;
  iconPath?: string;
  appScriptPath: string;
  features: string[];
  setup: string[];
};

export const plugins: Plugin[] = [
  {
    slug: "image-markup",
    name: "Image Markup",
    tagline: "Mark up Google Docs images and generate clean AI revisions.",
    status: "ready",
    hosts: ["Docs"],
    iconPath: "/plugins/image-markup/icon.png",
    summary:
      "A Google Docs add-on that scans inline images or starts a local-upload session, opens an external canvas editor, exports annotated PNGs and edit briefs, and can generate clean revised images.",
    audience: "Docs users who need to mark image edits with arrows, boxes, notes, and then insert a clean AI-revised copy back into the document.",
    appScriptPath: "plugins/image-markup/appscript",
    features: [
      "Docs inline image scanning with stable generated labels",
      "Local image upload from the external editor",
      "External canvas editor with freehand, arrow, rectangle, and text tools",
      "AI image-to-image revision flow for clean output images",
      "Recent sessions plus Docs insert actions for annotated or revised copies",
    ],
    setup: [
      "Deploy the Next.js app at https://www.addlet.pro.",
      "Set IMAGE_MARKUP_SESSION_EXCHANGE_SECRET in Apps Script and Next.js, set IMAGE_MARKUP_SESSION_SIGNING_SECRET and RUNNINGHUB_API_KEY in Next.js.",
      "Copy the appscript folder into Apps Script or push it with clasp.",
      "Deploy a Workspace Add-on test deployment for Google Docs.",
      "Open /image-markup/editor from a Docs annotation session to test PNG, revision, and edit brief export.",
    ],
  },
  {
    slug: "figma-image-markup",
    name: "Figma Image Markup",
    tagline: "Send selected Figma layers into the Image Markup editor.",
    status: "prototype",
    hosts: ["Figma"],
    summary:
      "A Figma plugin scaffold that exports the current selection as a PNG, uploads it through the existing Image Markup storage API, and opens the shared annotation editor with the exported image already loaded.",
    audience: "Designers and reviewers who want the same arrows, boxes, freehand notes, text callouts, PNG export, and optional clean-revision flow for Figma selections.",
    appScriptPath: "plugins/figma/image-markup",
    features: [
      "Current Figma selection export to PNG",
      "Upload handoff through the existing Image Markup R2 API",
      "Shared Image Markup editor launch with sourceR2Key preloaded",
      "Generated revision insertion back into the current Figma page",
      "Annotation tools, PNG export, and edit brief behavior reused from Image Markup",
      "Production origin default with a local development origin override",
    ],
    setup: [
      "Deploy the Next.js app with the existing Image Markup R2 upload routes, Neon database, and session signing configured.",
      "Open Figma Desktop, use Plugins > Development > Import plugin from manifest, and select plugins/figma/image-markup/manifest.json.",
      "Run the plugin on a selected frame, component, image, or layer.",
      "Confirm IMAGE_MARKUP_AI_SESSION_LIMIT and IMAGE_MARKUP_SESSION_TOKEN_TTL_SECONDS are set for the desired generation limit and session window.",
      "Confirm the plugin uploads the exported PNG, creates a signed Figma session, opens /image-markup/editor with sourceR2Key loaded, and inserts the generated revision back into Figma.",
    ],
  },
  {
    slug: "meeting-notes",
    name: "Meeting Notes Assistant",
    tagline: "Turn Calendar context into structured Docs notes.",
    status: "template",
    hosts: ["Calendar", "Docs", "Drive"],
    summary:
      "A Google Workspace add-on starter for creating meeting note documents from calendar events and keeping the source event attached to the document workflow.",
    audience: "Teams that repeatedly create agenda, minutes, and action-item documents from calendar meetings.",
    appScriptPath: "plugins/meeting-notes/appscript",
    features: [
      "Calendar event homepage card",
      "Create a linked Google Doc for the selected meeting",
      "Action item capture scaffold",
      "Manifest ready for Workspace Add-on development",
    ],
    setup: [
      "Copy the appscript folder into a new Apps Script project or use clasp from that directory.",
      "Replace placeholder OAuth scopes only after the add-on needs more host permissions.",
      "Deploy as a Google Workspace Add-on test deployment before publishing.",
    ],
  },
  {
    slug: "sheet-cleanup",
    name: "Sheet Cleanup Toolkit",
    tagline: "Give Sheets users one-click cleanup actions from a side panel.",
    status: "template",
    hosts: ["Sheets", "Drive"],
    summary:
      "A starter add-on for spreadsheet hygiene workflows such as trimming whitespace, normalizing headers, and preparing ranges before export.",
    audience: "Operations teams that maintain imported CSV data, lead lists, and recurring reporting sheets.",
    appScriptPath: "plugins/sheet-cleanup/appscript",
    features: [
      "Sheets homepage card",
      "Range cleanup action scaffold",
      "Toast feedback after script actions",
      "Manifest prepared for editor add-on behavior",
    ],
    setup: [
      "Open the appscript folder with clasp or copy files into Apps Script.",
      "Test in a spreadsheet bound to your Google account.",
      "Add cleanup functions gradually and keep each action idempotent.",
    ],
  },
];

export function getPlugin(slug: string) {
  return plugins.find((plugin) => plugin.slug === slug);
}
