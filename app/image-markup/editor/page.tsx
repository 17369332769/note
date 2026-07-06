"use client";

import { Button, ConfigProvider, InputNumber, Tooltip, Upload as AntUpload } from "antd";
import type { UploadProps } from "antd";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowUpRight,
  Download,
  FilePlus2,
  Image as ImageIcon,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  LocateFixed,
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
import type { AiRevisionResponse, Annotation, AnnotationTool, Point } from "@/lib/image-markup/types";
import styles from "../ImageMarkup.module.css";

const defaultAnnotationColor = "#d93025";
const defaultAnnotationLineWidth = 6;
const defaultAnnotationText = "Clarify this area";
const defaultContentScale = 0.5;
const minContentScale = 0.25;
const maxContentScale = 2;
const wheelZoomStep = 0.05;
const maxVersionWidth = 1280;
const versionGap = 40;
const workspacePadding = 1600;
const aiRevisionPollIntervalMs = 3000;
const aiRevisionMaxPolls = 180;

type PluginAppType = "addon" | "drive";
type SourceTab = "document" | "upload";
type SelectionTarget = "image" | "annotation";
type BridgeAction = "getSession" | "insertEditorOutput";

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
  r2Key?: string;
};

type VersionFrame = {
  version: ImageVersion;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasDrag =
  | { mode: "draw" | "move"; start: Point; selectedId?: string; versionId: string }
  | { mode: "move-image"; start: Point; versionId: string }
  | { mode: "pan"; start: Point };

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
    return { ok: false, error: message || "The clean revision could not be generated." };
  }
}

