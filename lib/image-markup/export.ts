import type { Annotation, EditBrief, Point } from "./types";

const textFontFamily = "Arial, sans-serif";
const textFontWeight = 700;
const textLineHeightRatio = 1.25;
const textHorizontalPadding = 8;
const textVerticalPadding = 6;

export function drawAnnotations(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId?: string,
  visualScale = 1,
) {
  annotations.forEach((annotation) => {
    context.save();
    context.strokeStyle = annotation.color;
    context.fillStyle = annotation.color;
    context.lineWidth = annotation.lineWidth * visualScale;
    context.lineCap = "round";
    context.lineJoin = "round";

    if (annotation.type === "freehand") {
      drawFreehand(context, annotation.points);
    }

    if (annotation.type === "arrow") {
      drawArrow(context, annotation.start, annotation.end);
    }

    if (annotation.type === "rectangle") {
      const box = normalizeBox(annotation.start, annotation.end);
      context.strokeRect(box.x, box.y, box.width, box.height);
    }

    if (annotation.type === "text") {
      context.font = getTextAnnotationFont(annotation.lineWidth, visualScale);
      context.textBaseline = "alphabetic";
      context.fillText(annotation.text, annotation.position.x, annotation.position.y);
    }

    if (annotation.id === selectedId) {
      const bounds = getAnnotationBounds(annotation, visualScale);
      context.setLineDash([6, 4]);
      context.strokeStyle = "#2563eb";
      context.lineWidth = 2;
      context.strokeRect(bounds.x - 6 * visualScale, bounds.y - 6 * visualScale, bounds.width + 12 * visualScale, bounds.height + 12 * visualScale);
    }

    context.restore();
  });
}

export function buildEditBrief(
  sessionId: string,
  sourceLabel: string,
  globalInstruction: string,
  annotations: Annotation[],
  visualScale = 1,
): EditBrief {
  return {
    sessionId,
    sourceLabel,
    globalInstruction,
    annotations: annotations.map((annotation) => {
      const bounds = getAnnotationBounds(annotation, visualScale);
      return {
        type: annotation.type,
        text: annotation.type === "text" ? annotation.text : annotation.text || "",
        bounds,
        color: annotation.color,
      };
    }),
  };
}

export function exportCanvasPng(
  sourceImage: HTMLImageElement,
  annotations: Annotation[],
  width: number,
  height: number,
  contentScale = 1,
  contentOffset: Point = { x: 0, y: 0 },
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.fillStyle = "#f3f4f6";
  context.fillRect(0, 0, width, height);
  const imageFrame = getScaledImageFrame(width, height, contentScale, contentOffset);
  context.drawImage(sourceImage, imageFrame.x, imageFrame.y, imageFrame.width, imageFrame.height);
  context.save();
  context.translate(imageFrame.x, imageFrame.y);
  context.scale(contentScale, contentScale);
  drawAnnotations(context, annotations);
  context.restore();
  return canvas.toDataURL("image/png");
}

export function getScaledImageFrame(
  width: number,
  height: number,
  contentScale: number,
  contentOffset: Point = { x: 0, y: 0 },
) {
  const scaledWidth = width * contentScale;
  const scaledHeight = height * contentScale;
  return {
    x: (width - scaledWidth) / 2 + contentOffset.x,
    y: (height - scaledHeight) / 2 + contentOffset.y,
    width: scaledWidth,
    height: scaledHeight,
  };
}

export function getAnnotationBounds(annotation: Annotation, visualScale = 1) {
  if (annotation.type === "freehand") {
    const xs = annotation.points.map((point) => point.x);
    const ys = annotation.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  if (annotation.type === "arrow" || annotation.type === "rectangle") {
    return normalizeBox(annotation.start, annotation.end);
  }

  return {
    ...getTextAnnotationBounds(annotation.text, annotation.position, annotation.lineWidth, visualScale),
  };
}

export function getTextAnnotationFont(lineWidth: number, visualScale = 1) {
  return `${textFontWeight} ${getTextAnnotationFontSize(lineWidth, visualScale)}px ${textFontFamily}`;
}

export function getTextAnnotationFontSize(lineWidth: number, visualScale = 1) {
  return Math.max(20 * visualScale, lineWidth * 8 * visualScale);
}

export function getTextAnnotationBounds(text: string, position: Point, lineWidth: number, visualScale = 1) {
  const fontSize = getTextAnnotationFontSize(lineWidth, visualScale);
  const textWidth = measureTextWidth(text, lineWidth, visualScale);
  const height = fontSize * textLineHeightRatio;

  return {
    x: position.x - textHorizontalPadding * visualScale,
    y: position.y - fontSize - textVerticalPadding * visualScale,
    width: Math.max(32 * visualScale, textWidth) + textHorizontalPadding * 2 * visualScale,
    height: height + textVerticalPadding * 2 * visualScale,
  };
}

function measureTextWidth(text: string, lineWidth: number, visualScale = 1) {
  const fontSize = getTextAnnotationFontSize(lineWidth, visualScale);
  if (typeof document === "undefined") {
    return Math.max(fontSize * 0.7, text.length * fontSize * 0.62);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Math.max(fontSize * 0.7, text.length * fontSize * 0.62);
  context.font = getTextAnnotationFont(lineWidth, visualScale);
  return context.measureText(text || " ").width;
}

export function hitTestAnnotation(annotation: Annotation, point: Point, tolerance = 8, visualScale = 1) {
  const bounds = getAnnotationBounds(annotation, visualScale);
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}

export function moveAnnotation(annotation: Annotation, delta: Point): Annotation {
  if (annotation.type === "freehand") {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
    };
  }

  if (annotation.type === "arrow" || annotation.type === "rectangle") {
    return {
      ...annotation,
      start: { x: annotation.start.x + delta.x, y: annotation.start.y + delta.y },
      end: { x: annotation.end.x + delta.x, y: annotation.end.y + delta.y },
    };
  }

  return {
    ...annotation,
    position: { x: annotation.position.x + delta.x, y: annotation.position.y + delta.y },
  };
}

function drawFreehand(context: CanvasRenderingContext2D, points: Point[]) {
  if (!points.length) return;

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
}

function drawArrow(context: CanvasRenderingContext2D, start: Point, end: Point) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(22, context.lineWidth * 5);

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function normalizeBox(start: Point, end: Point) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
