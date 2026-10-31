import { expect, type Page } from '@playwright/test';

/** Wait for a measured, settled story before sending input or pausing its clock. */
export async function openStory(page: Page, storyId: string, args = '') {
  await page.goto(
    `/iframe.html?id=${storyId}&viewMode=story&args=${encodeURIComponent(args)}`
  );
  const carousel = page.getByTestId('carousel');
  await expect(carousel).toBeVisible({ timeout: 10_000 });
  await expect(
    carousel.locator(':scope > [data-carousel-slide]:not([inert])')
  ).not.toHaveCount(0);
  return carousel;
}
