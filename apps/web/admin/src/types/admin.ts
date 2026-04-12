export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface UserResetResponse {
  message: string;
}

export interface LessonCreateData {
  title: string;
  description: string;
  content: string;
  category: string;
  isPublished: boolean;
}
