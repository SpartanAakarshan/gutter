const { test, expect } = require('@playwright/test');
const { createExtensionContext } = require('./helpers/extension');

let context, extensionId;

test.beforeAll(async () => {
  ({ context, extensionId } = await createExtensionContext());
});

test.afterAll(async () => {
  await context.close();
});

test('options page loads with correct title', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('.title')).toHaveText('Gutter // Settings');
  await page.close();
});

test('consent banner visible on fresh install', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  // Simulate fresh install: consentGiven = false
  await page.evaluate(() =>
    chrome.storage.local.set({ consentGiven: false })
  );
  await page.reload();

  const banner = page.locator('#consent-banner');
  await expect(banner).toBeVisible();
  await page.close();
});

test('consent button dismisses banner', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(() => chrome.storage.local.set({ consentGiven: false }));
  await page.reload();

  await page.locator('#consent-btn').click();
  await expect(page.locator('#consent-banner')).toBeHidden();

  const stored = await page.evaluate(() =>
    chrome.storage.local.get('consentGiven').then(r => r.consentGiven)
  );
  expect(stored).toBe(true);
  await page.close();
});

test('shows logged-out state when no token', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(() => chrome.storage.local.remove(['token', 'email']));
  await page.reload();

  await expect(page.locator('#logged-out')).toBeVisible();
  await expect(page.locator('#logged-in')).toBeHidden();
  await page.close();
});

test('Deep Dive toggle is present', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#dd-toggle')).toBeAttached();
  await expect(page.locator('#dd-row')).toBeVisible();
  await page.close();
});

test('Deep Dive locked for non-Pro user', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(() => chrome.storage.local.set({ isPro: false, deepDiveTrialUsed: 10 }));
  await page.reload();

  await expect(page.locator('#dd-toggle')).toBeDisabled();
  await page.close();
});

test('sign in button present on logged-out state', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(() => chrome.storage.local.remove('token'));
  await page.reload();

  await expect(page.locator('#btn-google')).toBeVisible();
  await page.close();
});
