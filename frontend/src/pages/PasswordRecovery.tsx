import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthConfig, useConfirmPasswordReset, useRequestPasswordReset } from "@/hooks/use-auth";

const inputStyle = "w-full rounded-xl border border-gray-200 bg-sky-50 px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-sky-700 dark:border-gray-700 dark:bg-gray-800";
const buttonStyle = "w-full rounded-xl bg-sky-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const linkStyle = "text-sm font-medium text-sky-800 hover:underline dark:text-sky-300";
const passwordRequirements = "Use at least 8 characters, including an uppercase letter, a number, and a special character.";

function RecoveryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F0F9FF] p-4 dark:bg-[#0C1222]">
      <div className="w-full max-w-sm">
        <img src="/icons/icon-512.png" alt="4DPocket" className="mx-auto mb-6 size-16 rounded-xl" />
        <section className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {children}
          <Link to="/login" className={linkStyle}>Back to sign in</Link>
        </section>
      </div>
    </main>
  );
}

function RequestReset() {
  const config = useAuthConfig();
  const reset = useRequestPasswordReset();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const identifier = String(new FormData(event.currentTarget).get("identifier")).trim();
    if (identifier) reset.mutate(identifier);
  }

  return (
    <RecoveryCard title="Forgot your password?">
      {config.isPending && <p role="status" className="text-sm">Checking recovery availability…</p>}
      {config.isError && (
        <div role="alert" className="space-y-2 text-sm">
          <p>Couldn’t check whether email recovery is available.</p>
          <button type="button" className={linkStyle} onClick={() => void config.refetch()}>Try again</button>
        </div>
      )}
      {config.data?.password_reset_enabled === false && (
        <p role="status" className="text-sm text-gray-700 dark:text-gray-300">
          Email password reset is unavailable. Contact your 4DPocket administrator for help.
        </p>
      )}
      {config.data?.password_reset_enabled && (
        reset.isSuccess ? (
          <p role="status" className="text-sm text-gray-700 dark:text-gray-300">
            If that account exists, a reset link will arrive by email. Check your spam folder if it doesn’t appear.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4" aria-busy={reset.isPending}>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Enter your email or username to request a reset link.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="recovery-identifier" className="text-sm font-medium">Email or Username</label>
              <input id="recovery-identifier" name="identifier" className={inputStyle}
                autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} />
            </div>
            {reset.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{reset.error.message}</p>}
            <button type="submit" className={buttonStyle} disabled={reset.isPending}>
              {reset.isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )
      )}
    </RecoveryCard>
  );
}

function SetNewPassword({ token }: { token: string }) {
  const [validationError, setValidationError] = useState("");
  const reset = useConfirmPasswordReset();
  const navigate = useNavigate();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password"));
    if (password !== fields.get("confirm-password")) {
      setValidationError("The two passwords must match.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setValidationError("Choose a shorter password.");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setValidationError(passwordRequirements);
      return;
    }
    setValidationError("");
    reset.mutate({ token, password }, {
      onSuccess: () => navigate("/login", { replace: true, state: { passwordReset: true } }),
    });
  }

  return (
    <RecoveryCard title="Reset your password">
      {token ? (
        <form onSubmit={submit} className="space-y-4" aria-busy={reset.isPending}>
          <div className="space-y-1.5">
            <label htmlFor="recovery-password" className="text-sm font-medium">New password</label>
            <input id="recovery-password" name="password" type="password" className={inputStyle}
              autoComplete="new-password" aria-describedby="recovery-password-rules" required minLength={8} />
            <p id="recovery-password-rules" className="text-sm text-gray-700 dark:text-gray-300">{passwordRequirements}</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="recovery-confirm" className="text-sm font-medium">Confirm new password</label>
            <input id="recovery-confirm" name="confirm-password" type="password" className={inputStyle}
              autoComplete="new-password" required />
          </div>
          {(validationError || reset.isError) && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">{validationError || reset.error?.message}</p>
          )}
          <button type="submit" className={buttonStyle} disabled={reset.isPending}>
            {reset.isPending ? "Resetting…" : "Reset password"}
          </button>
        </form>
      ) : (
        <p role="alert" className="text-sm text-gray-700 dark:text-gray-300">Open the link from your reset email.</p>
      )}
      <div><Link to="/forgot-password" replace className={linkStyle}>Request a new link</Link></div>
    </RecoveryCard>
  );
}

export default function PasswordRecovery() {
  const { hash, pathname, search } = useLocation();
  if (pathname === "/forgot-password") return <RequestReset />;
  const token = new URLSearchParams(hash.slice(1)).get("token") ?? new URLSearchParams(search).get("token") ?? "";
  return <SetNewPassword key={token} token={token} />;
}
