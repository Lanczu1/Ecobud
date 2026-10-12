import { Router } from 'express';
import { BARANGAYS } from '../utils/announcementBarangays';

export const barangayRoutes = Router();

// Public because the mobile sign-up form needs the list before login.
barangayRoutes.get('/', (_req, res) => {
  return res.json({ items: BARANGAYS });
});
