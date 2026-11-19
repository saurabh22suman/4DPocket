import type { ReactNode } from "react";

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="pocket-auth">
      <section className="pocket-auth__panel" aria-labelledby="pocket-auth-title">
        <div className="workspace-brand">
          <img src="/icons/icon-192.png" width="34" height="34" alt="" /> 4DPocket
        </div>
        <h1 id="pocket-auth-title" className="pocket-heading">{title}</h1>
        {children}
      </section>
    </main>
  );
}
