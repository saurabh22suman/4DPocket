import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon, Loader2, SlidersHorizontal, StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { api } from "@/api/client";
import { BookmarkCard } from "@/components/bookmark/BookmarkCard";
import NoteCard from "@/components/bookmark/NoteCard";
import type { Note } from "@/hooks/use-notes";
import { platformLabel } from "@/lib/platforms";

interface Item {
  id: string;
  item_type: string;
  source_platform: string;
  url: string | null;
  title: string | null;
  description: string | null;
  content: string | null;
  summary: string | null;
  media: Array<{ type: string; url: string; role: string }>;
  item_metadata: Record<string, unknown>;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  title_snippet?: string | null;
  content_snippet?: string | null;
  sources?: string[];
}

interface SearchFilters {
  platforms: Array<{ name: string; count: number }>;
  types: string[];
  tags: Array<{ name: string; slug: string; count: number }>;
}

interface UnifiedResult {
  items: Item[];
  notes: Note[];
  total: number;
}

const TYPE_LABELS: Record<string, string> = {
  url: "Link",
  note: "Note",
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  pdf: "PDF",
  article: "Article",
  file: "File",
};

type SearchMode = "fulltext" | "semantic" | "hybrid";

function formatPlatformLabel(raw: string | undefined | null): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^SourcePlatform\./, "");
  return platformLabel(cleaned);
}

