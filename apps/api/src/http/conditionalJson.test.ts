import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { conditionalJson } from './conditionalJson';
import { sensitiveResponse } from './sensitiveResponse';

const build = () => {
  const app = express();
  let version = 1;
  app.use(conditionalJson);
  app.use(sensitiveResponse);
  app.use(express.json());
  app.get('/items', (_req, res) => res.json({ version, items: [{ id: 'a', passwordHash: 'secret' }] }));
  app.get('/missing', (_req, res) => res.status(404).json({ message: 'Not found.' }));
  app.get('/empty', (_req, res) => res.json(null));
  app.post('/items', (_req, res) => { version += 1; res.json({ version }); });
  return app;
};

describe('conditionalJson', () => {
  it('sends the full body with a tag on the first read', async () => {
    const response = await request(build()).get('/items');
    expect(response.status).toBe(200);
    expect(response.headers.etag).toMatch(/^"[\w-]+"$/);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toEqual({ version: 1, items: [{ id: 'a' }] });
  });

  it('answers 304 with no body when the client already has that body', async () => {
    const app = build();
    const first = await request(app).get('/items');
    const second = await request(app).get('/items').set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
    expect(second.text).toBe('');
    expect(second.headers.etag).toBe(first.headers.etag);
  });

  it('still answers 304 when the browser adds Cache-Control: no-cache or a weak prefix', async () => {
    const app = build();
    const first = await request(app).get('/items');
    const second = await request(app).get('/items')
      .set('If-None-Match', `W/${first.headers.etag}`).set('Cache-Control', 'no-cache');
    expect(second.status).toBe(304);
  });

  it('sends the new body once the data changes', async () => {
    const app = build();
    const first = await request(app).get('/items');
    await request(app).post('/items');
    const second = await request(app).get('/items').set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(200);
    expect(second.body.version).toBe(2);
    expect(second.headers.etag).not.toBe(first.headers.etag);
  });

  it('leaves errors, writes and null bodies alone', async () => {
    const app = build();
    const missing = await request(app).get('/missing').set('If-None-Match', '*');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: 'Not found.' });
    const write = await request(app).post('/items').set('If-None-Match', '*');
    expect(write.status).toBe(200);
    expect(write.body).toEqual({ version: 2 });
    const empty = await request(app).get('/empty');
    expect(empty.status).toBe(200);
    expect(empty.body).toBeNull();
  });
});
