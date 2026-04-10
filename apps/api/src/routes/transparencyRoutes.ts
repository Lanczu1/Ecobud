import { Router } from 'express';
import { authenticateRequest, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { TransparencyLedgerService } from '../services/TransparencyLedgerService';

const transparencyRoutes = Router();
const ledgerService = new TransparencyLedgerService();

transparencyRoutes.get(
  '/metrics',
  errorBoundary(async (_req, res) => {
    return res.json(await ledgerService.getPublicMetrics());
  }),
);

transparencyRoutes.get(
  '/logs',
  errorBoundary(async (req, res) => {
    const page = Number(req.query.page ?? '1');
    const pageSize = Number(req.query.pageSize ?? '10');
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    return res.json(await ledgerService.getLogs(page, pageSize, userId));
  }),
);

transparencyRoutes.get(
  '/mine',
  authenticateRequest,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    return res.json(await ledgerService.getLogs(1, 20, req.auth!.userId));
  }),
);

export { transparencyRoutes };
