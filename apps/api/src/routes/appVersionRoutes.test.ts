import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appVersionRoutes } from './appVersionRoutes';

describe('GET /api/app/version', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns the configured public version information', async () => {
    vi.stubEnv('APP_LATEST_VERSION', '1.2.0');
    vi.stubEnv('APP_MINIMUM_VERSION', '1.1.0');
    vi.stubEnv('APP_UPDATE_URL', 'https://example.com/update');
    vi.stubEnv('JWT_SECRET', 'must-not-leak');

    const app = express();
    app.use('/api/app/version', appVersionRoutes);

    const response = await request(app).get('/api/app/version').expect(200);
    expect(response.body).toEqual({
      latestVersion: '1.2.0',
      minimumVersion: '1.1.0',
      updateUrl: 'https://example.com/update',
    });
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
  });
});
