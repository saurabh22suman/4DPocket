import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthError, useCurrentUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export function AuthGuard() {
  const { pathname, search, hash } = useLocation();
  const { error, isPending, refetch } = useCurrentUser();

  if (isAuthError(error)) {
    const returnTo = encodeURIComponent(pathname + search + hash);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (isPending) {
    return (
      <div role="status" className="flex items-center justify-center min-h-dvh bg-gray-50 dark:bg-gray-950">
        <Loader2 aria-hidden="true" className="mr-3 size-6 motion-safe:animate-spin text-sky-700" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p role="alert">Couldn’t check your session. Check your connection and try again.</p>
        <button type="button" onClick={() => void refetch()} className="rounded-lg bg-sky-800 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2">
          Try again
        </button>
      </div>
    );
  }

  return <Outlet />;
}
