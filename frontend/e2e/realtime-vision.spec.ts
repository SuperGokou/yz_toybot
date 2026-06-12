import { test, expect } from '@playwright/test';

test('开摄像头后出现关闭摄像头按钮', async ({ page }) => {
  await page.goto('/');

  const startButton = page.getByRole('button', { name: /开启摄像头/ });
  await expect(startButton).toBeVisible();
  await startButton.click();

  // After getUserMedia resolves (fake device), the toggle flips to "关闭摄像头".
  await expect(
    page.getByRole('button', { name: /关闭摄像头/ })
  ).toBeVisible();
});
