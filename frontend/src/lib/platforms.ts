export const platformLabels: Readonly<Record<string, string>> = {
  generic: "Web",
  youtube: "YouTube",
  instagram: "Instagram",
  reddit: "Reddit",
  twitter: "X",
  threads: "Threads",
  tiktok: "TikTok",
  github: "GitHub",
  hackernews: "Hacker News",
  stackoverflow: "Stack Overflow",
  mastodon: "Mastodon",
  substack: "Substack",
  medium: "Medium",
  linkedin: "LinkedIn",
  spotify: "Spotify",
};

export function platformLabel(source: string) {
  return platformLabels[source] ?? source;
}
