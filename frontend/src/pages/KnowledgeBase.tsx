import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpDown, BookOpen, Check, CheckSquare, Grid3x3, List, Loader2, RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useItems } from "@/hooks/use-items";
import { useNotes } from "@/hooks/use-notes";
import { useUIStore } from "@/stores/ui-store";
import { BookmarkCard } from "@/components/bookmark/BookmarkCard";
import NoteCard from "@/components/bookmark/NoteCard";
import { platformLabel, platformLabels } from "@/lib/platforms";

export default function KnowledgeBase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isFavorite = searchParams.get("is_favorite") === "true" ? true : undefined;
  const isArchived = searchParams.get("is_archived") === "true" ? true : undefined;
  const tagId = searchParams.get("tag_id") || undefined;
  const requestedSource = searchParams.get("source");
  const platform = requestedSource && Object.hasOwn(platformLabels, requestedSource) ? requestedSource : "";
  function setPlatform(source: string) {
    const next = new URLSearchParams(searchParams);
    if (source) next.set("source", source);
    else next.delete("source");
    setSearchParams(next, { replace: true });
  }
  const [sortKey, setSortKey] = useState("created_at:desc");
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkTagInput, setShowBulkTagInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();

  const [sortBy, sortOrder] = sortKey.split(":");
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching } =
    useItems({ sort_by: sortBy, sort_order: sortOrder, source_platform: platform || undefined, is_favorite: isFavorite, is_archived: isArchived, tag_id: tagId });

  const items = data?.pages.flat() ?? [];
  const notes = useNotes({ is_archived: isArchived, is_favorite: isFavorite });
  const includeNotes = !platform && !tagId && !selecting;
  const visibleNotes = includeNotes ? notes.data ?? [] : [];
  const libraryTitle = isFavorite ? "Favorites" : isArchived ? "Archive" : tagId ? "Tagged items" : "Library";


  const bulkAction = useMutation({
    mutationFn: (data: { action: string; item_ids: string[]; tag_name?: string }) =>
      api.post("/api/v1/items/bulk", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setSelected(new Set());
      setSelecting(false);
    },
  });

  const toggleSelectItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkTag = () => {
    if (!bulkTagInput.trim()) return;
    bulkAction.mutate({ action: "tag", item_ids: Array.from(selected), tag_name: bulkTagInput.trim() });
    setBulkTagInput("");
    setShowBulkTagInput(false);
  };

  const handleBulkArchive = () => {
    bulkAction.mutate({ action: "archive", item_ids: Array.from(selected) });
  };

  const handleBulkDelete = () => {
    bulkAction.mutate({ action: "delete", item_ids: Array.from(selected) });
    setConfirmDelete(false);
  };

  return (
    <div className="pocket-library">
      <div className="pocket-page-title">
        <h1 className="pocket-heading">{libraryTitle}</h1>
      </div>

      <div className="pocket-library__toolbar">
        <div className="pocket-library__filters">
          <label className="pocket-library__select">
            <span className="sr-only">Source</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option value="">All sources</option>
              {Object.entries(platformLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="pocket-library__select">
            <ArrowUpDown size={15} aria-hidden="true" />
            <span className="sr-only">Sort order</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="title:asc">Title A–Z</option>
              <option value="title:desc">Title Z–A</option>
              <option value="updated_at:desc">Recently updated</option>
            </select>
          </label>
        </div>
        <div className="pocket-library__actions">
          <button type="button" className="workspace-icon-button" onClick={() => void Promise.all([refetch(), notes.refetch()])} disabled={isRefetching} aria-label="Refresh" title="Refresh">
            <RefreshCw size={17} className={isRefetching ? "motion-safe:animate-spin" : ""} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="workspace-button pocket-library__select-items"
            aria-pressed={selecting}
            onClick={() => {
              setSelecting((value) => !value);
              setSelected(new Set());
              setShowBulkTagInput(false);
              setConfirmDelete(false);
            }}
          >
            <CheckSquare size={16} aria-hidden="true" /> Select
          </button>
          <div className="pocket-view-switch" role="group" aria-label="Library view">
            <button type="button" onClick={() => setViewMode("list")} className="workspace-icon-button" aria-label="List view" aria-pressed={viewMode === "list"} title="List view">
              <List size={17} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setViewMode("grid")} className="workspace-icon-button" aria-label="Grid view" aria-pressed={viewMode === "grid"} title="Grid view">
              <Grid3x3 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {isLoading || (!items.length && includeNotes && notes.isLoading) ? (
        <div className="pocket-list" role="status" aria-label="Loading library">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="pocket-skeleton-row" aria-hidden="true"><span /><i /></div>)}
        </div>
      ) : (isError && !data) || (!items.length && includeNotes && notes.isError && !notes.data) ? (
        <div role="alert" className="pocket-empty">
          <p>Couldn’t load the library.</p>
          <button type="button" className="workspace-button" onClick={() => void Promise.all([refetch(), notes.refetch()])}>Try again</button>
        </div>
      ) : !items.length && !visibleNotes.length ? (
        <div className="pocket-empty">
          <BookOpen size={24} aria-hidden="true" />
          <h2>No items found</h2>
          {platform ? (
            <>
              <p>No saves from {platformLabel(platform)} in this view.</p>
              <button className="workspace-button" type="button" onClick={() => setPlatform("")}>Show all sources</button>
            </>
          ) : !isFavorite && !isArchived && !tagId ? (
            <Link to="/add" className="pocket-text-link">Save your first item</Link>
          ) : (
            <Link to="/knowledge" className="pocket-text-link">Open library</Link>
          )}
        </div>
      ) : (
        <>
          <div className={`pocket-library__items pocket-library__items--${viewMode}`}>
            {items.map((item) => {
              if (!selecting) return <BookmarkCard key={item.id} item={item} variant={viewMode} />;
              const checked = selected.has(item.id);
              return (
                <div key={item.id} className="pocket-selectable" data-selected={checked}>
                  <div inert>
                    <BookmarkCard item={item} variant={viewMode} />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSelectItem(item.id)}
                    className="pocket-selectable__button"
                    aria-label={`Select ${item.title || item.url || "untitled item"}`}
                    aria-pressed={checked}
                  >
                    <span>{checked && <Check size={14} aria-hidden="true" />}</span>
                  </button>
                </div>
              );
            })}
            {visibleNotes.map((note) => <NoteCard key={`note-${note.id}`} note={note} variant={viewMode === "list" ? "compact" : "grid"} />)}
          </div>

          {hasNextPage && (
            <div className="pocket-library__more">
              <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage} className="workspace-button">
                {isFetchingNextPage && <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      {selecting && selected.size > 0 && (
        <div className="pocket-bulk-actions">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{selected.size} selected</span>
          {showBulkTagInput ? (
            <>
              <input
                type="text"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBulkTag()}
                placeholder="Tag name"
                aria-label="Tag name"
                autoFocus
                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button onClick={handleBulkTag} disabled={!bulkTagInput.trim()} className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-all cursor-pointer disabled:opacity-50">Apply</button>
              <button onClick={() => { setShowBulkTagInput(false); setBulkTagInput(""); }} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm cursor-pointer">Cancel</button>
            </>
          ) : confirmDelete ? (
            <>
              <span className="text-sm text-red-600 dark:text-red-400">Delete {selected.size} item(s)?</span>
              <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all cursor-pointer">Confirm</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm cursor-pointer">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowBulkTagInput(true)} className="px-3 py-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-sm font-medium hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-all cursor-pointer">Tag</button>
              <button onClick={handleBulkArchive} className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all cursor-pointer">Archive</button>
              <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-all cursor-pointer">Delete</button>
              <button onClick={() => { setSelecting(false); setSelected(new Set()); }} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm cursor-pointer">Cancel</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
