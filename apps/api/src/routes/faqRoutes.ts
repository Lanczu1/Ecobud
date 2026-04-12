import { Router } from 'express';
import { prisma } from '../prismaClient';
import { errorBoundary } from '../http/errorResponder';

const faqRoutes = Router();

faqRoutes.get(
  '/',
  errorBoundary(async (_req, res) => {
    const items = await prisma.faq.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return res.json({ items });
  }),
);

export { faqRoutes };
