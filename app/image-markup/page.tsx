"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Download,
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
  exportCanvasPng,
  hitTestAnnotation,
  moveAnnotation,
} from "@/lib/image-markup/export";
import type { Annotation, AnnotationTool, Point } from "@/lib/image-markup/types";

const colors = ["#d93025", "#2563eb", "#188038", "#fbbc04", "#111827"];

function getEditorApiUrl(path: string) {
  if (typeof window === "undefined") return path;

  const baseUrl = (window as typeof window & { __IMAGE_MARKUP_BASE_URL?: string }).__IMAGE_MARKUP_BASE_URL;
  return baseUrl ? new URL(path, baseUrl).toString() : path;
}

export default function WorkspaceImageEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ mode: "draw" | "move"; start: Point; selectedId?: string } | null>(null);
  const renderCanvasRef = useRef<() => void>(() => {});
  const [tool, setTool] = useState<AnnotationTool>("freehand");
  const [color, setColor] = useState(colors[0]);
  const [lineWidth, setLineWidth] = useState(4);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [draftText, setDraftText] = useState("Clarify this area");
  const [globalInstruction, setGlobalInstruction] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }
    return new URLSearchParams(window.location.search);
  }, []);
  const sessionId = params.get("sessionId") || "local-session";
  const sourceLabel = params.get("sourceLabel") || "Workspace image";
  const localUpload = params.get("localUpload") === "1";
  const [imageUrl, setImageUrl] = useState("");

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (image) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else {
      context.fillStyle = "#f3f4f6";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111827";
      context.font = "32px Arial";
      context.fillText("Drop-in preview canvas", 48, 80);
    }
    drawAnnotations(context, annotations, selectedId);
  }, [annotations, selectedId]);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  useEffect(() => {
    if (sessionId === "local-session") return;

    let cancelled = false;
    fetch(getEditorApiUrl(`/api/image-markup/session?sessionId=${encodeURIComponent(sessionId)}`))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.originalImage?.dataUrl) {
          setImageUrl(data.originalImage.dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setImageUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!imageUrl) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 1280;
      canvas.height = 720;
      imageRef.current = null;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#f3f4f6";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111827";
      context.font = "32px Arial";
      context.fillText("Drop-in preview canvas", 48, 80);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      imageRef.current = image;
      renderCanvasRef.current();
    };
    image.src = imageUrl;
  }, [imageUrl]);

  useLayoutEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function updateWithHistory(next: Annotation[]) {
    setRedoStack([]);
    setAnnotations(next);
  }

  function beginPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === "select") {
      const selected = [...annotations].reverse().find((annotation) => hitTestAnnotation(annotation, point));
      setSelectedId(selected?.id);
      if (selected) {
        dragRef.current = { mode: "move", start: point, selectedId: selected.id };
      }
      return;
    }

    const id = crypto.randomUUID();
    const annotation =
      tool === "freehand"
        ? { id, type: "freehand" as const, color, lineWidth, points: [point] }
        : tool === "arrow"
          ? { id, type: "arrow" as const, color, lineWidth, start: point, end: point }
          : tool === "rectangle"
            ? { id, type: "rectangle" as const, color, lineWidth, start: point, end: point }
            : { id, type: "text" as const, color, lineWidth, position: point, text: draftText };

    setSelectedId(id);
    updateWithHistory([...annotations, annotation]);
    dragRef.current = { mode: "draw", start: point, selectedId: id };
  }

  function movePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const point = getCanvasPoint(event);

    if (drag.mode === "move" && drag.selectedId) {
      const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
      dragRef.current = { ...drag, start: point };
      setAnnotations((current) =>
        current.map((annotation) => (annotation.id === drag.selectedId ? moveAnnotation(annotation, delta) : annotation)),
      );
      return;
    }

    setAnnotations((current) =>
      current.map((annotation) => {
        if (annotation.id !== drag.selectedId) return annotation;
        if (annotation.type === "freehand") return { ...annotation, points: [...annotation.points, point] };
        if (annotation.type === "arrow" || annotation.type === "rectangle") return { ...annotation, end: point };
        return annotation;
      }),
    );
  }

  function endPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  function undo() {
    setAnnotations((current) => {
      if (!current.length) return current;
      setRedoStack((redo) => [current, ...redo]);
      return current.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((current) => {
      const next = current[0];
      if (!next) return current;
      setAnnotations(next);
      return current.slice(1);
    });
  }

  function exportPng() {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = image ? exportCanvasPng(image, annotations, canvas.width, canvas.height) : canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${sourceLabel}-annotated.png`;
    anchor.click();
  }

  function exportBrief() {
    const brief = buildEditBrief(sessionId, sourceLabel, globalInstruction, annotations);
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${sourceLabel}-edit-brief.json`;
    anchor.click();
  }

  function chooseLocalImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
        setAnnotations([]);
        setRedoStack([]);
        setSelectedId(undefined);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveToWorkspace() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderCanvas();

    setSaveState("saving");
    const brief = buildEditBrief(sessionId, sourceLabel, globalInstruction, annotations);

    try {
      const response = await fetch(getEditorApiUrl("/api/image-markup/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          annotatedPngBase64: canvas.toDataURL("image/png"),
          editBrief: brief,
        }),
      });

      if (!response.ok) throw new Error("Save failed");
      setSaveState("saved");
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

  return (
    <main className="editor-shell">
      <aside className="editor-sidebar">
        <div>
          <p className="eyebrow">Image Markup</p>
          <h1>{sourceLabel}</h1>
        </div>

        {localUpload ? (
          <div className="upload-panel">
            <input accept="image/*" hidden onChange={chooseLocalImage} ref={fileInputRef} type="file" />
            <button className="button" onClick={() => fileInputRef.current?.click()} type="button">
              <Upload size={18} />
              Choose image
            </button>
          </div>
        ) : null}

        <div className="tool-group" aria-label="Tools">
          {toolButtons.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-pressed={tool === item.id}
                className="icon-button"
                key={item.id}
                onClick={() => setTool(item.id)}
                title={item.label}
                type="button"
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        <label className="field">
          <span>Label text</span>
          <input value={draftText} onChange={(event) => setDraftText(event.target.value)} />
        </label>

        <label className="field">
          <span>Edit brief</span>
          <textarea value={globalInstruction} onChange={(event) => setGlobalInstruction(event.target.value)} />
        </label>

        <div className="color-row">
          {colors.map((item) => (
            <button
              aria-label={`Use ${item}`}
              aria-pressed={color === item}
              className="swatch"
              key={item}
              onClick={() => setColor(item)}
              style={{ background: item }}
              type="button"
            />
          ))}
        </div>

        <label className="field">
          <span>Line width</span>
          <input
            max="12"
            min="1"
            onChange={(event) => setLineWidth(Number(event.target.value))}
            type="range"
            value={lineWidth}
          />
        </label>

        <div className="tool-group">
          <button className="icon-button" disabled={!annotations.length} onClick={undo} title="Undo" type="button">
            <Undo2 size={18} />
          </button>
          <button className="icon-button" disabled={!redoStack.length} onClick={redo} title="Redo" type="button">
            <Redo2 size={18} />
          </button>
          <button className="icon-button" onClick={exportPng} title="Download PNG" type="button">
            <Download size={18} />
          </button>
          <button className="icon-button" onClick={exportBrief} title="Download edit brief" type="button">
            <Type size={18} />
          </button>
        </div>

        <button className="button button--primary editor-save" onClick={saveToWorkspace} type="button">
          <Save size={18} />
          {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save"}
        </button>

        {saveState === "failed" ? <p className="editor-status">Workspace callback is not configured. Local export still works.</p> : null}
      </aside>

      <section className="canvas-stage">
        <canvas
          aria-label="Annotation canvas"
          className="annotation-canvas"
          onPointerDown={beginPointer}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          ref={canvasRef}
        />
      </section>
    </main>
  );
}
