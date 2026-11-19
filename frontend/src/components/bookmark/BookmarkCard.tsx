import { Link } from "react-router-dom";
import { Star, GitFork, MessageSquare, Eye, ArrowRight, ArrowUp, Hash } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { platformLabel } from "@/lib/platforms";
import { useUpdateItem, useQueueStats, type EnrichmentStatus } from "@/hooks/use-items";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { EnrichmentBadge } from "@/components/bookmark/EnrichmentBadge";
import { BookmarkThumbnail } from "@/components/bookmark/BookmarkThumbnail";

interface BookmarkCardProps {
  item: {
    id: string;
    title: string | null;
    description: string | null;
    url: string | null;
    favicon_url?: string | null;
    source_platform: string;
    item_type: string;
    summary: string | null;
    media: Array<{ type: string; url?: string; role: string; local_path?: string }>;
    is_favorite: boolean;
    created_at: string;
    item_metadata?: Record<string, unknown>;
    tags?: Array<{ id: string; name: string; color?: string | null }>;
    enrichment_status?: EnrichmentStatus | null;
  };
  variant?: "grid" | "list" | "compact";
}

function CardTags({ tags }: { tags?: Array<{ id: string; name: string; color?: string | null }> }) {
  if (!tags || tags.length === 0) return null;
  const shown = tags.slice(0, 3);
  const remaining = tags.length - shown.length;
  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {shown.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400"
        >
          <Hash className="w-2.5 h-2.5" />
          {t.name}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-400">+{remaining}</span>
      )}
    </div>
  );
}

function fmt(n: unknown): string {
  const num = Number(n);
  if (isNaN(num)) return String(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

function PlatformMeta({ platform, metadata }: { platform: string; metadata?: Record<string, unknown> }) {
  if (!metadata) return null;
  const p = platform.toLowerCase();

  if (p === "github") {
    const stars = metadata.stars ?? metadata.stargazers_count;
    const forks = metadata.forks ?? metadata.forks_count;
    const lang = metadata.language;
    if (stars == null && lang == null) return null;
    return (
      <div className="flex items-center gap-2.5 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
        {lang ? <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">{String(lang)}</span> : null}
        {stars != null && <span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3" />{fmt(stars)}</span>}
        {forks != null && <span className="inline-flex items-center gap-0.5"><GitFork className="w-3 h-3" />{fmt(forks)}</span>}
      </div>
    );
  }

  if (p === "reddit") {
    const score = metadata.score ?? metadata.upvotes;
    const comments = metadata.num_comments ?? metadata.comment_count;
    const subreddit = metadata.subreddit;
    if (score == null && subreddit == null) return null;
    return (
      <div className="flex items-center gap-2.5 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
        {subreddit ? <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">r/{String(subreddit)}</span> : null}
        {score != null && <span className="inline-flex items-center gap-0.5"><ArrowUp className="w-3 h-3" />{fmt(score)}</span>}
        {comments != null && <span className="inline-flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{fmt(comments)}</span>}
      </div>
    );
  }

  if (p === "youtube") {
    const channel = metadata.channel ?? metadata.channel_name ?? metadata.uploader;
    const views = metadata.view_count ?? metadata.views;
    if (!channel && !views) return null;
    return (
      <div className="flex items-center gap-2.5 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
        {channel ? <span className="truncate max-w-[120px]">{String(channel)}</span> : null}
        {views != null && <span className="inline-flex items-center gap-0.5"><Eye className="w-3 h-3" />{fmt(views)}</span>}
      </div>
    );
  }

  if (p === "twitter") {
    const author = metadata.author ?? metadata.username;
    if (!author) return null;
    return (
      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
        <span>@{String(author).replace(/^@/, "")}</span>
      </div>
    );
  }

  const author = metadata.author ?? metadata.author_name ?? metadata.by;
  if (!author) return null;
  return (
    <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
      <span className="truncate max-w-[150px]">{String(author)}</span>
    </div>
  );
}

export function BookmarkCard({ item, variant = "grid" }: BookmarkCardProps) {
  const updateItem = useUpdateItem();
  const enrichmentProcessing =
    item.enrichment_status?.overall === "processing" ||
    item.enrichment_status?.overall === "pending";
  const queueStats = useQueueStats(enrichmentProcessing);
  const itemsAhead = enrichmentProcessing ? queueStats.data?.items_in_flight : undefined;
  const destination = `/item/${item.id}`;
  const title = item.title || item.url || "Untitled";
  const source = platformLabel(item.source_platform);
  const date = timeAgo(item.created_at);

  if (variant === "compact") {
    return (
      <Link to={destination} className="pocket-recent-item">
        <span className="pocket-recent-item__icon">
          <PlatformIcon platform={item.source_platform} className="size-5" />
        </span>
        <div className="pocket-recent-item__text">
          <span className="pocket-recent-item__title">{title}</span>
          <span className="pocket-recent-item__meta">{source}<span aria-hidden="true"> · </span>{date}</span>
        </div>
        <ArrowRight size={17} className="pocket-recent-item__arrow" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <article className={`workspace-bookmark workspace-bookmark--${variant}`}>
      <BookmarkThumbnail
        itemId={item.id}
        itemType={item.item_type}
        sourcePlatform={item.source_platform}
        faviconUrl={item.favicon_url}
        media={item.media}
        metadata={item.item_metadata}
        shape={variant === "list" ? "square-16" : "aspect-video"}
        iconSize="size-5"
        hideFallback={variant === "grid"}
      />
      <div className="workspace-bookmark__content">
        <div className="workspace-bookmark__meta">
          {source}<span aria-hidden="true"> · </span>{date}
        </div>
        <h3>
          <Link to={destination} className="workspace-bookmark__title">{title}</Link>
        </h3>
        {(item.summary || item.description) && (
          <p className="workspace-bookmark__description">{item.summary || item.description}</p>
        )}
        <PlatformMeta platform={item.source_platform} metadata={item.item_metadata} />
        <CardTags tags={item.tags} />
        <EnrichmentBadge status={item.enrichment_status} itemsAhead={itemsAhead} />
      </div>
      <button
        type="button"
        onClick={() => updateItem.mutate({ id: item.id, is_favorite: !item.is_favorite })}
        aria-label="Toggle favorite"
        aria-pressed={item.is_favorite}
        disabled={updateItem.isPending}
        className="workspace-icon-button workspace-bookmark__favorite"
        title={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star size={17} aria-hidden="true" fill={item.is_favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
