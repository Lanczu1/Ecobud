import { notificationRoutes } from './routes/notificationRoutes';
import { startNotificationWorker, stopNotificationWorker } from './services/notificationService';
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
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
import { sensitiveResponse } from './http/sensitiveResponse';
import { prisma } from './prismaClient';
import {
  startPresenceCleanupScheduler,
  stopPresenceCleanupScheduler,
} from './services/presenceCleanupScheduler';
import compression from 'compression';
import {
  startLessonPublishScheduler,
  stopLessonPublishScheduler,
} from './services/lessonPublishScheduler';

const app = express();
const production = process.env.NODE_ENV === 'production';
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(',').map(value => value.trim()).filter(Boolean);
if (production && (!process.env.CORS_ORIGINS || origins.some(origin => !origin.startsWith('https://') || origin.includes('*')))) {
  throw new Error('Production requires explicit HTTPS CORS_ORIGINS.');
}
// Use exact proxy addresses/subnets, never trust arbitrary forwarded headers.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()));
app.disable('x-powered-by');
app.use(sensitiveResponse);
if (production) {
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GMAIL_USER', 'GMAIL_PASS']) {
    if (!process.env[name]?.trim()) throw new Error(`Missing production setting: ${name}`);
  }
}

app.use((req, res, next) => {
  res.once('finish', () => {
    if ([401, 403, 429].includes(res.statusCode) || res.statusCode >= 500) {
      console.warn(JSON.stringify({ event: 'security_response', method: req.method, route: req.route?.path || 'unmatched', status: res.statusCode, timestamp: new Date().toISOString() }));
    }
  });
  next();
});

app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
  }),
);

// OWASP Secure HTTP Response Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json({ limit: '100kb' }));

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
      res.setHeader('Cache-Control', 'no-store');
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 600,
  standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api/', apiLimiter);

app.use('/api/notifications', notificationRoutes);
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

const server = app.listen(port, process.env.HOST || (production ? '127.0.0.1' : '0.0.0.0'), () => {
  console.log(`ECOBUD API running at http://localhost:${port}`);
  console.log(`ECOBUD API accessible on local network at http://0.0.0.0:${port}`);
});

startPresenceCleanupScheduler();
startLessonPublishScheduler(); startNotificationWorker();

let shuttingDown = false;
const shutdownSchedulers = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopPresenceCleanupScheduler();
  stopLessonPublishScheduler(); stopNotificationWorker();
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), 15000).unref();
};

process.on('SIGINT', shutdownSchedulers);
process.on('SIGTERM', shutdownSchedulers);

