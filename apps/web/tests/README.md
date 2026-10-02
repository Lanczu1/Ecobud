Run the local draft browser checks with Vite and Playwright installed:

```sh
npm run dev -- --host 127.0.0.1 --port 5185
node tests/local-drafts.cjs
```

The test defaults to installed Chrome. Set `ECOBUD_BROWSER_CHANNEL` for a different Playwright browser channel, `ECOBUD_TEST_ORIGIN` for another Vite address, or `ECOBUD_PLAYWRIGHT_MODULE` to the absolute path of an available Playwright package.

The fixture renders the five real creation pages with mocked API responses in a fresh browser context. It checks offline autosave, recovery after reload, attachment recovery, updating the same draft, failed and successful submissions, the atomic three-draft cap, and account/page isolation. No real account or server data is used.
