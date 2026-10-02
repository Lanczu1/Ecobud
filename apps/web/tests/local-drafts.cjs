const assert = require('node:assert/strict');
const { chromium } = require(process.env.ECOBUD_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.ECOBUD_TEST_ORIGIN || 'http://127.0.0.1:5185';

async function records(page, section, user = 'draft-test') {
  return page.evaluate(async ({ section, user }) => {
    const store = await import('/src/utils/localDraftStore.ts');
    const drafts = await store.listDrafts(`${user}:${section}`);
    return drafts.map(draft => ({ id: draft.id, title: draft.data.title || draft.data.form?.title,
      file: draft.data.imageFile?.name || draft.data.imageFiles?.[0]?.name || draft.data.thumbnailFile?.name || draft.data.imageFile?.name || draft.data.form?.imageFile?.name }));
  }, { section, user });
}

async function waitDraft(page, section, title) {
  await page.waitForFunction(async ({ section, title }) => {
    const { listDrafts } = await import('/src/utils/localDraftStore.ts');
    const drafts = await listDrafts(`draft-test:${section}`);
    return drafts.some(draft => (draft.data.title || draft.data.form?.title) === title);
  }, { section, title });
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.ECOBUD_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let failSubmit = true;
    let uploadedFile = false;
    await context.route('**/api/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
      const headers = { 'Access-Control-Allow-Origin': '*' };
      if (request.method() !== 'GET') {
        if (failSubmit) return route.abort('connectionfailed');
        if (request.url().endsWith('/upload')) {
          uploadedFile = request.postDataBuffer().includes(Buffer.from('offline-image.png'));
          return route.fulfill({ json: { url: '/uploads/test.png' }, headers });
        }
        return route.fulfill({ json: { id: 'created', title: 'Published draft', description: '', coinCost: 10, stock: -1, category: 'general', isActive: true }, headers });
      }
      return route.fulfill({ json: { items: [], assignedBarangay: null, pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 }, total: 0, active: 0, inactive: 0, outOfStock: 0, pending: 0 }, headers });
    });
    const cases = [
      ['announcements', 'Create Announcement', '#announcement-form'],
      ['learning', 'Add Lesson', 'form'],
      ['challenges', 'New Challenge', '#challenge-form'],
      ['events', 'Create Event', '#event-form'],
      ['redeem', 'Add Item', '#redeem-item-form'],
    ];
    for (const [section, button, selector] of cases) {
      const url = `${origin}/tests/local-drafts.html?section=${section}`;
      await page.goto(url);
      await page.waitForFunction(() => document.querySelector('[aria-label="Local drafts"]') && document.querySelector('[aria-label="Local drafts"]').getAttribute('aria-busy') === 'false');
      await page.getByRole('button', { name: button, exact: true }).first().click();
      const form = page.locator(selector).first();
      await form.waitFor();
      await context.setOffline(true);
      await form.locator('input:not([type="file"])').first().fill(`${section} offline draft`);
      await form.locator('input[type="file"]').first().setInputFiles({ name: 'offline-image.png', mimeType: 'image/png', buffer: Buffer.from('draft attachment') });
      if (section === 'learning') {
        await form.getByText('Include Video in Lesson', { exact: true }).locator('..').locator('div').first().click();
        await form.locator('input[type="file"]').nth(1).setInputFiles({ name: 'offline-video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('draft video') });
      }
      await waitDraft(page, section, `${section} offline draft`);
      await page.waitForFunction(async section => {
        const { listDrafts } = await import('/src/utils/localDraftStore.ts');
        const [draft] = await listDrafts(`draft-test:${section}`);
        return !!(draft.data.imageFile || draft.data.imageFiles?.length || draft.data.thumbnailFile || draft.data.form?.imageFile);
      }, section);
      await context.setOffline(false);
      await page.reload();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await form.waitFor();
      assert.equal(await form.locator('input:not([type="file"])').first().inputValue(), `${section} offline draft`);
      const [draft] = await records(page, section);
      assert.equal(draft.file, 'offline-image.png');
      if (section === 'learning') {
        await form.getByText('Attached: offline-video.mp4', { exact: true }).waitFor();
        await form.getByText('Attached: offline-image.png', { exact: true }).waitFor();
      }
      await form.locator('input:not([type="file"])').first().fill(`${section} resumed draft`);
      await waitDraft(page, section, `${section} resumed draft`);
      assert.equal((await records(page, section)).length, 1, 'Resuming must update the existing draft');
      console.log(`PASS ${section}: offline autosave, reload recovery, attachment recovery, same draft updated`);
    }
    const form = page.locator('#redeem-item-form');
    await form.locator('input[type="number"]').first().fill('10');
    await page.getByRole('button', { name: 'Create Item', exact: true }).click();
    await page.getByText('Failed to fetch', { exact: false }).first().waitFor();
    assert.equal((await records(page, 'redeem')).length, 1, 'Failed submit must retain draft');
    failSubmit = false;
    await page.getByRole('button', { name: 'Create Item', exact: true }).click();
    await form.waitFor({ state: 'detached' });
    assert.equal((await records(page, 'redeem')).length, 0, 'Successful submit must remove draft');
    assert.ok(uploadedFile, 'Recovered attachment must actually be uploaded');
    console.log('PASS failed submit retains draft; successful submit removes draft and uploads recovered attachment');

    const result = await page.evaluate(async () => {
      const { putDraft, listDrafts, deleteDraft } = await import('/src/utils/localDraftStore.ts');
      const scope = 'limit-test:events';
      const attempts = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => putDraft({ id: `limit-${i}`, scope, updatedAt: i, data: { title: `${i}` } })));
      await putDraft({ id: 'limit-0', scope, updatedAt: 5, data: { title: 'updated' } });
      const full = await listDrafts(scope);
      await deleteDraft('other-user:events', 'limit-0');
      const isolated = await listDrafts(scope);
      await deleteDraft(scope, 'limit-1');
      await putDraft({ id: 'limit-new', scope, updatedAt: 6, data: { title: 'new' } });
      return { successes: attempts.filter(a => a.status === 'fulfilled').length, failures: attempts.filter(a => a.status === 'rejected').length,
        full: full.length, updated: full.some(d => d.data.title === 'updated'), isolated: isolated.length, final: (await listDrafts(scope)).length,
        otherAccount: (await listDrafts('other-user:events')).length, otherPage: (await listDrafts('limit-test:learning')).length };
    });
    assert.deepEqual(result, { successes: 3, failures: 1, full: 3, updated: true, isolated: 3, final: 3, otherAccount: 0, otherPage: 0 });
    console.log('PASS atomic 3-draft limit, updates at capacity, deletion frees a slot, account/page isolation');
    await page.goto(`${origin}/tests/local-drafts.html?section=announcements`);
    await page.evaluate(async () => {
      const { listDrafts, putDraft } = await import('/src/utils/localDraftStore.ts');
      const [existing] = await listDrafts('draft-test:announcements');
      await Promise.all([1, 2].map(i => putDraft({ ...existing, id: `ui-cap-${i}`, data: { ...existing.data, form: { ...existing.data.form, title: `Extra draft ${i}` } } })));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Resume', exact: true }).nth(2).waitFor();
    await page.getByRole('button', { name: 'Create Announcement', exact: true }).first().click();
    await page.getByRole('alert').filter({ hasText: 'All 3 draft slots are full' }).waitFor();
    assert.equal(await page.locator('#announcement-form').count(), 0);
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Local drafts"] strong').textContent.includes('(2/3)'));
    await page.getByRole('button', { name: 'Create Announcement', exact: true }).first().click();
    await page.locator('#announcement-form').waitFor();
    console.log('PASS UI blocks fourth draft; confirmed deletion frees a creation slot');
    await page.goto(`${origin}/tests/local-drafts.html?section=announcements&user=other-user`);
    await page.getByRole('button', { name: 'Create Announcement', exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Resume', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS no browser runtime errors; another account sees no drafts');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
