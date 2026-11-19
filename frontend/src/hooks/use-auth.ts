import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiFetch } from "@/api/client";

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  bio: string | null;
  created_at: string;
}

const currentUserQuery = {
  queryKey: ["currentUser"],
  queryFn: () => api.get<User>("/api/v1/auth/me"),
};

export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api.get<{
      registration_enabled: boolean;
      invites_enabled: boolean;
      password_reset_enabled: boolean;
    }>("/api/v1/auth/config"),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (identifier: string) =>
      api.post<{ sent: boolean }>("/api/v1/auth/password-reset/request", {
        email_or_username: identifier,
      }),
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const response = await apiFetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      if (response.status === 400) {
        throw new Error("This reset link is invalid, expired, or already used. Request a new link.");
      }
      if (response.status === 422) throw new Error("Check the password requirements and try again.");
      if (!response.ok) throw new Error("Couldn’t reset your password. Try again in a moment.");
    },
  });
}

export function isAuthError(error: unknown): boolean {
  return error instanceof Error && /^(401|403):/.test(error.message);
}

export function useCurrentUser() {
  return useQuery({
    ...currentUserQuery,
    retry: (failureCount, error) => failureCount < 1 && !isAuthError(error),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { identifier: string; password: string }) => {
      await api.login(data.identifier, data.password);
      await qc.fetchQuery({ ...currentUserQuery, staleTime: 0 });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { username: string; email: string; password: string; display_name?: string; invite_token?: string }) =>
      api.register(data.email, data.password, data.display_name, data.username, data.invite_token),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      display_name?: string;
      bio?: string;
      avatar_url?: string;
      username?: string;
      email?: string;
    }) => api.patch("/api/v1/auth/me", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currentUser"] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.patch("/api/v1/auth/password", data),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { current_password: string }) =>
      api.del("/api/v1/auth/me", data),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });
}
