# EC2 API behind Cloudflare, Vercel websites, Supabase PostgreSQL

These are reviewable templates, not a completed deployment.

## Database prerequisites

The read-only inspection found no Prisma migration history, missing security columns, an RLS-bypass application role, and public grants on application tables without RLS. Do not run `prisma migrate deploy` blindly on this existing database: first compare its schema with the migration history, back it up, and establish a verified baseline. Do not reset the database or mark unapplied migrations as applied.

Review `restrict-supabase-tables.sql` against staging. It revokes direct REST-table access for public clients while retaining a dedicated backend role. Create a separate secure LOGIN role, grant it `ecobud_backend`, and verify backend operations with that login before switching DATABASE_URL. Use verified TLS (`sslmode=verify-full`) and keep the migration owner separate from the runtime account. Existing permissive policies and all future tables require review too. The script does not change Auth or Storage schema permissions.

## EC2

- Use a dedicated `ecobud` OS account and deploy to `/opt/ecobud`. Install a supported Node runtime and project dependencies, build, and run release checks before enabling the service.
- Put secrets in `/etc/ecobud/api.env`, readable only by root and the service account. Set the actual admin panel origin in CORS_ORIGINS, a unique random JWT_SECRET, and required database/Supabase/mail variables. Do not copy development environment files wholesale.
- Install `ecobud-api.service`; adapt `/usr/bin/node` to the verified runtime path. It binds the API to loopback and gives the service a private temporary directory. AI transcription also requires Python and its dependencies.
- Configure Nginx from `nginx-api.conf.example`, using your actual API DNS name and valid certificate paths. Verify with `nginx -t` before reloading.
- Allow public ingress to 80/443 only from Cloudflare's published address ranges, so nobody can bypass Cloudflare. Restrict SSH to trusted administrator IPs or use SSM. Do not expose port 3000.
- Generate the real-client-IP file the proxy template includes, and repeat this if Cloudflare changes its ranges:
  `(curl -fsS https://www.cloudflare.com/ips-v4; echo; curl -fsS https://www.cloudflare.com/ips-v6) | sed '/^$/d; s/.*/set_real_ip_from &;/' | sudo tee /etc/nginx/snippets/cloudflare-real-ip.conf`
- Remove the default site (`sudo rm /etc/nginx/sites-enabled/default`), then run `sudo nginx -t` before reloading.
- In Cloudflare, set SSL/TLS to Full (strict) and turn on Always Use HTTPS.
- After each deployment, confirm production mode: `curl -sI https://api.myecobud.com/api/health | grep -i strict-transport-security` must print a header. If it does not, `NODE_ENV=production` is not active or an older build is running, and the JWT secret, required settings and CORS startup checks may also be off.
- Verify certificate renewal, service restart, graceful shutdown and log forwarding. Configure alerts and exercise a database restore before launch.

## Vercel static websites

Set the root directory to `apps/web` for the admin panel and `apps/landing` for the landing page, build command to `npm ci && npm run build`, and output directory to `dist`. Set VITE_API_HOST to the actual `https://` API origin. Only VITE_ public values belong in these builds; never provide the backend service-role key or database credentials.

Security headers live in each app's `vercel.json`. The CSP starts as `Content-Security-Policy-Report-Only`. Use every page while watching the browser console for CSP messages, add any legitimate origin that is reported, then rename the key to `Content-Security-Policy` and redeploy. Do not add wildcard script origins or `'unsafe-eval'`. If a new page loads a new outside service, add its origin to the CSP in the same change.

## Android

Release builds no longer use the checked-in debug keystore. Supply ECOBUD_RELEASE_STORE_FILE, ECOBUD_RELEASE_STORE_PASSWORD, ECOBUD_RELEASE_KEY_ALIAS and ECOBUD_RELEASE_KEY_PASSWORD through your build secret store. Confirm the resulting signing certificate matches the intended store identity. If using EAS-managed signing, verify its credential injection with this native project in a preview build first.

Run `npm run check:environment -- --database` from apps/api to repeat the read-only checks without printing credentials. Actual domains, database environment, infrastructure access, backup confirmation, signing credentials and live OAuth/SMTP tests are still needed.
