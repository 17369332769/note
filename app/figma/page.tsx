import { redirect } from "next/navigation";
import type { Route } from "next";

export default function FigmaPluginsPage() {
  redirect("/figma/image-markup" as Route);
}
