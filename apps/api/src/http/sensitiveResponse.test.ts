import express from 'express';
import request from 'supertest';
import { expect, it } from 'vitest';
import { sensitiveResponse } from './sensitiveResponse';
it('removes credentials from nested related users without removing login tokens', async () => {
  const app = express(); app.use(sensitiveResponse);
  app.get('/', (_req, res) => res.json({ token: 'session', items: [{ reviewer: { name: 'Moderator', passwordHash: 'private', password: 'private', googleIdentityId: 'private' } }] }));
  const result = await request(app).get('/').expect(200);
  expect(result.body).toEqual({ token: 'session', items: [{ reviewer: { name: 'Moderator' } }] });
});
