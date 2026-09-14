import { Router } from 'express';
import { readAppVersionConfig } from '../config/appVersion';

export const appVersionRoutes = Router();

appVersionRoutes.get('/', (_req, res) => {
  return res.json(readAppVersionConfig());
});
