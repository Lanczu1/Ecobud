import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { authRoutes } from './routes/authRoutes';
import { userRoutes } from './routes/userRoutes';
import { lessonRoutes } from './routes/lessonRoutes';
import { challengeRoutes } from './routes/challengeRoutes';
import { habitRoutes } from './routes/habitRoutes';
import { eventRoutes } from './routes/eventRoutes';
import { transparencyRoutes } from './routes/transparencyRoutes';
import { experienceRoutes } from './routes/experienceRoutes';
import { adminRoutes } from './routes/adminRoutes';
import giveAndGetRoutes from './routes/giveAndGetRoutes';
import swapRoutes from './routes/swapRoutes';
import reportRoutes from './routes/reportRoutes';
import redeemRoutes from './routes/redeemRoutes';
import { moderationRoutes } from './routes/moderationRoutes';
import { faqRoutes } from './routes/faqRoutes';
import { homeRoutes } from './routes/homeRoutes';
import { learnRoutes } from './routes/learnRoutes';
import { realtimeRoutes } from './routes/realtimeRoutes';
import { userActionRoutes } from './routes/userActionRoutes';
import { errorResponder } from './http/errorResponder';
import {
  startPresenceCleanupScheduler,
  stopPresenceCleanupScheduler,
} from './services/presenceCleanupScheduler';
import {
  startLessonPublishScheduler,
  stopLessonPublishScheduler,
} from './services/lessonPublishScheduler';

const app = express();

app.use(
  cors({
    origin: '*',
  }),
);

// OWASP Secure HTTP Response Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json());

// Serve uploads directory statically with security headers and caching
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'; img-src 'self' data:;");
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '1d',
  }),
);

// Smart cache headers based on request method and path
app.use((req, res, next) => {
  if (req.method === 'GET') {
    const isPublicRead =
      req.path.startsWith('/api/faqs') ||
      req.path.startsWith('/api/transparency/metrics') ||
      req.path === '/api/health';

    if (isPublicRead) {
      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
    } else {
      res.setHeader('Cache-Control', 'private, no-cache');
    }
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.get('/api/health', (_req, res) => {
  return res.json({
    status: 'ok',
    platform: 'ECOBUD API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/learn', learnRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/user', userActionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/transparency', transparencyRoutes);
app.use('/api/experience', experienceRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/give-and-get', giveAndGetRoutes);
app.use('/api/swap', swapRoutes);
app.use('/api/redeem', redeemRoutes);
app.use('/api/reports', reportRoutes);

app.use(errorResponder);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`ECOBUD API running at http://localhost:${port}`);
});

startPresenceCleanupScheduler();
startLessonPublishScheduler();

const shutdownSchedulers = () => {
  stopPresenceCleanupScheduler();
  stopLessonPublishScheduler();
};

process.on('SIGINT', shutdownSchedulers);
process.on('SIGTERM', shutdownSchedulers);