function createVersionId() {
  return crypto.randomUUID();
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function getVersionFrames(versions: ImageVersion[], contentScale: number): VersionFrame[] {
  let x = workspacePadding;
  return versions
    .filter((version) => version.width > 0 && version.height > 0)
    .map((version) => {
      const width = version.width * contentScale;
      const height = version.height * contentScale;
      const frame = {
        version,
        x: x + version.offset.x,
        y: workspacePadding + version.offset.y,
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
  }, workspacePadding * 2);
  const baseHeight =
    readyVersions.reduce((height, version) => Math.max(height, version.height * contentScale), 0) + workspacePadding * 2;
  const frames = getVersionFrames(versions, contentScale);
  const imageRight = frames.reduce((right, frame) => Math.max(right, frame.x + frame.width), 0);
  const imageBottom = frames.reduce((bottom, frame) => Math.max(bottom, frame.y + frame.height), 0);
  const annotationRight = Object.values(histories).reduce((right, history) => {
    return Math.max(
      right,
      ...history.annotations.map((annotation) => {
        const bounds = getAnnotationBounds(annotation, contentScale);
        return bounds.x + bounds.width;
      }),
    );
  }, 0);
  const annotationBottom = Object.values(histories).reduce((bottom, history) => {
    return Math.max(
      bottom,
      ...history.annotations.map((annotation) => {
        const bounds = getAnnotationBounds(annotation, contentScale);
        return bounds.y + bounds.height;
      }),
    );
  }, 0);
  return {
    width: Math.max(baseSize.width, Math.ceil(baseWidth), Math.ceil(imageRight), Math.ceil(annotationRight + 48)),
    height: Math.max(baseSize.height, Math.ceil(baseHeight), Math.ceil(imageBottom), Math.ceil(annotationBottom + 48)),
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
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const textEditorRef = useRef<HTMLInputElement | null>(null);
  const imageElementsRef = useRef<Record<string, HTMLImageElement>>({});
  const dragRef = useRef<CanvasDrag | null>(null);
  const renderCanvasRef = useRef<() => void>(() => {});
  const centeredInitialCanvasRef = useRef(false);

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, []);

  const sessionId = params.get("sessionId") || "local-session";
  const sessionToken = params.get("sessionToken") || "";
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
  const [sourceTab] = useState<SourceTab>(localUpload ? "upload" : "document");
  const [revisionState, setRevisionState] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [revisionError, setRevisionError] = useState("");
  const [insertState, setInsertState] = useState<"idle" | "inserting" | "inserted" | "failed">("idle");
  const [insertError, setInsertError] = useState("");
  const [sourceLoadError, setSourceLoadError] = useState("");
  const [contentScale, setContentScale] = useState(defaultContentScale);
  const [viewportOffset, setViewportOffset] = useState<Point>({ x: 0, y: 0 });
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
    setVersions([{ id, label: "Original", url, width: 0, height: 0, offset: { x: 0, y: 0 } }]);
    setHistories({ [id]: createEmptyHistory() });
    setActiveVersionId(id);
    setSelectedId(undefined);
    setSelectionTarget(undefined);
    setEditingTextId(undefined);
    setRevisionState("idle");
    setInsertState("idle");
    setInsertError("");
    setSourceLoadError("");
    setContentScale(defaultContentScale);
    setViewportOffset({ x: 0, y: 0 });
    centeredInitialCanvasRef.current = false;
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

      const oldFrames = getVersionFrames(versions, currentScale);
      const ratio = nextScale / currentScale;
      const nextVersions = versions.map((version) => ({
        ...version,
        offset: {
          x: version.offset.x * ratio,
          y: version.offset.y * ratio,
        },
      }));
      const nextFrames = getVersionFrames(nextVersions, nextScale);
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
  }, [versions]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const canvasSize = getCanvasSize(versions, contentScale, histories);
    const frames = getVersionFrames(versions, contentScale);
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

  const callAppsScriptBridge = useCallback(<T,>(action: BridgeAction, payload: unknown) => {
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
  }, []);

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
      ? callAppsScriptBridge<{ ok?: boolean; error?: string; originalImage?: { dataUrl?: string; r2Key?: string } }>("getSession", {
          sessionId,
          sessionToken,
          includeImage: true,
        })
      : fetch(
          `/api/image-markup/session?sessionId=${encodeURIComponent(sessionId)}&sessionToken=${encodeURIComponent(sessionToken)}`,
        ).then((response) => (response.ok ? response.json() : null));

    sessionRequest
      .then(async (data) => {
        if (cancelled) return;
        if (data?.ok === false) {
          setSourceLoadError(data.error || "Could not load this editing session.");
          return;
        }
        if (data?.originalImage?.dataUrl) {
          setInitialImage(data.originalImage.dataUrl);
          return;
        }
        if (data?.originalImage?.r2Key) {
          setInitialImage(getR2ObjectUrl(data.originalImage.r2Key));
          return;
        }
        setSourceLoadError("Could not load the selected image. Select it again from the sidebar.");
      })
      .catch((error) => {
        if (!cancelled) {
          setVersions([]);
          setSourceLoadError(error instanceof Error ? error.message : "Could not load the selected image.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bridgeEnabled, callAppsScriptBridge, sessionId, sessionToken, setInitialImage]);

  useLayoutEffect(() => {
    renderCanvas();
    updateCanvasLayout();
  }, [renderCanvas, updateCanvasLayout]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (!event.ctrlKey) {
        setViewportOffset((current) => ({
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }));
        return;
      }

      const direction = event.deltaY < 0 ? 1 : -1;
      applyContentScale(Number((contentScale + direction * wheelZoomStep).toFixed(2)));
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [applyContentScale, contentScale]);

  useLayoutEffect(() => {
    if (centeredInitialCanvasRef.current || !versions.some((version) => version.width && version.height)) return;
    const stage = canvasStageRef.current;
    if (!stage) return;

    const frame = getVersionFrames(versions, contentScale)[0];
    if (!frame) return;
    const stageRect = stage.getBoundingClientRect();
    setViewportOffset({
      x: stageRect.width / 2 - (frame.x + frame.width / 2),
      y: stageRect.height / 2 - (frame.y + frame.height / 2),
    });
    centeredInitialCanvasRef.current = true;
  }, [contentScale, histories, versions]);

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

  function getCanvasPoint(event: React.PointerEvent<HTMLElement>): Point {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
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

  function beginPointer(event: React.PointerEvent<HTMLElement>) {
    const canvasPoint = getCanvasPoint(event);
    const frame = getFrameAtPoint(getVersionFrames(versions, contentScale), canvasPoint);
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
          ? { mode: "move-image", start: point, versionId }
          : { mode: "pan", start: { x: event.clientX, y: event.clientY } };
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

  function movePointer(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const canvasPoint = getCanvasPoint(event);
    const point = canvasPoint;

    if (drag.mode === "pan") {
      const delta = { x: event.clientX - drag.start.x, y: event.clientY - drag.start.y };
      dragRef.current = { ...drag, start: { x: event.clientX, y: event.clientY } };
      setViewportOffset((current) => ({ x: current.x + delta.x, y: current.y + delta.y }));
      return;
    }

    if (drag.mode === "move-image") {
      const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
      dragRef.current = { ...drag, start: point };
      setVersions((current) =>
        current.map((version) =>
          version.id === drag.versionId
            ? { ...version, offset: { x: version.offset.x + delta.x, y: version.offset.y + delta.y } }
            : version,
        ),
      );
      updateHistory(drag.versionId, (current) => ({
        annotations: current.annotations.map((annotation) => moveAnnotation(annotation, delta)),
        redoStack: [],
      }));
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

  function endPointer(event: React.PointerEvent<HTMLElement>) {
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
    const frame = getVersionFrames(versions, contentScale).find((item) => item.version.id === activeVersion.id);
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

  function getCanvasPngDataUrl() {
    const canvasSize = getCanvasSize(versions, contentScale, histories);
    const frames = getVersionFrames(versions, contentScale);
    if (!frames.length) return "";

    const canvas = document.createElement("canvas");
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext("2d");
    if (!context) return "";

    context.fillStyle = "#f3f4f6";
    context.fillRect(0, 0, canvas.width, canvas.height);

    frames.forEach((frame) => {
      const image = imageElementsRef.current[frame.version.id];
      if (!image) return;
      context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
    });

    frames.forEach((frame) => {
      drawAnnotations(context, histories[frame.version.id]?.annotations || [], undefined, contentScale);
    });

    return canvas.toDataURL("image/png");
  }

  function exportPng() {
    const dataUrl = getCanvasPngDataUrl();
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${sourceLabel}-canvas.png`;
    anchor.click();
  }

  function chooseLocalImage(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setRevisionError("Only PNG, JPEG, or WebP images are supported.");
      setRevisionState("failed");
      return;
    }

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
      throw new Error(result.error || "Could not prepare the image for download.");
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
      throw new Error(result.error || "The image could not be uploaded. Please try again.");
    }

    return result.key;
  }

  async function uploadDataUrlToR2(dataUrl: string, filename: string, prefix: string) {
    return uploadBlobToR2(await dataUrlToBlob(dataUrl), filename, prefix);
  }

  async function prepareRunningHubImagesWithR2(sourceImageDataUrl: string, markedImageDataUrl: string) {
    const [originalKey, annotatedKey] = await Promise.all([
      uploadDataUrlToR2(sourceImageDataUrl, `${sessionId}-runninghub-original.png`, "image-markup/runninghub"),
      uploadDataUrlToR2(markedImageDataUrl, `${sessionId}-runninghub-annotated.png`, "image-markup/runninghub"),
    ]);
    return Promise.all([getR2DownloadUrl(originalKey), getR2DownloadUrl(annotatedKey)]) as Promise<[string, string]>;
  }

  async function waitForAiRevisionResult(initialResult: AiRevisionResponse) {
    if (!initialResult.ok) throw new Error(initialResult.error);
    if (initialResult.status === "completed") return initialResult;
    if (initialResult.status === "failed") throw new Error(initialResult.error);

    let latestResult = initialResult;
    for (let attempt = 0; attempt < aiRevisionMaxPolls; attempt += 1) {
      await sleep(aiRevisionPollIntervalMs);
      const params = new URLSearchParams({
        sessionId,
        sessionToken,
        jobId: latestResult.jobId,
      });
      const response = await fetch(`/api/image-markup/ai-revision?${params.toString()}`);
      const responseText = await response.text();
      const result = parseAiRevisionResponse(responseText);
      if (!result.ok) throw new Error(result.error);
      if (result.status === "completed") return result;
      if (result.status === "failed") throw new Error(result.error);
      if (!response.ok) {
        throw new Error("The clean revision status could not be checked.");
      }
      latestResult = result;
    }

    throw new Error("The clean revision is still processing. Please try again in a moment.");
  }

  async function generateRevision() {
    if (!activeVersion) {
      setRevisionError("Choose an image before generating a revision.");
      setRevisionState("failed");
      return;
    }

    setRevisionState("generating");
    setRevisionError("");
    setInsertState("idle");
    setInsertError("");

    const brief = buildEditBrief(sessionId, activeVersion.label, "", annotations, contentScale);
    const sourceImageDataUrl = await getActiveImageDataUrl();
    const markedImageDataUrl = getActiveAnnotatedPngDataUrl();
    const requestId = createVersionId();

    try {
      const preparedImageUrls = await prepareRunningHubImagesWithR2(sourceImageDataUrl, markedImageDataUrl);
      const response = await fetch("/api/image-markup/ai-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken,
          requestId,
          preparedImageUrls,
          editBrief: brief,
          aspectRatio: getAspectRatio(activeVersion),
        }),
      });
      const responseText = await response.text();
      const initialResult = parseAiRevisionResponse(responseText);
      if (!initialResult.ok) {
        throw new Error(initialResult.error);
      }
      if (!response.ok && initialResult.status !== "failed") {
        throw new Error("The clean revision could not be started.");
      }
      const result = await waitForAiRevisionResult(initialResult);

      if (!result.revisedImageR2Key || !result.revisedImageUrl) {
        throw new Error("The clean revision was generated, but the saved image reference was missing.");
      }

      const nextId = createVersionId();
      const nextVersion: ImageVersion = {
        id: nextId,
        label: `Revision ${versions.length}`,
        url: result.revisedImageUrl,
        width: activeVersion.width,
        height: activeVersion.height,
        offset: { x: 0, y: 0 },
        r2Key: result.revisedImageR2Key,
      };
      setVersions((current) => [...current, nextVersion]);
      setHistories((current) => ({ ...current, [nextId]: createEmptyHistory() }));
      setActiveVersionId(nextId);
      setSelectedId(undefined);
      setSelectionTarget("image");
      setEditingTextId(undefined);
      setRevisionState("ready");
    } catch (error) {
      setRevisionError(error instanceof Error ? error.message : "Could not create a clean revision. Please review the marks and try again.");
      setRevisionState("failed");
    }
  }

  async function insertLatestImageIntoDocument() {
    const latestVersion = versions[versions.length - 1];
    if (!latestVersion?.r2Key) {
      setInsertError("Generate an image before inserting it.");
      setInsertState("failed");
      return;
    }
    if (!bridgeEnabled) {
      setInsertError("Open this editor from Google Docs before inserting.");
      setInsertState("failed");
      return;
    }

    setInsertState("inserting");
    setInsertError("");

    try {
      await callAppsScriptBridge<{ ok?: boolean }>("insertEditorOutput", {
        sessionId,
        sessionToken,
        imageR2Key: latestVersion.r2Key,
        label: latestVersion.label,
      });
      setInsertState("inserted");
    } catch (error) {
      setInsertError(error instanceof Error ? error.message : "Could not insert the generated image.");
      setInsertState("failed");
    }
  }

  function centerActiveVersion() {
    const stage = canvasStageRef.current;
    if (!stage) return;

    const frames = getVersionFrames(versions, contentScale);
    const frame = frames.find((item) => item.version.id === activeVersionId) || frames[0];
    if (!frame) return;

    const stageRect = stage.getBoundingClientRect();
    setViewportOffset({
      x: stageRect.width / 2 - (frame.x + frame.width / 2),
      y: stageRect.height / 2 - (frame.y + frame.height / 2),
    });
  }

  const toolButtons = [
    { id: "select" as const, label: "Select", icon: MousePointer2 },
    { id: "freehand" as const, label: "Freehand", icon: Pencil },
    { id: "arrow" as const, label: "Arrow", icon: ArrowUpRight },
    { id: "rectangle" as const, label: "Box highlight", icon: Square },
    { id: "text" as const, label: "Note", icon: Type },
  ];
  const showEditorUploadPicker = sourceTab === "upload" && !versions.length;
  const latestGeneratedVersion = versions.length > 1 ? versions[versions.length - 1] : undefined;
  const zoomPercent = Math.round(contentScale * 100);
  const viewportPosition = {
    x: Math.round(-viewportOffset.x),
    y: Math.round(-viewportOffset.y),
  };
  const editorUploadProps: UploadProps = {
    accept: "image/png,image/jpeg,image/webp",
    beforeUpload: (file) => {
      chooseLocalImage(file);
      return false;
    },
    disabled: Boolean(versions.length),
    maxCount: 1,
    showUploadList: false,
  };

  let textEditorStyle: CSSProperties | undefined;
  if (editingTextAnnotation && canvasLayout && activeVersion) {
    const frame = getVersionFrames(versions, contentScale).find((item) => item.version.id === activeVersionId);
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
    <ConfigProvider theme={{ token: { colorPrimary: "#2563eb" } }}>
      <main
        className={styles.editorShell}
        data-apptype={appType}
        data-plugin-environment={appType}
        data-plugin-style-environment={styleEnvironment}
      >
      <aside className={styles.editorSidebar}>
        {showEditorUploadPicker ? (
          <div className={styles.uploadPanel}>
            <AntUpload {...editorUploadProps}>
              <Button icon={<Upload size={18} />}>Upload image</Button>
            </AntUpload>
          </div>
        ) : null}

        <div className={styles.toolGroup} aria-label="Tools">
          {toolButtons.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.id} title={item.label}>
                <Button
                  aria-pressed={tool === item.id}
                  icon={<Icon size={18} />}
                  onClick={() => {
                    setTool(item.id);
                    if (item.id !== "text") {
                      setEditingTextId(undefined);
                    }
                  }}
                  type={tool === item.id ? "primary" : "default"}
                />
              </Tooltip>
            );
          })}
        </div>

        <div className={styles.toolGroup}>
          <Tooltip title="Undo (Ctrl+Z)">
            <Button disabled={!annotations.length} icon={<Undo2 size={18} />} onClick={undo} />
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Shift+Z)">
            <Button disabled={!redoStack.length} icon={<Redo2 size={18} />} onClick={redo} />
          </Tooltip>
          <Tooltip title="Download canvas PNG">
            <Button disabled={!versions.length} icon={<Download size={18} />} onClick={exportPng} />
          </Tooltip>
        </div>

        <Button
          className={styles.editorSave}
          disabled={!activeVersion}
          icon={<ImageIcon size={18} />}
          loading={revisionState === "generating"}
          onClick={generateRevision}
          type="primary"
        >
          {revisionState === "generating" ? "Generating" : revisionState === "failed" ? "Retry generate" : "Generate"}
        </Button>

        <Button
          className={styles.editorSave}
          disabled={!latestGeneratedVersion?.r2Key || revisionState === "generating"}
          icon={<FilePlus2 size={18} />}
          loading={insertState === "inserting"}
          onClick={insertLatestImageIntoDocument}
        >
          {insertState === "inserted" ? "Inserted" : "Insert"}
        </Button>

        {revisionState === "failed" ? <p className={styles.editorErrorStatus}>{revisionError}</p> : null}
        {insertState === "failed" ? <p className={styles.editorErrorStatus}>{insertError}</p> : null}
      </aside>

      <section className={styles.canvasStage}>
        <div
          className={styles.canvasViewport}
          onPointerCancel={endPointer}
          onPointerDown={beginPointer}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          ref={canvasStageRef}
        >
          {!versions.length ? (
            <p className={sourceLoadError ? styles.canvasErrorNote : styles.canvasEmptyNote}>
              {sourceLoadError || "Upload or choose an image to mark the edits you want."}
            </p>
          ) : null}
          <div
            className={styles.canvasFrame}
            ref={canvasFrameRef}
            style={{ transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)` }}
          >
            <canvas
              aria-label="Image editing canvas"
              className={styles.annotationCanvas}
              ref={canvasRef}
            />
            {editingTextAnnotation && textEditorStyle ? (
              <input
                aria-label="Edit selected note"
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
          <div
            className={styles.canvasNavigator}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <span className={styles.canvasCoordinates}>
              X {viewportPosition.x} Y {viewportPosition.y}
            </span>
            <label className={styles.canvasZoomInput}>
              <span>Zoom</span>
              <InputNumber
                aria-label="Canvas zoom percent"
                controls={false}
                disabled={!versions.length}
                max={maxContentScale * 100}
                min={minContentScale * 100}
                onChange={(value) => {
                  if (typeof value === "number") {
                    applyContentScale(value / 100);
                  }
                }}
                size="small"
                step={5}
                value={zoomPercent}
              />
              <span>%</span>
            </label>
            <Tooltip title="Center image">
              <Button
                disabled={!versions.length}
                icon={<LocateFixed size={16} />}
                onClick={centerActiveVersion}
                size="small"
              />
            </Tooltip>
          </div>
        </div>
      </section>
      </main>
    </ConfigProvider>
  );
}
