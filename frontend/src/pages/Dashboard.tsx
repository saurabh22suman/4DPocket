import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Folder, Link2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useCreateItem, useItems } from "@/hooks/use-items";
import { useCollections } from "@/hooks/use-collections";
import { BookmarkCard } from "@/components/bookmark/BookmarkCard";
import { PlatformIcon } from "@/components/common/PlatformIcon";
import { platformLabel } from "@/lib/platforms";

interface Stats {
  total_items: number;
  items_this_week: number;
  items_by_platform: Record<string, number>;
}

function QuickSave() {
  const create = useCreateItem();
  const [link, setLink] = useState("");
  const [invalidLink, setInvalidLink] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = link.trim();
    if (!input || create.isPending) return;
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
        setInvalidLink(true);
        return;
      }
      create.mutate({ url: url.href }, { onSuccess: () => setLink("") });
    } catch {
      setInvalidLink(true);
    }
  }

  return (
    <section className="pocket-capture" aria-labelledby="quick-save-title">
      <div className="pocket-capture__header">
        <h2 id="quick-save-title" className="pocket-section-heading">Save a link</h2>
        <Link to="/add" className="pocket-text-link">More save options <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      <form className="pocket-capture__form" onSubmit={save} aria-busy={create.isPending}>
        <div className="pocket-capture__input">
          <Link2 size={18} aria-hidden="true" />
          <label htmlFor="quick-save-url" className="sr-only">Link to save</label>
          <input
            id="quick-save-url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Paste a link"
            required
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              if (invalidLink) setInvalidLink(false);
              if (create.isError || create.isSuccess) create.reset();
            }}
            aria-invalid={invalidLink}
            aria-describedby={invalidLink || create.isError ? "quick-save-error" : undefined}
          />
        </div>
        <button className="workspace-button workspace-button--primary" type="submit" disabled={create.isPending || !link.trim()}>
          <Plus size={17} aria-hidden="true" /> {create.isPending ? "Saving…" : "Save link"}
        </button>
      </form>
      {(invalidLink || create.isError) && (
        <p className="pocket-error" id="quick-save-error" role="alert">
          {invalidLink ? "Enter a valid web link." : "Couldn’t save this link. Check the address and try again."}
        </p>
      )}
      {create.isSuccess && (
        <div className="pocket-capture__saved" role="status">
          <Check size={16} aria-hidden="true" /> Link saved.
          <Link to={`/item/${create.data.id}`} className="pocket-text-link">View item</Link>
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const stats = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/v1/stats"),
  });
  const items = useItems({ is_archived: false });
  const collections = useCollections();
  const recentItems = (items.data?.pages[0] ?? []).slice(0, 5);
  const platforms = Object.entries(stats.data?.items_by_platform ?? {})
    .map(([source, count]) => [source.replace(/^SourcePlatform\./, ""), count] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="pocket-dashboard">
      <div className="pocket-page-title">
        <h1 className="pocket-heading">Your pocket</h1>
        {stats.data && (
          <p className="pocket-dashboard__counts">
            {stats.data.total_items} saved {stats.data.total_items === 1 ? "item" : "items"}
            {stats.data.items_this_week > 0 && <> <span aria-hidden="true">·</span> {stats.data.items_this_week} this week</>}
          </p>
        )}
      </div>

      <QuickSave />

      <div className="pocket-dashboard__columns">
        <section aria-labelledby="recent-items-title">
          <div className="pocket-section-bar">
            <h2 id="recent-items-title" className="pocket-section-heading">Recent items</h2>
            <Link to="/knowledge" className="pocket-text-link">Open library <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          {items.isLoading ? (
            <div className="pocket-list" role="status" aria-label="Loading saved items">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="pocket-skeleton-row" aria-hidden="true"><span /><i /></div>
              ))}
            </div>
          ) : items.isError && !items.data ? (
            <div role="alert" className="pocket-empty">
              <p>Couldn’t load your recent items.</p>
              <button type="button" className="workspace-button" onClick={() => void items.refetch()}>Try again</button>
            </div>
          ) : recentItems.length === 0 ? (
            <div className="pocket-empty">
              <BookOpen size={24} aria-hidden="true" />
              <h3>No saved items</h3>
              <p>Save a web link above or add a note to get started.</p>
              <Link to="/notes" className="pocket-text-link">Open notes <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          ) : (
            <ul className="pocket-list">
              {recentItems.map((item) => <li key={item.id}><BookmarkCard item={item} variant="compact" /></li>)}
            </ul>
          )}
        </section>

        <div className="pocket-dashboard__side">
          <section aria-labelledby="overview-collections-title">
            <div className="pocket-section-bar">
              <h2 id="overview-collections-title" className="pocket-section-heading">Collections</h2>
              <Link to="/collections" className="pocket-text-link">View all <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            {collections.isLoading ? (
              <div className="pocket-list" role="status" aria-label="Loading collections">
                <div className="pocket-skeleton-row" aria-hidden="true"><span /><i /></div>
              </div>
            ) : collections.isError && !collections.data ? (
              <div className="pocket-empty" role="alert">
                <p>Couldn’t load collections.</p>
                <button type="button" className="workspace-button" onClick={() => void collections.refetch()}>Try again</button>
              </div>
            ) : collections.data?.length ? (
              <ul className="pocket-list">
                {collections.data.slice(0, 3).map((collection) => (
                  <li key={collection.id}>
                    <Link to={`/collections/${collection.id}`} className="pocket-list__link">
                      <Folder size={17} aria-hidden="true" />
                      <span>{collection.name}</span>
                      <ArrowRight size={15} className="pocket-list__arrow" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pocket-empty">
                <p>Group related saves into a collection.</p>
                <Link to="/collections" className="pocket-text-link">New collection <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            )}
          </section>

          {platforms.length > 0 && (
            <section aria-labelledby="overview-sources-title">
              <div className="pocket-section-bar">
                <h2 id="overview-sources-title" className="pocket-section-heading">Sources</h2>
              </div>
              <ul className="pocket-list">
                {platforms.map(([source, count]) => (
                  <li key={source}>
                    <Link to={`/knowledge?source=${encodeURIComponent(source)}`} className="pocket-list__link">
                      <PlatformIcon platform={source} className="size-4" />
                      <span>{platformLabel(source)}</span>
                      <span className="pocket-list__count" aria-label={`${count} saved items`}>{count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
