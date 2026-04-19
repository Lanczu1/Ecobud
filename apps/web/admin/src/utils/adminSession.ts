export type AdminPortalRole = 'user' | 'moderator' | 'admin';

interface StoredAdminUserShape {
  email?: string;
  id?: string;
  name?: string;
  role?: AdminPortalRole;
  status?: 'active' | 'pending' | 'suspended';
}

const MODERATOR_HOME_PATH = '/admin/learn';
const ADMIN_HOME_PATH = '/admin/dashboard';

export const getStoredAdminUser = (): StoredAdminUserShape | null => {
  const rawUser = localStorage.getItem('admin_user');

  if (!rawUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(rawUser) as StoredAdminUserShape;

    if (!parsedUser || typeof parsedUser !== 'object') {
      return null;
    }

    return parsedUser;
  } catch {
    return null;
  }
};

export const hasAdminPortalAccess = (role?: AdminPortalRole | null) =>
  role === 'admin' || role === 'moderator';

export const isAdminOnlyRole = (role?: AdminPortalRole | null) => role === 'admin';

export const getAdminPortalHomePath = (role?: AdminPortalRole | null) => {
  if (role === 'admin') {
    return ADMIN_HOME_PATH;
  }

  if (role === 'moderator') {
    return MODERATOR_HOME_PATH;
  }

  return '/admin/login';
};
