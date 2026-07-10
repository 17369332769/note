const DEFAULT_EXPORT_SCALE = 2;

figma.showUI(__html__, {
  width: 380,
  height: 460,
  themeColors: true,
});

figma.ui.onmessage = async (message) => {
  if (!message || !message.type) return;

  if (message.type === "export-selection") {
    await exportCurrentSelection();
    return;
  }

  if (message.type === "open-editor" && message.url) {
    figma.openExternal(message.url);
    figma.notify("Opened Image Markup editor.");
    return;
  }

  if (message.type === "close") {
    figma.closePlugin();
  }
};

async function exportCurrentSelection() {
  const node = figma.currentPage.selection[0];
  if (!node || typeof node.exportAsync !== "function") {
    figma.notify("Select one frame, component, image, or layer first.");
    figma.ui.postMessage({
      type: "export-error",
      error: "Select one frame, component, image, or layer first.",
    });
    return;
  }

  try {
    const bytes = await node.exportAsync({
      format: "PNG",
      constraint: {
        type: "SCALE",
        value: DEFAULT_EXPORT_SCALE,
      },
    });

    figma.ui.postMessage({
      type: "selection-exported",
      bytes,
      filename: `${sanitizeFilename(node.name || "figma-selection")}.png`,
      sourceLabel: node.name || "Figma selection",
      width: "width" in node ? node.width : undefined,
      height: "height" in node ? node.height : undefined,
    });
  } catch (error) {
    const message = error && error.message ? error.message : "Could not export the selected node.";
    figma.notify(message);
    figma.ui.postMessage({
      type: "export-error",
      error: message,
    });
  }
}

function sanitizeFilename(value) {
  return String(value)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "figma-selection";
}

