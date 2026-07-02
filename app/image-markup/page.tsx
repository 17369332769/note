"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowUpRight,
  Download,
  Image as ImageIcon,
  Loader2,
  MousePointer2,
  Pencil,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import {
  buildEditBrief,
  drawAnnotations,
  getAnnotationBounds,
  getTextAnnotationBounds,
  getTextAnnotationFontSize,
  hitTestAnnotation,
  moveAnnotation,
} from "@/lib/image-markup/export";
import type { AiRevisionMetadata, AiRevisionResponse, Annotation, AnnotationTool, Point } from "@/lib/image-markup/types";
import styles from "./ImageMarkup.module.css";

const defaultAnnotationColor = "#d93025";
const defaultAnnotationLineWidth = 6;
const defaultAnnotationText = "Clarify this area";
const defaultContentScale = 0.5;
const minContentScale = 0.25;
const maxContentScale = 2;
const wheelZoomStep = 0.05;
const maxVersionWidth = 1280;
const versionGap = 40;

type PluginAppType = "addon" | "drive";
type SourceTab = "document" | "upload";
type SelectionTarget = "image" | "annotation";
type BridgeAction = "getSession" | "saveEditorOutput";

type AnnotationHistory = {
  annotations: Annotation[];
  redoStack: Annotation[][];
};

type ImageVersion = {
  id: string;
  label: string;
  url: string;
  width: number;
  height: number;
  offset: Point;
};

type VersionFrame = {
  version: ImageVersion;
  x: number;
  y: number;
  width: number;
  height: number;
};

type R2UploadUrlResponse = {
  ok?: boolean;
  error?: string;
  key?: string;
};

type R2DownloadUrlResponse = {
  ok?: boolean;
  error?: string;
  downloadUrl?: string;
};

type SaveResponse = {
  ok?: boolean;
  error?: string;
};

function isTextEntryElement(element: Element | null) {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || (element instanceof HTMLElement && element.isContentEditable);
}

function getPluginAppType(value: string | null): PluginAppType {
  return value === "drive" ? "drive" : "addon";
}

function getDefaultPluginAppType(): PluginAppType {
  return process.env.NEXT_PUBLIC_PLUGIN_APPTYPE === "drive" ? "drive" : "addon";
}

function getPluginStyleEnvironment(appType: PluginAppType) {
  return appType === "drive" ? "addon" : appType;
}

function getR2ObjectUrl(key: string) {
  return `/api/image-markup/r2/object?key=${encodeURIComponent(key)}`;
}

function clampContentScale(value: number) {
  return Math.min(maxContentScale, Math.max(minContentScale, value));
}

function parseAiRevisionResponse(text: string): AiRevisionResponse {
  try {
    return JSON.parse(text) as AiRevisionResponse;
  } catch {
    const message = text.trim().slice(0, 200);
    return { ok: false, error: message || "AI revision failed." };
  }
}

function createVersionId() {
  return crypto.randomUUID();
}

function createEmptyHistory(): AnnotationHistory {
  return { annotations: [], redoStack: [] };
}

function getDisplaySize(image: HTMLImageElement) {
  const scale = Math.min(1, maxVersionWidth / image.naturalWidth);
  return {
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  };
}

function getBaseCanvasSize(versions: ImageVersion[]) {
  const firstReadyVersion = versions.find((version) => version.width > 0 && version.height > 0);
  return {
    width: firstReadyVersion?.width || 1280,
    height: firstReadyVersion?.height || 720,
  };
}

function getVersionFrames(versions: ImageVersion[], contentScale: number, canvasHeight: number): VersionFrame[] {
  let x = 0;
  return versions
    .filter((version) => version.width > 0 && version.height > 0)
    .map((version) => {
      const width = version.width * contentScale;
      const height = version.height * contentScale;
      const frame = {
        version,
        x: x + version.offset.x,
        y: (canvasHeight - height) / 2 + version.offset.y,
        width,
        height,
      };
      x += width + versionGap;
      return frame;
    });
}

function getCanvasSize(versions: ImageVersion[], contentScale: number, histories: Record<string, AnnotationHistory> = {}) {
  const baseSize = getBaseCanvasSize(versions);
  const readyVersions = versions.filter((version) => version.width > 0 && version.height > 0);
  if (!readyVersions.length) return baseSize;
  const baseWidth = readyVersions.reduce((total, version, index) => {
    return total + version.width * contentScale + (index > 0 ? versionGap : 0);
  }, 0);
  const frames = getVersionFrames(versions, contentScale, baseSize.height);
  const imageRight = frames.reduce((right, frame) => Math.max(right, frame.x + frame.width), 0);
  const annotationRight = Object.values(histories).reduce((right, history) => {
    return Math.max(
      right,
      ...history.annotations.map((annotation) => {
        const bounds = getAnnotationBounds(annotation, contentScale);
        return bounds.x + bounds.width;
      }),
    );
  }, 0);
  return {
    width: Math.max(baseSize.width, Math.ceil(baseWidth), Math.ceil(imageRight), Math.ceil(annotationRight + 48)),
    height: baseSize.height,
  };
}

