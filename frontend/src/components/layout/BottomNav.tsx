import { NavLink } from "react-router-dom";
import { Home, BookOpen, Search, Rss, Settings } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/knowledge", label: "Library", icon: BookOpen },
  { path: "/search", label: "Search", icon: Search },
  { path: "/feed", label: "Feed", icon: Rss },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav aria-label="Mobile navigation" className="workspace-bottom-nav">
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink key={path} to={path} end={path === "/"} className="workspace-bottom-nav__link">
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
