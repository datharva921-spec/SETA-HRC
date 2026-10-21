import { apiClient } from "../lib/api-client";
import type { Role, User } from "../lib/types";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    name: string;
    email: string;
    trusted_role: Role | null;
    status: string;
    hospital_id?: string | null;
  };
}

export function trustedRole(userOrMetadata: any): Role | null {
  if (!userOrMetadata) return null;
  const role = userOrMetadata.role || userOrMetadata.trusted_role || userOrMetadata.trustedRole;
  if (role === "dispatcher" || role === "hospital" || role === "paramedic" || role === "admin") {
    return role as Role;
  }
  return null;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem("seta_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem("seta_token");
}

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>("/auth/login", { email, password });
    localStorage.setItem("seta_token", res.data.access_token);
    localStorage.setItem("seta_user", JSON.stringify(res.data.user));
    window.dispatchEvent(new Event("seta_auth_change"));
    return res.data;
  },

  register: async (name: string, email: string, password: string, role: string = "dispatcher"): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>("/auth/register", { name, email, password, role });
    localStorage.setItem("seta_token", res.data.access_token);
    localStorage.setItem("seta_user", JSON.stringify(res.data.user));
    window.dispatchEvent(new Event("seta_auth_change"));
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>("/auth/me");
    localStorage.setItem("seta_user", JSON.stringify(res.data));
    return res.data;
  },

  getUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<User[]>("/auth/users");
    return res.data;
  },

  updateUserStatus: async (userId: string, status: string): Promise<User> => {
    const res = await apiClient.patch<User>(`/auth/users/${userId}/status`, { status });
    return res.data;
  },

  logout: () => {
    localStorage.removeItem("seta_token");
    localStorage.removeItem("seta_user");
    window.dispatchEvent(new Event("seta_auth_change"));
  }
};
