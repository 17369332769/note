export type WorkspaceHost = "Gmail" | "Calendar" | "Drive" | "Docs" | "Sheets" | "Slides";

export type Plugin = {
  slug: string;
  name: string;
  tagline: string;
  status: "template" | "prototype" | "ready";
  hosts: WorkspaceHost[];
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
