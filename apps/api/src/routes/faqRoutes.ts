import { Router } from 'express';
import { prisma } from '../prismaClient';
import { errorBoundary } from '../http/errorResponder';
import { apiCache } from '../lib/cache';

const faqRoutes = Router();

faqRoutes.get(
  '/',
  errorBoundary(async (_req, res) => {
    const items = await apiCache.getOrSet('faqs_list', 300, async () => {
      return prisma.faq.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    return res.json({ items });
  }),
);

export { faqRoutes };