function transformPointBetweenFrames(point: Point, from: VersionFrame, to: VersionFrame): Point {
  return {
    x: to.x + ((point.x - from.x) / from.width) * to.width,
    y: to.y + ((point.y - from.y) / from.height) * to.height,
  };
}

function transformAnnotationBetweenFrames(annotation: Annotation, from: VersionFrame, to: VersionFrame): Annotation {
  if (annotation.type === "freehand") {
    return {
      ...annotation,
      points: annotation.points.map((point) => transformPointBetweenFrames(point, from, to)),
    };
  }

  if (annotation.type === "arrow" || annotation.type === "rectangle") {
    return {
      ...annotation,
      start: transformPointBetweenFrames(annotation.start, from, to),
      end: transformPointBetweenFrames(annotation.end, from, to),
    };
  }

  return {
    ...annotation,
    position: transformPointBetweenFrames(annotation.position, from, to),
  };
}

function getFrameAtPoint(frames: VersionFrame[], point: Point) {
  return frames.find(
    (frame) =>
      point.x >= frame.x &&
      point.x <= frame.x + frame.width &&
      point.y >= frame.y &&
      point.y <= frame.y + frame.height,
  );
}

export default function WorkspaceImageEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const canvasStageRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textEditorRef = useRef<HTMLInputElement | null>(null);
  const imageElementsRef = useRef<Record<string, HTMLImageElement>>({});
  const dragRef = useRef<{ mode: "draw" | "move" | "move-image"; start: Point; selectedId?: string; versionId: string } | null>(null);
  const renderCanvasRef = useRef<() => void>(() => {});

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, []);

  const sessionId = params.get("sessionId") || "local-session";
  const sourceLabel = params.get("sourceLabel") || "Workspace image";
  const localUpload = params.get("localUpload") === "1";
  const bridgeEnabled = params.get("bridge") === "1";
  const appType = params.has("apptype") ? getPluginAppType(params.get("apptype")) : getDefaultPluginAppType();
  const styleEnvironment = getPluginStyleEnvironment(appType);

  const [tool, setTool] = useState<AnnotationTool>("freehand");
  const [versions, setVersions] = useState<ImageVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>();
  const [histories, setHistories] = useState<Record<string, AnnotationHistory>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget>();
  const [editingTextId, setEditingTextId] = useState<string>();
  const [textEditFocusKey, setTextEditFocusKey] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving-annotated" | "saving-revised" | "saved-annotated" | "saved-revised" | "failed">("idle");
  const [sourceTab] = useState<SourceTab>(localUpload ? "upload" : "document");
  const [revisionState, setRevisionState] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [revisionError, setRevisionError] = useState("");
  const [revisedImageUrl, setRevisedImageUrl] = useState("");
  const [aiRevision, setAiRevision] = useState<AiRevisionMetadata>();
  const [localFileMeta, setLocalFileMeta] = useState<{ name: string; type: string }>();
  const [contentScale, setContentScale] = useState(defaultContentScale);
  const [canvasLayout, setCanvasLayout] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    canvasWidth: number;
    canvasHeight: number;
  }>();

  const activeVersion = versions.find((version) => version.id === activeVersionId);
  const activeHistory = activeVersionId ? histories[activeVersionId] || createEmptyHistory() : createEmptyHistory();
  const { annotations, redoStack } = activeHistory;
  const activeTextEditorAnnotation = annotations.find(
    (annotation): annotation is Extract<Annotation, { type: "text" }> =>
      annotation.id === editingTextId && annotation.type === "text",
  );
  const editingTextAnnotation = editingTextId ? activeTextEditorAnnotation : undefined;

  const updateCanvasLayout = useCallback(() => {
    const frame = canvasFrameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    const frameRect = frame.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const next = {
      left: canvasRect.left - frameRect.left,
      top: canvasRect.top - frameRect.top,
      width: canvasRect.width,
      height: canvasRect.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };

    setCanvasLayout((current) => {
      if (
        current &&
        Math.abs(current.left - next.left) < 0.5 &&
        Math.abs(current.top - next.top) < 0.5 &&
        Math.abs(current.width - next.width) < 0.5 &&
        Math.abs(current.height - next.height) < 0.5 &&
        current.canvasWidth === next.canvasWidth &&
        current.canvasHeight === next.canvasHeight
      ) {
        return current;
      }

      return next;
    });
  }, []);

  const setInitialImage = useCallback((url: string) => {
    const id = createVersionId();
    imageElementsRef.current = {};
    setVersions([{ id, label: "原图", url, width: 0, height: 0, offset: { x: 0, y: 0 } }]);
    setHistories({ [id]: createEmptyHistory() });
    setActiveVersionId(id);
    setSelectedId(undefined);
    setSelectionTarget(undefined);
    setEditingTextId(undefined);
    setRevisedImageUrl("");
    setAiRevision(undefined);
    setRevisionState("idle");
    setContentScale(defaultContentScale);
  }, []);

  const updateHistory = useCallback((versionId: string, updater: (history: AnnotationHistory) => AnnotationHistory) => {
    setHistories((current) => ({
      ...current,
      [versionId]: updater(current[versionId] || createEmptyHistory()),
    }));
  }, []);

  const updateWithHistory = useCallback(
    (versionId: string, next: Annotation[]) => {
      updateHistory(versionId, () => ({ annotations: next, redoStack: [] }));
    },
    [updateHistory],
  );

  const applyContentScale = useCallback((nextScaleInput: number) => {
    setContentScale((currentScale) => {
      const nextScale = clampContentScale(nextScaleInput);
      if (Math.abs(nextScale - currentScale) < 0.001) return currentScale;

      const oldCanvasSize = getCanvasSize(versions, currentScale, histories);
      const oldFrames = getVersionFrames(versions, currentScale, oldCanvasSize.height);
      const ratio = nextScale / currentScale;
      const nextVersions = versions.map((version) => ({
        ...version,
        offset: {
          x: version.offset.x * ratio,
          y: version.offset.y * ratio,
        },
      }));
      const nextCanvasSize = getCanvasSize(nextVersions, nextScale, histories);
      const nextFrames = getVersionFrames(nextVersions, nextScale, nextCanvasSize.height);
      const frameById = new Map(oldFrames.map((frame) => [frame.version.id, frame]));
      const nextFrameById = new Map(nextFrames.map((frame) => [frame.version.id, frame]));

      setVersions(nextVersions);
      setHistories((current) =>
        Object.fromEntries(
          Object.entries(current).map(([versionId, history]) => {
            const oldFrame = frameById.get(versionId);
            const nextFrame = nextFrameById.get(versionId);
            if (!oldFrame || !nextFrame) return [versionId, history];
            return [
              versionId,
              {
                annotations: history.annotations.map((annotation) =>
                  transformAnnotationBetweenFrames(annotation, oldFrame, nextFrame),
                ),
                redoStack: history.redoStack.map((stack) =>
                  stack.map((annotation) => transformAnnotationBetweenFrames(annotation, oldFrame, nextFrame)),
                ),
              },
            ];
          }),
        ),
      );
      setEditingTextId(undefined);
      return nextScale;
    });
  }, [histories, versions]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const canvasSize = getCanvasSize(versions, contentScale, histories);
    const frames = getVersionFrames(versions, contentScale, canvasSize.height);
    if (canvas.width !== canvasSize.width) canvas.width = canvasSize.width;
    if (canvas.height !== canvasSize.height) canvas.height = canvasSize.height;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f3f4f6";
    context.fillRect(0, 0, canvas.width, canvas.height);

    frames.forEach((frame) => {
      const image = imageElementsRef.current[frame.version.id];
      if (!image) return;

      context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
      if (selectionTarget === "image" && frame.version.id === activeVersionId) {
        context.save();
        context.setLineDash([8, 5]);
        context.strokeStyle = "#2563eb";
        context.lineWidth = 2;
        context.strokeRect(frame.x + 1, frame.y + 1, frame.width - 2, frame.height - 2);
        context.restore();
      }
    });

    frames.forEach((frame) => {
      drawAnnotations(
        context,
        histories[frame.version.id]?.annotations || [],
        frame.version.id === activeVersionId && selectionTarget === "annotation" ? selectedId : undefined,
        contentScale,
      );
    });
  }, [activeVersionId, contentScale, histories, selectedId, selectionTarget, versions]);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  useEffect(() => {
    versions.forEach((version) => {
      if (imageElementsRef.current[version.id]) return;

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        imageElementsRef.current[version.id] = image;
        const size = getDisplaySize(image);
        setVersions((current) =>
          current.map((item) =>
            item.id === version.id && (item.width !== size.width || item.height !== size.height)
              ? { ...item, ...size }
              : item,
          ),
        );
        requestAnimationFrame(() => {
          renderCanvasRef.current();
          updateCanvasLayout();
        });
      };
      image.src = version.url;
    });
  }, [updateCanvasLayout, versions]);

  useEffect(() => {
    if (sessionId === "local-session") return;

    let cancelled = false;
    const sessionRequest = bridgeEnabled
      ? callAppsScriptBridge<{ originalImage?: { dataUrl?: string; r2Key?: string } }>("getSession", { sessionId, includeImage: true })
      : fetch(`/api/image-markup/session?sessionId=${encodeURIComponent(sessionId)}`).then((response) => (response.ok ? response.json() : null));

    sessionRequest
      .then(async (data) => {
        if (cancelled) return;
        if (data?.originalImage?.dataUrl) {
          setInitialImage(data.originalImage.dataUrl);
          return;
        }
        if (data?.originalImage?.r2Key) {
          setInitialImage(getR2ObjectUrl(data.originalImage.r2Key));
        }
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [bridgeEnabled, sessionId, setInitialImage]);

  useLayoutEffect(() => {
    renderCanvas();
    updateCanvasLayout();
  }, [renderCanvas, updateCanvasLayout]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage || !versions.length) return;

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      applyContentScale(Number((contentScale + direction * wheelZoomStep).toFixed(2)));
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [applyContentScale, contentScale, versions.length]);

  useLayoutEffect(() => {
    updateCanvasLayout();

    const canvas = canvasRef.current;
    const frame = canvasFrameRef.current;
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateCanvasLayout);
    if (resizeObserver) {
      if (canvas) resizeObserver.observe(canvas);
      if (frame) resizeObserver.observe(frame);
    }

    window.addEventListener("resize", updateCanvasLayout);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateCanvasLayout);
    };
  }, [updateCanvasLayout]);

  useEffect(() => {
    if (!editingTextId) return;
    requestAnimationFrame(() => {
      textEditorRef.current?.focus();
      textEditorRef.current?.select();
    });
  }, [editingTextId, textEditFocusKey]);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function updateTextAnnotation(id: string, text: string) {
    if (!activeVersionId) return;
    updateHistory(activeVersionId, (current) => ({
      annotations: current.annotations.map((annotation) =>
        annotation.id === id && annotation.type === "text" ? { ...annotation, text } : annotation,
      ),
      redoStack: [],
    }));
  }

  function finishTextEditing() {
    setEditingTextId(undefined);
  }

  function startTextEditing(id: string) {
    setSelectedId(id);
    setSelectionTarget("annotation");
    setEditingTextId(id);
    setTextEditFocusKey((current) => current + 1);
    dragRef.current = null;
  }

  function beginPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvasPoint = getCanvasPoint(event);
    const canvasSize = getCanvasSize(versions, contentScale, histories);
    const frame = getFrameAtPoint(getVersionFrames(versions, contentScale, canvasSize.height), canvasPoint);
    const versionId = frame?.version.id || activeVersionId;
    if (!versionId) {
      setSelectedId(undefined);
      setSelectionTarget(undefined);
      setEditingTextId(undefined);
      return;
    }

    const point = canvasPoint;
    const frameHistory = histories[versionId] || createEmptyHistory();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveVersionId(versionId);

    const selected = [...frameHistory.annotations]
      .reverse()
      .find((annotation) => hitTestAnnotation(annotation, point, 8, contentScale));

    if (tool === "select") {
      setSelectedId(selected?.id);
      setSelectionTarget(selected ? "annotation" : frame ? "image" : undefined);
      setEditingTextId(undefined);
      dragRef.current = selected
        ? { mode: "move", start: point, selectedId: selected.id, versionId }
        : frame
          ? { mode: "move-image", start: canvasPoint, versionId }
          : null;
      return;
    }

    if (tool === "text" && selected?.type === "text") {
      startTextEditing(selected.id);
      return;
    }

    const id = createVersionId();
    const annotation =
      tool === "freehand"
        ? { id, type: "freehand" as const, color: defaultAnnotationColor, lineWidth: defaultAnnotationLineWidth, points: [point] }
        : tool === "arrow"
          ? { id, type: "arrow" as const, color: defaultAnnotationColor, lineWidth: defaultAnnotationLineWidth, start: point, end: point }
          : tool === "rectangle"
            ? {
                id,
                type: "rectangle" as const,
                color: defaultAnnotationColor,
                lineWidth: defaultAnnotationLineWidth,
                start: point,
                end: point,
              }
            : {
                id,
                type: "text" as const,
                color: defaultAnnotationColor,
                lineWidth: defaultAnnotationLineWidth,
                position: point,
                text: defaultAnnotationText,
              };

    setSelectedId(id);
    setSelectionTarget("annotation");
    updateWithHistory(versionId, [...frameHistory.annotations, annotation]);
    if (annotation.type === "text") {
      requestAnimationFrame(() => startTextEditing(id));
    } else {
      setEditingTextId(undefined);
    }
    dragRef.current = annotation.type === "text" ? null : { mode: "draw", start: point, selectedId: id, versionId };
  }

  function movePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const canvasPoint = getCanvasPoint(event);
    const point = canvasPoint;

    if (drag.mode === "move-image") {
      const canvasSize = getCanvasSize(versions, contentScale, histories);
      const frame = getVersionFrames(versions, contentScale, canvasSize.height).find((item) => item.version.id === drag.versionId);
      if (!frame) return;
      const rawDelta = { x: canvasPoint.x - drag.start.x, y: canvasPoint.y - drag.start.y };
      const delta = {
        x: Math.min(canvasSize.width - (frame.x + frame.width), Math.max(-frame.x, rawDelta.x)),
        y: Math.min(canvasSize.height - (frame.y + frame.height), Math.max(-frame.y, rawDelta.y)),
      };
      dragRef.current = { ...drag, start: { x: drag.start.x + delta.x, y: drag.start.y + delta.y } };
      setVersions((current) =>
        current.map((version) =>
          version.id === drag.versionId
            ? { ...version, offset: { x: version.offset.x + delta.x, y: version.offset.y + delta.y } }
            : version,
        ),
      );
      return;
    }

    if (drag.mode === "move" && drag.selectedId) {
      const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
      dragRef.current = { ...drag, start: point };
      updateHistory(drag.versionId, (current) => ({
        annotations: current.annotations.map((annotation) =>
          annotation.id === drag.selectedId ? moveAnnotation(annotation, delta) : annotation,
        ),
        redoStack: [],
      }));
      return;
    }

    updateHistory(drag.versionId, (current) => ({
      annotations: current.annotations.map((annotation) => {
        if (annotation.id !== drag.selectedId) return annotation;
        if (annotation.type === "freehand") return { ...annotation, points: [...annotation.points, point] };
        if (annotation.type === "arrow" || annotation.type === "rectangle") return { ...annotation, end: point };
        return annotation;
      }),
      redoStack: [],
    }));
  }

  function endPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  const undo = useCallback(() => {
    if (!activeVersionId) return;
    updateHistory(activeVersionId, (current) => {
      if (!current.annotations.length) return current;
      const nextAnnotations = current.annotations.slice(0, -1);
      return {
        annotations: nextAnnotations,
        redoStack: [current.annotations, ...current.redoStack],
      };
    });
  }, [activeVersionId, updateHistory]);

  const redo = useCallback(() => {
    if (!activeVersionId) return;
    updateHistory(activeVersionId, (current) => {
      const next = current.redoStack[0];
      if (!next) return current;
      return {
        annotations: next,
        redoStack: current.redoStack.slice(1),
      };
    });
  }, [activeVersionId, updateHistory]);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (isTextEntryElement(document.activeElement)) return;
      const modifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (!modifierPressed || event.altKey) return;

      if ((key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey)) {
        event.preventDefault();
        redo();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [redo, undo]);

  function getVersionImage(versionId?: string) {
    if (!versionId) return null;
    return imageElementsRef.current[versionId] || null;
  }

  function getActiveAnnotatedPngDataUrl() {
    if (!activeVersion) return "";
    const image = getVersionImage(activeVersion.id);
    if (!image) return "";
    const canvasSize = getCanvasSize(versions, contentScale, histories);
    const frame = getVersionFrames(versions, contentScale, canvasSize.height).find((item) => item.version.id === activeVersion.id);
    if (!frame) return "";

    const canvas = document.createElement("canvas");
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.fillStyle = "#f3f4f6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
    drawAnnotations(context, annotations, undefined, contentScale);
    return canvas.toDataURL("image/png");
  }

  function exportPng() {
    const dataUrl = getActiveAnnotatedPngDataUrl();
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${activeVersion?.label || sourceLabel}-annotated.png`;
    anchor.click();
  }

  function chooseLocalImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setSaveState("failed");
      return;
    }
    setLocalFileMeta({ name: file.name, type: file.type });

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setInitialImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function getAspectRatio(version?: ImageVersion) {
    if (!version || !version.width || !version.height) return undefined;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(version.width, version.height);
    return `${Math.round(version.width / divisor)}:${Math.round(version.height / divisor)}`;
  }

  function imageUrlToPngDataUrl(url: string) {
    return new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, image.naturalWidth);
        canvas.height = Math.max(1, image.naturalHeight);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare revised image for saving."));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("Could not load revised image for saving."));
      image.src = url;
    });
  }

  function callAppsScriptBridge<T>(action: BridgeAction, payload: unknown) {
    return new Promise<T>((resolve, reject) => {
      const requestId = createVersionId();
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        reject(new Error("Apps Script bridge timed out."));
      }, 60000);

      function handleMessage(event: MessageEvent) {
        const message = event.data;
        if (!message || message.type !== "image-markup-response" || message.id !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);
        if (message.ok) {
          resolve(message.result as T);
        } else {
          reject(new Error(message.error || "Apps Script bridge request failed."));
        }
      }

      window.addEventListener("message", handleMessage);
      window.parent.postMessage(
        {
          type: "image-markup-request",
          id: requestId,
          action,
          payload,
        },
        "*",
      );
    });
  }

  async function getActiveImageDataUrl() {
    if (!activeVersion) return "";
    if (activeVersion.url.startsWith("data:")) return activeVersion.url;
    return imageUrlToPngDataUrl(activeVersion.url);
  }

  async function getR2DownloadUrl(key: string) {
    const response = await fetch("/api/image-markup/r2/download-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ttlSeconds: 3600 }),
    });
    const result = (await response.json().catch(() => ({}))) as R2DownloadUrlResponse;
    if (!response.ok || !result.ok || !result.downloadUrl) {
      throw new Error(result.error || "图片下载地址创建失败。");
    }
    return result.downloadUrl;
  }

  async function dataUrlToBlob(dataUrl: string) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  async function uploadBlobToR2(blob: Blob, filename: string, prefix: string) {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    const formData = new FormData();
    formData.set("file", file);
    formData.set("filename", filename);
    formData.set("prefix", prefix);
    formData.set("contentType", blob.type || "image/png");

    const response = await fetch("/api/image-markup/r2/upload", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => ({}))) as R2UploadUrlResponse;
    if (!response.ok || !result.ok || !result.key) {
      throw new Error(result.error || "图片上传失败，请重试。");
    }

    return result.key;
  }

  async function uploadDataUrlToR2(dataUrl: string, filename: string, prefix: string) {
    return uploadBlobToR2(await dataUrlToBlob(dataUrl), filename, prefix);
  }

  async function uploadJsonToR2(value: unknown, filename: string, prefix: string) {
    return uploadBlobToR2(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), filename, prefix);
  }

  async function prepareRunningHubImagesWithR2(originalImageDataUrl: string, annotatedImageDataUrl: string) {
    const [originalKey, annotatedKey] = await Promise.all([
      uploadDataUrlToR2(originalImageDataUrl, `${sessionId}-runninghub-original.png`, "image-markup/runninghub"),
      uploadDataUrlToR2(annotatedImageDataUrl, `${sessionId}-runninghub-annotated.png`, "image-markup/runninghub"),
    ]);
    return Promise.all([getR2DownloadUrl(originalKey), getR2DownloadUrl(annotatedKey)]) as Promise<[string, string]>;
  }

  async function uploadEditorOutputsToR2(payload: {
    annotatedPngDataUrl: string;
    revisedPngDataUrl?: string;
    originalImageDataUrl?: string;
    editBrief: unknown;
  }) {
    const [annotatedImageR2Key, revisedImageR2Key, originalImageR2Key, editBriefR2Key] = await Promise.all([
      uploadDataUrlToR2(payload.annotatedPngDataUrl, `${sessionId}-annotated.png`, "image-markup/output"),
      payload.revisedPngDataUrl
        ? uploadDataUrlToR2(payload.revisedPngDataUrl, `${sessionId}-revised.png`, "image-markup/output")
        : Promise.resolve(undefined),
      payload.originalImageDataUrl
        ? uploadDataUrlToR2(payload.originalImageDataUrl, `${sessionId}-original.png`, "image-markup/source")
        : Promise.resolve(undefined),
      uploadJsonToR2(payload.editBrief, `${sessionId}-edit-brief.json`, "image-markup/output"),
    ]);

    return {
      annotatedImageR2Key,
      revisedImageR2Key,
      originalImageR2Key,
      editBriefR2Key,
    };
  }

  async function generateRevision() {
    if (!activeVersion) {
      setRevisionError("请先选择一张图片。");
      setRevisionState("failed");
      return;
    }

    setRevisionState("generating");
    setRevisionError("");

    const brief = buildEditBrief(sessionId, activeVersion.label, "", annotations, contentScale);
    const originalImageDataUrl = await getActiveImageDataUrl();
    const annotatedImageDataUrl = getActiveAnnotatedPngDataUrl();

    try {
      const preparedImageUrls = await prepareRunningHubImagesWithR2(originalImageDataUrl, annotatedImageDataUrl);
      const response = await fetch("/api/image-markup/ai-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          preparedImageUrls,
          editBrief: brief,
          aspectRatio: getAspectRatio(activeVersion),
        }),
      });
      const responseText = await response.text();
      const result = parseAiRevisionResponse(responseText);
      if (!response.ok || !result.ok) {
        throw new Error(result.ok ? "AI revision failed." : result.error);
      }

      const metadata: AiRevisionMetadata = {
        provider: result.provider,
        taskId: result.taskId,
        promptVersion: result.promptVersion,
        promptHash: result.promptHash,
        resolution: result.resolution,
        quality: result.quality,
        generatedAt: result.generatedAt,
      };
      const nextId = createVersionId();
      const nextVersion: ImageVersion = {
        id: nextId,
        label: `修订图 ${versions.length}`,
        url: result.revisedImageDataUrl,
        width: activeVersion.width,
        height: activeVersion.height,
        offset: { x: 0, y: 0 },
      };
      setVersions((current) => [...current, nextVersion]);
      setHistories((current) => ({ ...current, [nextId]: createEmptyHistory() }));
      setActiveVersionId(nextId);
      setSelectedId(undefined);
      setSelectionTarget("image");
      setEditingTextId(undefined);
      setRevisedImageUrl(result.revisedImageDataUrl);
      setAiRevision(metadata);
      setRevisionState("ready");
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "生成修订图失败，请重试。");
      setRevisionState("failed");
    }
  }

  async function saveToWorkspace(mode: "annotated" | "revised") {
    if (!activeVersion) return;
    if (mode === "revised" && !revisedImageUrl) {
      setSaveState("failed");
      return;
    }

    renderCanvas();
    setSaveState(mode === "revised" ? "saving-revised" : "saving-annotated");
    const brief = buildEditBrief(sessionId, activeVersion.label, "", annotations, contentScale);

    try {
      const annotatedPngDataUrl = getActiveAnnotatedPngDataUrl();
      const revisedPngDataUrl = mode === "revised" ? await imageUrlToPngDataUrl(versions[versions.length - 1]?.url || activeVersion.url) : undefined;
      const firstVersion = versions[0];
      const r2Outputs = await uploadEditorOutputsToR2({
        annotatedPngDataUrl,
        revisedPngDataUrl,
        originalImageDataUrl: sourceTab === "upload" && firstVersion?.url.startsWith("data:") ? firstVersion.url : undefined,
        editBrief: brief,
      });
      const savePayload = {
        sessionId,
        originalFilename: sourceTab === "upload" ? localFileMeta?.name : undefined,
        originalMimeType: sourceTab === "upload" ? localFileMeta?.type : undefined,
        annotatedImageR2Key: r2Outputs.annotatedImageR2Key,
        revisedImageR2Key: r2Outputs.revisedImageR2Key,
        originalImageR2Key: r2Outputs.originalImageR2Key,
        editBriefR2Key: r2Outputs.editBriefR2Key,
        editBrief: brief,
        aiRevision: mode === "revised" ? aiRevision : undefined,
      };
      const result = bridgeEnabled
        ? await callAppsScriptBridge<SaveResponse>("saveEditorOutput", savePayload)
        : await fetch("/api/image-markup/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(savePayload),
          }).then(async (response) => {
            const json = (await response.json().catch(() => ({}))) as SaveResponse;
            if (!response.ok) throw new Error(json.error || "保存失败");
            return json;
          });

      if (result.ok === false) throw new Error(result.error || "保存失败");
      setSaveState(mode === "revised" ? "saved-revised" : "saved-annotated");
    } catch {
      setSaveState("failed");
    }
  }

  const toolButtons = [
    { id: "select" as const, label: "Select", icon: MousePointer2 },
    { id: "freehand" as const, label: "Draw", icon: Pencil },
    { id: "arrow" as const, label: "Arrow", icon: ArrowUpRight },
    { id: "rectangle" as const, label: "Box", icon: Square },
    { id: "text" as const, label: "Text", icon: Type },
  ];
  const showEditorUploadPicker = sourceTab === "upload" && !versions.length;

  let textEditorStyle: CSSProperties | undefined;
  if (editingTextAnnotation && canvasLayout && activeVersion) {
    const canvasSize = getCanvasSize(versions, contentScale, histories);
    const frame = getVersionFrames(versions, contentScale, canvasSize.height).find((item) => item.version.id === activeVersion.id);
    if (frame) {
      const scaleX = canvasLayout.width / canvasLayout.canvasWidth;
      const scaleY = canvasLayout.height / canvasLayout.canvasHeight;
      const bounds = getTextAnnotationBounds(
        editingTextAnnotation.text,
        editingTextAnnotation.position,
        editingTextAnnotation.lineWidth,
        contentScale,
      );
      const fontSize = getTextAnnotationFontSize(editingTextAnnotation.lineWidth, contentScale);
      textEditorStyle = {
        left: canvasLayout.left + bounds.x * scaleX,
        top: canvasLayout.top + bounds.y * scaleY,
        width: Math.max(140, bounds.width * scaleX),
        minHeight: Math.max(24, bounds.height * scaleY),
        fontSize: Math.max(14, fontSize * scaleY),
        lineHeight: `${Math.max(20, fontSize * 1.25 * scaleY)}px`,
        color: editingTextAnnotation.color,
      };
    }
  }

  return (
    <main
      className={styles.editorShell}
      data-apptype={appType}
      data-plugin-environment={appType}
      data-plugin-style-environment={styleEnvironment}
    >
      <aside className={styles.editorSidebar}>
        {showEditorUploadPicker ? (
          <div className={styles.uploadPanel}>
            <input accept="image/png,image/jpeg,image/webp" hidden onChange={chooseLocalImage} ref={fileInputRef} type="file" />
            <button className="button" onClick={() => fileInputRef.current?.click()} type="button">
              <Upload size={18} />
              选择图片
            </button>
          </div>
        ) : null}

        <div className={styles.toolGroup} aria-label="Tools">
          {toolButtons.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-pressed={tool === item.id}
                className={styles.iconButton}
                key={item.id}
                onClick={() => {
                  setTool(item.id);
                  if (item.id !== "text") {
                    setEditingTextId(undefined);
                  }
                }}
                title={item.label}
                type="button"
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        <div className={styles.toolGroup}>
          <button className={styles.iconButton} disabled={!annotations.length} onClick={undo} title="Undo (Ctrl+Z)" type="button">
            <Undo2 size={18} />
          </button>
          <button className={styles.iconButton} disabled={!redoStack.length} onClick={redo} title="Redo (Ctrl+Shift+Z)" type="button">
            <Redo2 size={18} />
          </button>
          <button className={styles.iconButton} disabled={!activeVersion} onClick={exportPng} title="Download PNG" type="button">
            <Download size={18} />
          </button>
        </div>

        <label className={styles.field}>
          <span>内容缩放 {Math.round(contentScale * 100)}%</span>
          <input
            disabled={!versions.length}
            max={String(maxContentScale * 100)}
            min={String(minContentScale * 100)}
            onChange={(event) => {
              applyContentScale(Number(event.target.value) / 100);
            }}
            step="5"
            type="range"
            value={Math.round(contentScale * 100)}
          />
        </label>

        <button className="button" disabled={!activeVersion || revisionState === "generating"} onClick={generateRevision} type="button">
          {revisionState === "generating" ? <Loader2 className={styles.spin} size={18} /> : <ImageIcon size={18} />}
          {revisionState === "generating" ? "生成中" : revisionState === "failed" ? "重试生成修订图" : "生成修订图"}
        </button>

        {revisionState === "failed" ? <p className={styles.editorStatus}>{revisionError}</p> : null}

        <button className={`button ${styles.editorSave}`} disabled={!activeVersion || saveState === "saving-annotated" || saveState === "saving-revised"} onClick={() => saveToWorkspace("annotated")} type="button">
          <Save size={18} />
          {saveState === "saving-annotated" ? "保存中" : saveState === "saved-annotated" ? "已保存标注图" : "仅保存标注图"}
        </button>

        <button className={`button button--primary ${styles.editorSave}`} disabled={!revisedImageUrl || saveState === "saving-annotated" || saveState === "saving-revised"} onClick={() => saveToWorkspace("revised")} type="button">
          <Save size={18} />
          {saveState === "saving-revised" ? "保存中" : saveState === "saved-revised" ? "已保存修订图" : "保存修订图"}
        </button>

        {saveState === "failed" ? <p className={styles.editorStatus}>保存失败，请检查 Workspace 回调配置后重试。本地下载仍可使用。</p> : null}
      </aside>

      <section className={styles.canvasStage} ref={canvasStageRef}>
        {!versions.length ? <p className={styles.canvasEmptyNote}>请选择图片后开始标注。</p> : null}
        <div className={styles.canvasFrame} ref={canvasFrameRef}>
          <canvas
            aria-label="Annotation canvas"
            className={styles.annotationCanvas}
            onPointerCancel={endPointer}
            onPointerDown={beginPointer}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            ref={canvasRef}
          />
          {editingTextAnnotation && textEditorStyle ? (
            <input
              aria-label="Edit selected text annotation"
              className={styles.canvasTextEditor}
              onBlur={finishTextEditing}
              onChange={(event) => updateTextAnnotation(editingTextAnnotation.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") {
                  event.preventDefault();
                  finishTextEditing();
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              ref={textEditorRef}
              style={textEditorStyle}
              value={editingTextAnnotation.text}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
