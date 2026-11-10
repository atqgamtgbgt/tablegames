const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

test('The homepage and all four games load, with actionable coaching', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.game')).toHaveCount(4, { timeout: 90000 });
  await expect(page.locator('[role="progressbar"]')).toHaveCount(4);
  const ids = ['chess', 'shogi', 'go', 'mahjong'];
  for (const id of ids) {
    await page.goto('http://127.0.0.1:8765/#/' + id, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.training__title')).toHaveText('今日の15分・上達メニュー', { timeout: 90000 });
    await expect(page.locator('.training__step')).toHaveCount(3);
    await expect(page.locator('.training__step').first()).toHaveAttribute('href', /#\//);
    await page.locator('.training__more summary').click();
    await expect(page.locator('.training__links a')).toHaveCount(2);
    await expect(page.locator('.lrow').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Opening a suggested practice action changes to a lesson', async ({ page }) => {
  await page.goto('http://127.0.0.1:8765/#/chess', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.training__step')).toHaveCount(3, { timeout: 90000 });
  await page.locator('.training__step').first().click();
  await expect(page).toHaveURL(/#\/chess\/.+/);
  await expect(page.locator('#main .shell')).toBeVisible();
});


test('Training duration selection is remembered across game pages', async ({ page }) => {
  await page.goto('http://127.0.0.1:8765/#/chess', { waitUntil: 'domcontentloaded' });
  const heading = page.locator('.training__title');
  await expect(heading).toHaveText('今日の15分・上達メニュー', { timeout: 90000 });
  await page.locator('.training__select').selectOption('5');
  await expect(heading).toHaveText('今日の5分・上達メニュー');
  await expect(page.locator('.training__minutes').first()).toHaveText('1分・思い出す');
  await page.goto('http://127.0.0.1:8765/#/shogi', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.training__select')).toHaveValue('5', { timeout: 90000 });
  await page.locator('.training__select').selectOption('30');
  await expect(page.locator('.training__minutes').last()).toHaveText('15分〜・実戦で試す');
});

test('Cached app loads without a network connection after first visit', async ({ page, context }) => {
  await page.goto('http://127.0.0.1:8765/#/chess', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.training__title')).toBeVisible({ timeout: 90000 });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once:true }));
    }
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.training__title')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('.training__step')).toHaveCount(3);
});
