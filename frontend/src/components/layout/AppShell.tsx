import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ShortcutsHelpDialog } from "@/components/ShortcutsHelpDialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";

export function AppShell() {
  useKeyboardShortcuts();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const contentRef = useRef<HTMLElement>(null);
  const closeNavigation = useCallback(() => {
    if (!mobileMenuOpen) return;
    setMobileMenuOpen(false);
    requestAnimationFrame(() => document.getElementById("workspace-menu-button")?.focus());
  }, [mobileMenuOpen]);

  useEffect(() => {
    const viewport = window.matchMedia("(min-width: 768px) and (min-height: 501px), (min-width: 768px) and (pointer: fine)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    viewport.addEventListener("change", closeOnDesktop);
    return () => viewport.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="workspace">
      <a href="#main-content" className="skip-to-content focus-ring">
        Skip to content
      </a>
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={closeNavigation} />
      <div className="workspace__body" inert={mobileMenuOpen}>
        <Header
          mobileMenuOpen={mobileMenuOpen}
          openNavigation={() => setMobileMenuOpen(true)}
          openSearch={() => setSearchOpen(true)}
        />
        <main id="main-content" tabIndex={-1} ref={contentRef} className="workspace__content">
          <div className="workspace__page">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
          <Footer />
        </main>
        <BottomNav />
      </div>
      <CommandPalette open={searchOpen} setOpen={setSearchOpen} />
      <ShortcutsHelpDialog />
    </div>
  );
}
