import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuthConfig, useLogin } from "@/hooks/use-auth";

import { AuthLayout } from "@/components/auth/AuthLayout";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const login = useLogin();
  const { data: authConfig } = useAuthConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ identifier, password });
      const returnTo = searchParams.get("returnTo") || "/";
      let destination = "/";
      if (returnTo.startsWith("/") && URL.canParse(returnTo, window.location.origin)) {
        const target = new URL(returnTo, window.location.origin);
        if (target.origin === window.location.origin && !target.pathname.startsWith("//")) {
          destination = target.pathname + target.search + target.hash;
        }
      }
      navigate(destination, { replace: true });
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <AuthLayout title="Sign in">
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {state?.passwordReset && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
            Password reset. Sign in with your new password.
          </p>
        )}
        <div>
          <label htmlFor="login-identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Email or Username
          </label>
          <input
            id="login-identifier"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or username"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#F0F9FF] dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0096C7] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <Link to="/forgot-password" className="pocket-text-link">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full px-4 py-2.5 pr-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#F0F9FF] dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0096C7] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {login.isError && (
          <div role="alert" className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Invalid credentials
          </div>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="workspace-button workspace-button--primary w-full"
        >
          {login.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>

        {authConfig?.registration_enabled && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="pocket-text-link"
            >
              Create one
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
