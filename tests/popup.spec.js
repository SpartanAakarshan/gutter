const { test, expect } = require('@playwright/test');
const { createExtensionContext } = require('./helpers/extension');

let context, extensionId;

test.beforeAll(async () => {
  ({ context, extensionId } = await createExtensionContext());
});

test.afterAll(async () => {
  await context.close();
});

test('popup page loads', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('.wordmark')).toHaveText('Gutter');
  await page.close();
});

test('shows Standard badge by default', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() => chrome.storage.local.set({ deepDive: false }));
  await page.reload();

  await expect(page.locator('#badge')).toHaveText('Standard');
  await page.close();
});

test('shows Deep Dive badge when active', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() => chrome.storage.local.set({ deepDive: true, isPro: true }));
  await page.reload();

  await expect(page.locator('#badge')).toHaveText('Deep Dive');
  await page.close();
});

test('Deep Dive toggle present', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('#dd-toggle')).toBeAttached();
  await page.close();
});

test('toggling Deep Dive updates storage', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() =>
    chrome.storage.local.set({ deepDive: false, isPro: true, deepDiveTrialUsed: 0 })
  );
  await page.reload();

  await page.locator('#toggle-row').click();

  const stored = await page.evaluate(() =>
    chrome.storage.local.get('deepDive').then(r => r.deepDive)
  );
  expect(stored).toBe(true);
  await page.close();
});

test('usage section visible for free user', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() =>
    chrome.storage.local.set({ isPro: false, deepDiveTrialUsed: 3 })
  );
  await page.reload();

  await expect(page.locator('#usage')).toBeVisible();
  await page.close();
});

test('usage section hidden for Pro user', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() => chrome.storage.local.set({ isPro: true }));
  await page.reload();

  await expect(page.locator('#usage')).toBeHidden();
  await page.close();
});

test('toggle disabled when trial exhausted', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(() =>
    chrome.storage.local.set({ isPro: false, deepDiveTrialUsed: 10 })
  );
  await page.reload();

  await expect(page.locator('#dd-toggle')).toBeDisabled();
  await page.close();
});
