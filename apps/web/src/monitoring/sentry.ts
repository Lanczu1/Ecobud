import * as Sentry from '@sentry/react';

// The DSN only allows sending error reports, so it is safe to ship in the bundle.
const SENTRY_DSN =
  'https://1aa49c3b406c4f6234fe51bbf99f273b@o4512396035489792.ingest.us.sentry.io/4512396152602624';

// Query strings can carry reset tokens or personal data.
const withoutQuery = (url: string) => url.split(/[?#]/)[0];

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  // No user details, cookies, headers, bodies or query params. The admin app handles ID photos.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') return null;
    const data = breadcrumb.data;
    if (data && typeof data.url === 'string') data.url = withoutQuery(data.url);
    if (data && typeof data.to === 'string') data.to = withoutQuery(data.to);
    if (data && typeof data.from === 'string') data.from = withoutQuery(data.from);
    return breadcrumb;
  },
  beforeSend(event) {
    if (event.request?.url) event.request.url = withoutQuery(event.request.url);
    delete event.request?.query_string;
    delete event.request?.cookies;
    delete event.user;
    return event;
  },
});

export const reportReactError = Sentry.reactErrorHandler();
