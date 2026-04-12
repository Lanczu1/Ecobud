import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { Lesson, LessonCreateData } from '../types/admin';

export const useAdminLessons = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getLessons();
      setLessons(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch lessons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const createLesson = async (data: LessonCreateData) => {
    try {
      const newLesson = await adminService.createLesson(data);
      setLessons((prev) => [newLesson, ...prev]);
      return newLesson;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to create lesson');
    }
  };

  const updateLesson = async (id: string, data: Partial<LessonCreateData>) => {
    try {
      const updated = await adminService.updateLesson(id, data);
      setLessons((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to update lesson');
    }
  };

  const deleteLesson = async (id: string) => {
    try {
      await adminService.deleteLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to delete lesson');
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const updated = await adminService.togglePublish(id, !currentStatus);
      setLessons((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to toggle publish status');
    }
  };

  return {
    lessons,
    loading,
    error,
    refresh: fetchLessons,
    createLesson,
    updateLesson,
    deleteLesson,
    togglePublish,
  };
};