function formatTypeLabel(raw: string | undefined | null): string {
  if (!raw) return "";
  return TYPE_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>("fulltext");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { data: filters } = useQuery<SearchFilters>({
    queryKey: ["search-filters"],
    queryFn: () => api.get("/api/v1/search/filters"),
  });

  // Build filter params
  const filterParams = new URLSearchParams();
  if (mode !== "semantic") {
    if (selectedPlatform) filterParams.set("source_platform", selectedPlatform);
    if (selectedType) filterParams.set("item_type", selectedType);
  }
  if (mode === "fulltext") {
    if (selectedTag) filterParams.set("tag", selectedTag);
    if (showFavorites) filterParams.set("is_favorite", "true");
    if (showArchived) filterParams.set("is_archived", "true");
  }
  const filterStr = filterParams.toString() ? `&${filterParams.toString()}` : "";

  // Unified search (items + notes) — default mode
  const unifiedUrl = query.length >= 2
    ? `/api/v1/search/unified?q=${encodeURIComponent(query)}${filterStr}`
    : null;

  const { data: unifiedResults, isLoading: unifiedLoading, isFetching: unifiedFetching, isError: unifiedError, refetch: retryUnified } =
    useQuery<UnifiedResult>({
      queryKey: ["search-unified", unifiedUrl],
      queryFn: () => api.get(unifiedUrl!),
      enabled: mode === "fulltext" && query.length >= 2,
    });

  // Semantic search
  const semanticUrl = query.length >= 2
    ? `/api/v1/search/semantic?q=${encodeURIComponent(query)}${filterStr}`
    : null;

  const { data: semanticResults, isLoading: semanticLoading, isFetching: semanticFetching, isError: semanticError, refetch: retrySemantic } =
    useQuery<Item[]>({
      queryKey: ["search-semantic", semanticUrl],
      queryFn: () => api.get(semanticUrl!),
      enabled: mode === "semantic" && query.length >= 2,
    });

  // Hybrid search
  const hybridUrl = query.length >= 2
    ? `/api/v1/search/hybrid?q=${encodeURIComponent(query)}${filterStr}`
    : null;

  const { data: hybridResults, isLoading: hybridLoading, isFetching: hybridFetching, isError: hybridError, refetch: retryHybrid } =
    useQuery<Item[]>({
      queryKey: ["search-hybrid", hybridUrl],
      queryFn: () => api.get(hybridUrl!),
      enabled: mode === "hybrid" && query.length >= 2,
    });

  const items = mode === "fulltext"
    ? (unifiedResults?.items ?? [])
    : mode === "semantic"
    ? (semanticResults ?? [])
    : (hybridResults ?? []);

  const notes = mode === "fulltext" ? (unifiedResults?.notes ?? []) : [];
  const isLoading = mode === "fulltext" ? unifiedLoading : mode === "semantic" ? semanticLoading : hybridLoading;
  const isFetching = mode === "fulltext" ? unifiedFetching : mode === "semantic" ? semanticFetching : hybridFetching;
  const isError = mode === "fulltext" ? unifiedError : mode === "semantic" ? semanticError : hybridError;
  const retrySearch = mode === "fulltext" ? retryUnified : mode === "semantic" ? retrySemantic : retryHybrid;
  const totalResults = items.length + notes.length;
  const showSkeleton = (isLoading || isFetching) && query.length >= 2;

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      if (input) {
        setSearchParams({ q: input }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [input, setSearchParams]);

  const modes: { key: SearchMode; label: string; hint: string }[] = [
    { key: "fulltext", label: "Full-text", hint: "Search for matching words" },
    { key: "hybrid", label: "Hybrid", hint: "Search by words and meaning" },
    { key: "semantic", label: "Semantic", hint: "Search by meaning" },
  ];
  const activeFilters = Number(!!selectedPlatform) + Number(!!selectedType)
    + (mode === "fulltext" ? Number(!!selectedTag) + Number(showFavorites) + Number(showArchived) : 0);

  return (
    <div className="pocket-search">
      <h1 className="pocket-heading">Search</h1>

      <div className="pocket-search__input">
        <SearchIcon size={19} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search your knowledge base"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Try a title, keyword, or URL"
        />
        {showSkeleton && <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" />}
      </div>

      <div className="pocket-search__controls" role="group" aria-label="Search mode">
        {modes.map(({ key, label, hint }) => (
          <button type="button" key={key} onClick={() => setMode(key)} title={hint}
            aria-pressed={mode === key} className="workspace-button">
            {label}
          </button>
        ))}
      </div>

      {mode !== "semantic" && (mode === "fulltext" || filters?.platforms?.length || filters?.types?.length) ? (
        <details className="pocket-search__filter-section">
          <summary><SlidersHorizontal size={16} aria-hidden="true" /> Filters{activeFilters > 0 && ` (${activeFilters})`}</summary>
          <div className="pocket-search__filters">
            {!!filters?.platforms?.length && (
              <label className="pocket-library__select">
                <span className="sr-only">Source</span>
                <select value={selectedPlatform ?? ""} onChange={(event) => setSelectedPlatform(event.target.value || null)}>
                  <option value="">All sources</option>
                  {filters.platforms.map((platform) => (
                    <option key={platform.name} value={platform.name}>{formatPlatformLabel(platform.name)} ({platform.count})</option>
                  ))}
                </select>
              </label>
            )}
            {!!filters?.types?.length && (
              <label className="pocket-library__select">
                <span className="sr-only">Content type</span>
                <select value={selectedType ?? ""} onChange={(event) => setSelectedType(event.target.value || null)}>
                  <option value="">All types</option>
                  {filters.types.map((type) => <option key={type} value={type}>{formatTypeLabel(type)}</option>)}
                </select>
              </label>
            )}
            {mode === "fulltext" && !!filters?.tags?.length && (
              <label className="pocket-library__select">
                <span className="sr-only">Tag</span>
                <select value={selectedTag ?? ""} onChange={(event) => setSelectedTag(event.target.value || null)}>
                  <option value="">All tags</option>
                  {filters.tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name} ({tag.count})</option>)}
                </select>
              </label>
            )}
          </div>
          {mode === "fulltext" && (
            <div className="pocket-search__toggles">
              <label><input type="checkbox" checked={showFavorites} onChange={(event) => setShowFavorites(event.target.checked)} /> Favorites only</label>
              <label><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Archived only</label>
            </div>
          )}
        </details>
      ) : null}

      {!query || query.length < 2 ? (
        query.length === 1 ? <p className="pocket-search__hint">Enter at least 2 characters.</p>
          : mode === "fulltext" && <p className="pocket-search__hint">Use <code>is:favorite</code> or <code>tag:name</code> to narrow your search.</p>
      ) : showSkeleton && totalResults === 0 ? (
        <div className="pocket-list" role="status" aria-label="Searching">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="pocket-skeleton-row" aria-hidden="true"><span /><i /></div>)}
        </div>
      ) : isError && totalResults === 0 ? (
        <div className="pocket-empty" role="alert">
          <p>Couldn’t complete the search.</p>
          <button type="button" onClick={() => void retrySearch()} className="workspace-button">Try again</button>
        </div>
      ) : totalResults === 0 ? (
        <div className="pocket-empty">
          <h2>No results for “{query}”</h2>
          <p>Try different words{activeFilters > 0 ? " or change the filters" : ""}.</p>
        </div>
      ) : (
        <div>
          {totalResults > 0 && (
            <p className="pocket-search__hint mb-4 [overflow-wrap:anywhere]" aria-live="polite">
              {totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            </p>
          )}

          {/* Note results */}
          {notes.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Notes ({notes.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            </div>
          )}

          {/* Item results */}
          {items.length > 0 && (
            <div className="pocket-search__results">
              {items.map((item) => (
                <div key={item.id}>
                  <BookmarkCard item={item} variant="list" />
                  {item.content_snippet && (
                    <p
                      className="mt-1 ml-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.content_snippet, { ALLOWED_TAGS: ["mark"] }) }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
