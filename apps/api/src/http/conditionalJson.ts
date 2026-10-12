import { createHash } from 'crypto';
import type { RequestHandler } from 'express';

const sentTags = (header: string | undefined) =>
  (header ?? '').split(',').map(tag => tag.trim().replace(/^W\//, '')).filter(Boolean);

// Tags each successful JSON read and answers 304 when the client already holds that exact body.
// The comparison is done here rather than by Express so that a browser's automatic
// `Cache-Control: no-cache` on conditional requests does not defeat it.
export const conditionalJson: RequestHandler = (req, res, next) => {
  if (req.method !== 'GET') return next();
  const json = res.json.bind(res);
  res.json = body => {
    if (body === undefined || res.statusCode !== 200 || res.headersSent) return json(body);
    const text = JSON.stringify(body);
    if (text === undefined) return json(body);
    const tag = `"${createHash('sha1').update(text).digest('base64url')}"`;
    res.setHeader('ETag', tag);
    const sent = sentTags(req.headers['if-none-match']);
    if (sent.includes(tag) || sent.includes('*')) {
      res.status(304).end();
      return res;
    }
    if (!res.get('Content-Type')) res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  };
  next();
};
