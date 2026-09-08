import type { RequestHandler } from 'express';

const privateFields = new Set(['passwordHash', 'password', 'googleIdentityId']);
// Defense in depth for nested Prisma relations accidentally returned by a route.
export const sensitiveResponse: RequestHandler = (_req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => {
    if (body === undefined) return json(body);
    const safe = JSON.parse(JSON.stringify(body, (key, value) => privateFields.has(key) ? undefined : value));
    return json(safe);
  };
  next();
};
