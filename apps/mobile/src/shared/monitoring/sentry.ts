import * as Sentry from '@sentry/react-native';

// The DSN only allows sending error reports, so it is safe to ship in the app.
const SENTRY_DSN =
  'https://8b0324a4c51d18d12c3120037590db41@o4512396035489792.ingest.us.sentry.io/4512396155289600';

// Query strings can carry tokens or personal data.
const withoutQuery = (url: string) => url.split(/[?#]/)[0];

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
  // No IP addresses or user details, and never a picture of the screen:
  // residents photograph IDs and challenge proofs in this app.
  sendDefaultPii: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'console') return null;
    const data = breadcrumb.data;
    if (data && typeof data.url === 'string') data.url = withoutQuery(data.url);
    return breadcrumb;
  },
  beforeSend(event) {
    if (event.request?.url) event.request.url = withoutQuery(event.request.url);
    delete event.request?.query_string;
    delete event.user;
    return event;
  },
});
