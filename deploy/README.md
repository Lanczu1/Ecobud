# EC2 API, Render website, Supabase PostgreSQL

These are reviewable templates, not a completed deployment.

## Database prerequisites

The read-only inspection found no Prisma migration history, missing security columns, an RLS-bypass application role, and public grants on application tables without RLS. Do not run `prisma migrate deploy` blindly on this existing database: first compare its schema with the migration history, back it up, and establish a verified baseline. Do not reset the database or mark unapplied migrations as applied.

Review `restrict-supabase-tables.sql` against staging. It revokes direct REST-table access for public clients while retaining a dedicated backend role. Create a separate secure LOGIN role, grant it `ecobud_backend`, and verify backend operations with that login before switching DATABASE_URL. Use verified TLS (`sslmode=verify-full`) and keep the migration owner separate from the runtime account. Existing permissive policies and all future tables require review too. The script does not change Auth or Storage schema permissions.

## EC2

- Use a dedicated `ecobud` OS account and deploy to `/opt/ecobud`. Install a supported Node runtime and project dependencies, build, and run release checks before enabling the service.
- Put secrets in `/etc/ecobud/api.env`, readable only by root and the service account. Set the actual Render origin in CORS_ORIGINS, a unique random JWT_SECRET, and required database/Supabase/mail variables. Do not copy development environment files wholesale.
- Install `ecobud-api.service`; adapt `/usr/bin/node` to the verified runtime path. It binds the API to loopback and gives the service a private temporary directory. AI transcription also requires Python and its dependencies.
- Configure Nginx from `nginx-api.conf.example`, using your actual API DNS name and valid certificate paths. Verify with `nginx -t` before reloading.
- Allow public ingress only to 80/443. Restrict SSH to trusted administrator IPs or use SSM. Do not expose port 3000. The proxy template assumes Nginx is the direct ingress; revisit trusted headers if adding a load balancer/CDN.
- Verify certificate renewal, service restart, graceful shutdown and log forwarding. Configure alerts and exercise a database restore before launch.

## Render static website

Set root directory to `apps/web`, build command to `npm ci && npm run build`, and publish directory to `dist`. Set VITE_API_HOST to the actual `https://` API origin. Configure an SPA rewrite to `/index.html` and response headers including X-Content-Type-Options=nosniff and Referrer-Policy=strict-origin-when-cross-origin. Scope CSP to the actual API, Supabase and media origins after testing the website; do not use wildcard script origins. Only VITE_ public values belong on Render's static build; never provide the backend service-role key or database credentials.

## Android

Release builds no longer use the checked-in debug keystore. Supply ECOBUD_RELEASE_STORE_FILE, ECOBUD_RELEASE_STORE_PASSWORD, ECOBUD_RELEASE_KEY_ALIAS and ECOBUD_RELEASE_KEY_PASSWORD through your build secret store. Confirm the resulting signing certificate matches the intended store identity. If using EAS-managed signing, verify its credential injection with this native project in a preview build first.

Run `npm run check:environment -- --database` from apps/api to repeat the read-only checks without printing credentials. Actual domains, database environment, infrastructure access, backup confirmation, signing credentials and live OAuth/SMTP tests are still needed.
