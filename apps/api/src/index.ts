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

const app = express();

app.use(
  cors({
    origin: '*',
  }),
);
app.use(express.json());

// Serve uploads directory statically
app.use('/uploads', express.static(path.join('c:', 'xampp', 'htdocs', 'Ecobud', 'apps', 'api', 'uploads')));

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

app.use(errorResponder);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`ECOBUD API running at http://localhost:${port}`);
});

startPresenceCleanupScheduler();

const shutdownPresenceCleanupScheduler = () => {
  stopPresenceCleanupScheduler();
};

process.on('SIGINT', shutdownPresenceCleanupScheduler);
process.on('SIGTERM', shutdownPresenceCleanupScheduler);
