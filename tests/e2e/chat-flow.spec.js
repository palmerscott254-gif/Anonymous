import { test, expect } from '@playwright/test';

test('app shell loads and shows main brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('GHOSTCHAT')).toBeVisible();
  await expect(page.getByText('All tunnels encrypted')).toBeVisible();
});
