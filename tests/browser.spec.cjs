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
