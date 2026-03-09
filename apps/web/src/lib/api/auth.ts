import { api, getUserKey } from '../api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    location: { id: string; name: string; type: string } | null;
    avatarUrl?: string | null;
  };
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    api.setToken(response.access_token);
    if (typeof window !== 'undefined') {
      localStorage.setItem(getUserKey(), JSON.stringify(response.user));
    }
    return response;
  },

  me: () => api.get<LoginResponse['user']>('/auth/me'),

  verifyFace: async (photoFile: File): Promise<{ verified: boolean }> => {
    const form = new FormData();
    form.append('photo', photoFile);
    return api.post<{ verified: boolean }>('/auth/verify-face', form);
  },

  logout: () => {
    api.clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  getStoredUser: (): LoginResponse['user'] | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(getUserKey());
    return stored ? JSON.parse(stored) : null;
  },

  isAuthenticated: (): boolean => {
    return !!api.getToken();
  },
};
