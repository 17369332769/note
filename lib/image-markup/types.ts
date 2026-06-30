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
    bounds: { x: number; y: number; width: number; height: number };
    color: string;
  }>;
};
