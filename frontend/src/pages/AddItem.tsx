import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { BookmarkForm } from "@/components/bookmark/BookmarkForm";
import { useCreateItem } from "@/hooks/use-items";

export default function AddItem() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mutate: saveSharedItem, status: shareStatus } = useCreateItem();
  const submittedKey = useRef<string | null>(null);
  const sharedUrl = searchParams.get("url") || searchParams.get("text")?.match(/https?:\/\/\S+/)?.[0];
  const sharedTitle = searchParams.get("title") || undefined;

  useEffect(() => {
    if (!sharedUrl) return;
    const key = JSON.stringify([sharedUrl, sharedTitle]);
    if (key === submittedKey.current) return;
    submittedKey.current = key;
    saveSharedItem({ url: sharedUrl, title: sharedTitle });
  }, [sharedUrl, sharedTitle, saveSharedItem]);

  useEffect(() => {
    if (!sharedUrl || shareStatus !== "success") return;
    const timer = window.setTimeout(() => navigate("/", { replace: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [navigate, sharedUrl, shareStatus]);

  if (sharedUrl) {
    return (
      <div className="pocket-add">
        <h1 className="pocket-heading">Save an item</h1>
        {shareStatus === "error" ? (
          <div className="pocket-empty" role="alert">
            <p>Couldn’t save the shared link.</p>
            <Link to="/add" replace className="workspace-button">Open save form</Link>
          </div>
        ) : (
          <div className="pocket-empty" role="status">
            {shareStatus === "success" ? <CheckCircle2 size={24} aria-hidden="true" /> : <Loader2 size={24} className="motion-safe:animate-spin" aria-hidden="true" />}
            <p>{shareStatus === "success" ? "Link saved." : "Saving the shared link…"}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pocket-add">
      <Link to="/" className="pocket-text-link"><ArrowLeft size={16} aria-hidden="true" /> Overview</Link>
      <h1 className="pocket-heading">Save an item</h1>
      <BookmarkForm onCreated={(item) => navigate(`/item/${item.id}`)} />
    </div>
  );
}
