import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserPlus, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useRegister, useLogin } from "@/hooks/use-auth";

import { AuthLayout } from "@/components/auth/AuthLayout";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { hash } = useLocation();
  const inviteToken = new URLSearchParams(hash.slice(1)).get("invite");
  const register = useRegister();
  const login = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      await register.mutateAsync({
        username,
        email,
        password,
        display_name: displayName || undefined,
        invite_token: inviteToken ?? undefined,
      });
      // Auto-login after registration
      await login.mutateAsync({ identifier: email, password });
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const isConflict = err instanceof Error && err.message.includes("409");
      if (isConflict) {
        setError("Email or username already registered");
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    }
  };

  return (
    <AuthLayout title={inviteToken ? "Accept your invitation" : "Create an account"}>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label htmlFor="register-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Username
          </label>
          <input
            id="register-username"
            name="username"
            autoComplete="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            required
            minLength={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#F0F9FF] dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0096C7] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Email
          </label>
          <input
            id="register-email"
            name="email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#F0F9FF] dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0096C7] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="register-display-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Display Name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="register-display-name"
            name="nickname"
            autoComplete="nickname"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#F0F9FF] dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0096C7] focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="register-password"
              name="password"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
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

        {(error || register.isError) && (
          <div role="alert" className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error || "Registration failed. Please try again."}
          </div>
        )}

        <button
          type="submit"
          disabled={register.isPending || login.isPending}
          className="workspace-button workspace-button--primary w-full"
        >
          {register.isPending || login.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {register.isPending ? "Creating account..." : login.isPending ? "Signing in..." : "Create account"}
        </button>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="pocket-text-link"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
