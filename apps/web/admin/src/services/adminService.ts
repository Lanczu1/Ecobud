import axios from 'axios';
import type {
  AdminDashboardStats,
  AdminRealtimeSessionPayload,
  AdminUser,
  Lesson,
  LessonCreateData,
  UserResetResponse,
} from '../types/admin';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const adminApi = axios.create({
  baseURL: `${API_URL}/admin`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject token
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401 errors
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);


export const adminService = {
  getLessons: async () => {
    const response = await adminApi.get<Lesson[]>('/lessons');
    return response.data;
  },

  createLesson: async (data: LessonCreateData) => {
    const response = await adminApi.post<Lesson>('/lessons', data);
    return response.data;
  },

  updateLesson: async (id: string, data: Partial<LessonCreateData>) => {
    const response = await adminApi.put<Lesson>(`/lessons/${id}`, data);
    return response.data;
  },

  deleteLesson: async (id: string) => {
    await adminApi.delete(`/lessons/${id}`);
  },

  togglePublish: async (id: string, isPublished: boolean) => {
    const response = await adminApi.patch<Lesson>(`/lessons/${id}/publish`, { is_published: isPublished });
    return response.data;
  },

  resetUserKnowledge: async (userId: string) => {
    const response = await adminApi.post<UserResetResponse>(`/users/${userId}/reset-knowledge`);
    return response.data;
  },

  getUsers: async () => {
    const response = await adminApi.get<AdminUser[]>('/users');
    return response.data;
  },

  // Challenges
  getChallenges: async () => {
    const response = await adminApi.get<any[]>('/challenges');
    return response.data;
  },

  createChallenge: async (data: any) => {
    const response = await adminApi.post<any>('/challenges', data);
    return response.data;
  },

  updateChallenge: async (id: string, data: any) => {
    const response = await adminApi.put<any>(`/challenges/${id}`, data);
    return response.data;
  },

  deleteChallenge: async (id: string) => {
    await adminApi.delete(`/challenges/${id}`);
  },

  getDashboardStats: async () => {
    const response = await adminApi.get<AdminDashboardStats>('/stats');
    return response.data;
  },

  getRealtimeSession: async (token: string) => {
    const response = await axios.get<AdminRealtimeSessionPayload>(`${API_URL}/realtime/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getSubmissions: async () => {
    const response = await adminApi.get<any[]>('/submissions');
    return response.data;
  },

  reviewSubmission: async (id: string, status: 'approved' | 'rejected', notes?: string) => {
    const response = await adminApi.post(`/submissions/${id}/review`, { status, notes });
    return response.data;
  },

  getAuditLogs: async () => {
    const response = await adminApi.get<any[]>('/audit');
    return response.data;
  },
};
