import { platformLabel } from "@/lib/platforms";

export function bookmarkTitle(item: {
  title: string | null;
  url: string | null;
  source_platform: string;
}): string {
  const title = (item.title ?? "").trim().replace(/\s+/g, " ");
  if (title && !/^https?:\/\/\S+$/i.test(title)) {
    if (item.source_platform !== "instagram") return title;
    const caption = title.replace(/^.{1,160}? on Instagram:\s*["“]?/i, "").trim();
    if (!caption) return "Instagram post";
    return caption.length > 105 ? `${caption.slice(0, 105).replace(/\s+\S*$/, "")}…` : caption;
  }
  if (!item.url) return "Untitled";
  if (item.source_platform === "youtube" && item.url.includes("/shorts/")) return "YouTube Short";
  if (item.source_platform === "instagram") return /\/reels?\//.test(item.url) ? "Instagram reel" : "Instagram post";
  if (item.source_platform !== "generic") return `${platformLabel(item.source_platform)} bookmark`;
  try {
    return new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    return "Saved link";
  }
}
