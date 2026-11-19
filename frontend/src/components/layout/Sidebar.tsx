import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Archive, BookMarked, BookOpen, ChevronDown, Clock, Compass, FileText,
  FolderOpen, Highlighter, Home, LogOut, Network, PanelLeftClose, PanelLeftOpen,
  Rss, Search, Settings, Share2, Shield, Star, Tags, X, Zap,
} from "lucide-react";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useUIStore } from "@/stores/ui-store";

const navigationSections = [
  {
    label: "Workspace",
    items: [
      { path: "/", label: "Overview", icon: Home },
      { path: "/knowledge", label: "Library", icon: BookOpen },
      { path: "/knowledge?is_favorite=true", label: "Favorites", icon: Star },
      { path: "/reading-list", label: "Reading list", icon: BookMarked },
      { path: "/knowledge?is_archived=true", label: "Archive", icon: Archive },
    ],
  },
  {
    label: "Organize",
    items: [
      { path: "/collections", label: "Collections", icon: FolderOpen },
      { path: "/tags", label: "Tags", icon: Tags },
      { path: "/notes", label: "Notes", icon: FileText },
      { path: "/highlights", label: "Highlights", icon: Highlighter },
    ],
  },
];

const exploreItems = [
  { path: "/search", label: "Search", icon: Search },
  { path: "/feed", label: "Feed", icon: Rss },
  { path: "/shared", label: "Shared with me", icon: Share2 },
  { path: "/timeline", label: "Timeline", icon: Clock },
  { path: "/entities", label: "Knowledge graph", icon: Network },
  { path: "/rules", label: "Rules", icon: Zap },
];

const adminItem = { path: "/admin", label: "Admin", icon: Shield };
const settingsItem = { path: "/settings", label: "Settings", icon: Settings };
type NavigationItem = typeof settingsItem | (typeof navigationSections)[number]["items"][number] | (typeof exploreItems)[number];

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const { pathname, search } = useLocation();
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const sidebarRef = useRef<HTMLElement>(null);
  useFocusTrap(sidebarRef, mobileOpen);
  useEscapeKey(mobileOpen, onMobileClose);

  const params = new URLSearchParams(search);
  const preference = params.get("is_favorite") === "true" ? "is_favorite=true"
    : params.get("is_archived") === "true" ? "is_archived=true" : undefined;

  function isActive(path: string) {
    const [base, query] = path.split("?");
    if (base === "/") return pathname === "/";
    if (base === "/knowledge") {
      return pathname === base && preference === query;
    }
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  function navLink({ path, label, icon: Icon }: NavigationItem) {
    return (
      <Link
        key={path}
        to={path}
        className="workspace-nav__link"
        aria-label={label}
        aria-current={isActive(path) ? "page" : undefined}
        title={collapsed ? label : undefined}
        onClick={onMobileClose}
      >
        <Icon size={17} aria-hidden="true" />
        <span className="workspace-sidebar__label">{label}</span>
      </Link>
    );
  }

  const identity = user?.display_name || user?.username;

  return (
    <>
      {mobileOpen && (
        <button className="workspace-drawer-shade" type="button" aria-label="Dismiss navigation" tabIndex={-1} onClick={onMobileClose} />
      )}
      <aside
        id="workspace-navigation"
        ref={sidebarRef}
        className="workspace-sidebar"
        data-collapsed={collapsed}
        data-mobile-open={mobileOpen}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Workspace navigation"
      >
        <div className="workspace-sidebar__brand">
          <Link to="/" className="workspace-brand" aria-label="4DPocket home" onClick={onMobileClose}>
            <img src="/icons/icon-192.png" width="32" height="32" alt="" />
            <span className="workspace-sidebar__label">4DPocket</span>
          </Link>
          <button type="button" className="workspace-icon-button workspace-sidebar__close" onClick={onMobileClose} aria-label="Close navigation">
            <X size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="workspace-icon-button workspace-sidebar__collapse"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
        </div>

        <nav aria-label="Main navigation" className="workspace-nav">
          {navigationSections.map((section) => (
            <div key={section.label} className="workspace-nav__group">
              <p className="workspace-nav__label">{section.label}</p>
              {section.items.map(navLink)}
            </div>
          ))}
          <details className="workspace-nav__explore" open={exploreItems.some(({ path }) => isActive(path)) || undefined}>
            <summary className="workspace-nav__link" aria-label="Explore" title={collapsed ? "Explore" : undefined}>
              <Compass size={17} aria-hidden="true" />
              <span className="workspace-sidebar__label">Explore</span>
              <ChevronDown className="workspace-nav__chevron workspace-sidebar__label" size={14} aria-hidden="true" />
            </summary>
            <div className="workspace-nav__nested">{exploreItems.map(navLink)}</div>
          </details>
        </nav>

        <div className="workspace-sidebar__bottom">
          <nav aria-label="Workspace settings">
            {user?.role === "admin" && navLink(adminItem)}
            {navLink(settingsItem)}
          </nav>
          {identity && (
            <div className="workspace-sidebar__account">
              <span className="workspace-sidebar__initial" aria-hidden="true">{identity.charAt(0).toUpperCase()}</span>
              <span className="workspace-sidebar__label truncate">{identity}</span>
              <button type="button" className="workspace-icon-button" onClick={() => logout.mutate()} aria-label="Sign out" title="Sign out">
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
