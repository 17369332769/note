import { notFound } from "next/navigation";
import { getPlugin } from "@/lib/plugins";
import { generatePluginMetadata, PluginProductPage } from "@/app/plugins/[slug]/page";

const plugin = getPlugin("image-markup");

export function generateMetadata() {
  if (!plugin) return {};
  return generatePluginMetadata(plugin);
}

export default function ImageMarkupProductPage() {
  if (!plugin) {
    notFound();
  }

  return <PluginProductPage plugin={plugin} />;
}
