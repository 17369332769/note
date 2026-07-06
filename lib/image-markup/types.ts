export type AnnotationTool = "select" | "freehand" | "arrow" | "rectangle" | "text";

export type Point = {
  x: number;
  y: number;
};

export type AnnotationBase = {
  id: string;
  color: string;
  lineWidth: number;
  text?: string;
};

export type FreehandAnnotation = AnnotationBase & {
  type: "freehand";
  points: Point[];
};

export type ArrowAnnotation = AnnotationBase & {
  type: "arrow";
  start: Point;
  end: Point;
};

export type RectangleAnnotation = AnnotationBase & {
  type: "rectangle";
  start: Point;
  end: Point;
};

export type TextAnnotation = AnnotationBase & {
  type: "text";
  position: Point;
  text: string;
};

export type Annotation = FreehandAnnotation | ArrowAnnotation | RectangleAnnotation | TextAnnotation;

export type EditBrief = {
  sessionId: string;
  sourceLabel: string;
  globalInstruction: string;
  annotations: Array<{
    type: "arrow" | "rectangle" | "freehand" | "text";
    text: string;
    originalText?: string;
    bounds: { x: number; y: number; width: number; height: number };
    color: string;
  }>;
};

export type AiRevisionMetadata = {
  provider: "runninghub";
  promptVersion: "image-markup-ai-edit-v1";
  promptHash: string;
  resolution: string;
  quality: string;
  model?: string;
  generatedAt: string;
};

export type AiRevisionRequest = {
  sessionId: string;
  sessionToken?: string;
  requestId?: string;
  preparedImageUrls?: [string, string];
  editBrief: EditBrief;
  aspectRatio?: string;
};

export type AiRevisionResponse =
  | ({
      ok: true;
      status: "completed";
      jobId: string;
      revisedImageR2Key: string;
      revisedImageUrl: string;
    } & AiRevisionMetadata)
  | ({
      ok: true;
      status: "pending";
      jobId: string;
    } & AiRevisionMetadata)
  | ({
      ok: true;
      status: "failed";
      jobId: string;
      error: string;
    } & AiRevisionMetadata)
  | {
      ok: false;
      error: string;
    };
