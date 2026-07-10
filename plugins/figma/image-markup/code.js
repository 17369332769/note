const DEFAULT_EXPORT_SCALE = 2;
const DEFAULT_INSERT_SIZE = 640;

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

  if (message.type === "insert-image" && message.bytes) {
    await insertImageIntoCurrentPage(message);
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

async function insertImageIntoCurrentPage(message) {
  try {
    const bytes = normalizeBytes(message.bytes);
    const image = figma.createImage(bytes);
    const size = await image.getSizeAsync().catch(() => ({ width: DEFAULT_INSERT_SIZE, height: DEFAULT_INSERT_SIZE }));
    const dimensions = fitDimensions(size.width, size.height);
    const rectangle = figma.createRectangle();
    rectangle.name = sanitizeNodeName(message.label || "Image Markup revision");
    rectangle.resize(dimensions.width, dimensions.height);
    rectangle.fills = [
      {
        type: "IMAGE",
        scaleMode: "FIT",
        imageHash: image.hash,
      },
    ];

    const center = figma.viewport.center;
    rectangle.x = Math.round(center.x - dimensions.width / 2);
    rectangle.y = Math.round(center.y - dimensions.height / 2);
    figma.currentPage.appendChild(rectangle);
    figma.currentPage.selection = [rectangle];
    figma.viewport.scrollAndZoomIntoView([rectangle]);
    figma.notify("Inserted Image Markup revision.");
    figma.ui.postMessage({ type: "insert-success", nodeName: rectangle.name });
  } catch (error) {
    const messageText = error && error.message ? error.message : "Could not insert the revised image.";
    figma.notify(messageText);
    figma.ui.postMessage({ type: "insert-error", error: messageText });
  }
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value && typeof value.length === "number") return new Uint8Array(value);
  return new Uint8Array(Object.values(value || {}));
}

function fitDimensions(width, height) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_INSERT_SIZE;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_INSERT_SIZE;
  const scale = Math.min(1, DEFAULT_INSERT_SIZE / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function sanitizeNodeName(value) {
  return String(value).trim().slice(0, 90) || "Image Markup revision";
}

function sanitizeFilename(value) {
  return String(value)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "figma-selection";
}
