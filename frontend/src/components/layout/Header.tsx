import { Link, useLocation } from "react-router-dom";
import { Search, Plus, Sun, Moon, Monitor, Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";

interface HeaderProps {
  mobileMenuOpen: boolean;
  openNavigation: () => void;
  openSearch: () => void;
}

export function Header({ mobileMenuOpen, openNavigation, openSearch }: HeaderProps) {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const { pathname } = useLocation();
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const searchShortcut = navigator.userAgent.includes("Mac") ? "⌘ K" : "Ctrl K";

  return (
    <header className="workspace-header">
      <button
        type="button"
        id="workspace-menu-button"
        onClick={openNavigation}
        className="workspace-icon-button workspace-header__menu"
        aria-label="Open navigation"
        aria-controls="workspace-navigation"
        aria-expanded={mobileMenuOpen}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <Link to="/" className="workspace-header__brand workspace-brand" aria-label="4DPocket home">
        <img src="/icons/icon-192.png" width="28" height="28" alt="" /> 4DPocket
      </Link>
      <button
        type="button"
        onClick={openSearch}
        className="workspace-header__search"
        aria-label="Search your pocket"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={17} aria-hidden="true" />
        <span>Search your pocket</span>
        <kbd aria-hidden="true">{searchShortcut}</kbd>
      </button>
      <div className="workspace-header__actions">
        <Link to="/add" className="workspace-button workspace-button--primary" data-on-overview={pathname === "/"}>
          <Plus size={17} aria-hidden="true" />
          <span>Save item</span>
        </Link>
        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          className="workspace-icon-button workspace-header__theme"
          title={`Theme: ${theme}`}
          aria-label={`Switch theme (current: ${theme})`}
        >
          <ThemeIcon size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
