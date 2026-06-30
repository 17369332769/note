import type { Annotation, EditBrief, Point } from "./types";

export function drawAnnotations(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId?: string,
) {
  annotations.forEach((annotation) => {
    context.save();
    context.strokeStyle = annotation.color;
    context.fillStyle = annotation.color;
    context.lineWidth = annotation.lineWidth;
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
      context.font = `${Math.max(16, annotation.lineWidth * 7)}px Arial, sans-serif`;
      context.fillText(annotation.text, annotation.position.x, annotation.position.y);
    }

    if (annotation.id === selectedId) {
      const bounds = getAnnotationBounds(annotation);
      context.setLineDash([6, 4]);
      context.strokeStyle = "#2563eb";
      context.lineWidth = 1;
      context.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12);
    }

    context.restore();
  });
}

export function buildEditBrief(
  sessionId: string,
  sourceLabel: string,
  globalInstruction: string,
  annotations: Annotation[],
): EditBrief {
  return {
    sessionId,
    sourceLabel,
    globalInstruction,
    annotations: annotations.map((annotation) => {
      const bounds = getAnnotationBounds(annotation);
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
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.drawImage(sourceImage, 0, 0, width, height);
  drawAnnotations(context, annotations);
  return canvas.toDataURL("image/png");
}

export function getAnnotationBounds(annotation: Annotation) {
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
    x: annotation.position.x,
    y: annotation.position.y - 20,
    width: Math.max(24, annotation.text.length * 9),
    height: 28,
  };
}

export function hitTestAnnotation(annotation: Annotation, point: Point) {
  const bounds = getAnnotationBounds(annotation);
  return (
    point.x >= bounds.x - 8 &&
    point.x <= bounds.x + bounds.width + 8 &&
    point.y >= bounds.y - 8 &&
    point.y <= bounds.y + bounds.height + 8
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
  const headLength = 16;

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
