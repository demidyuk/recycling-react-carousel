import { openStory } from './helpers/story.js';
import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, story: string, args = '') =>
  openStory(page, `regression-feature-harness--${story}`, args);

const next = (page: Page) =>
  page.getByRole('button', { name: 'Next slide', exact: true });
const previous = (page: Page) =>
  page.getByRole('button', { name: 'Previous slide', exact: true });
const selectSlide = (page: Page, index: number) =>
  page
    .getByLabel('Go to slide', { exact: true })
    .selectOption({ value: String(index) });

test('controlled navigation selects local slides and honors each mode', async ({
  page,
}) => {
  await open(page, 'controlled', 'trimEnd:false');
  await expect(previous(page)).toBeDisabled();
  await selectSlide(page, 5);
  await expect(page.getByTestId('cursor')).toHaveText('5');
  await expect(next(page)).toBeDisabled();

  await open(page, 'controlled', 'mode:loop');
  await previous(page).click();
  await expect(page.getByTestId('cursor')).toHaveText('-1');
  await expect(page.getByTestId('slide-number')).toHaveText('6');
  await selectSlide(page, 1);
  await expect(page.getByTestId('cursor')).toHaveText('1');
  await expect(page.getByTestId('slide-number')).toHaveText('2');

  await open(page, 'controlled', 'mode:forward-loop');
  await expect(previous(page)).toBeDisabled();
  await next(page).click();
  await expect(page.getByTestId('cursor')).toHaveText('1');
  await previous(page).click();
  await expect(page.getByTestId('cursor')).toHaveText('0');
  await expect(previous(page)).toBeDisabled();
});

test('trimEnd keeps the last finite viewport full', async ({ page }) => {
  const carousel = await open(page, 'controlled', 'trimEnd:true');
  await page.getByRole('button', { name: 'Last slide', exact: true }).click();
  await expect(page.getByTestId('cursor')).toHaveText('3');
  await expect(next(page)).toBeDisabled();
  await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(3);
});

test('responsive rules change visible counts and swipe steps with container width', async ({
  page,
}) => {
  const carousel = await open(page, 'responsive');
  for (const [width, visibleCount] of [
    [400, 1],
    [600, 2],
    [800, 3],
    [1100, 4],
  ]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(carousel.locator(':scope > div')).toHaveCount(
      visibleCount * 3
    );
    await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
      visibleCount
    );
  }
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Missing responsive carousel layout');
  const x = box.x + box.width * 0.7;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (box.width / 4) * 0.7, y, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('cursor')).toHaveText('2');
});

test('maxSlideSize derives a uniform count in auto mode', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  const carousel = await open(
    page,
    'responsive',
    'breakpoints:!undefined;slidesPerView:auto;maxSlideSize:280px'
  );
  await expect(carousel.locator(':scope > div')).toHaveCount(12);
  await page.setViewportSize({ width: 600, height: 800 });
  await expect(carousel.locator(':scope > div')).toHaveCount(6);
});

test('Basic can disable gestures without introducing controlled navigation', async ({
  page,
}) => {
  const carousel = await open(page, 'basic', 'drag:false');
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Missing basic carousel layout');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(
    carousel.locator(':scope > div:not([inert]) [data-item-index]')
  ).toHaveAttribute('data-item-index', '0');
  await expect(next(page)).toHaveCount(0);
});

test('content sizing ignores hidden tall cards and fits visible content', async ({
  page,
}) => {
  const carousel = await open(page, 'content-sizing');
  await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(1);
  const initialHeight = (await carousel.boundingBox())!.height;
  await selectSlide(page, 2);
  await expect(page.getByTestId('slide-number')).toHaveText('3');
  await expect(
    carousel.locator(':scope > div:not([inert]) [data-item-index]')
  ).toHaveAttribute('data-item-index', '2');
  await expect(carousel.locator('[data-item-index="3"]')).toHaveCount(1);
  await expect
    .poll(async () =>
      Math.abs((await carousel.boundingBox())!.height - initialHeight)
    )
    .toBeLessThan(2);
  await selectSlide(page, 3);
  await expect(
    carousel.locator(':scope > div:not([inert]) [data-item-index]')
  ).toHaveAttribute('data-item-index', '3');
  await expect
    .poll(async () => (await carousel.boundingBox())!.height)
    .toBeGreaterThan(initialHeight + 100);
  await selectSlide(page, 5);
  await expect(
    carousel.locator(':scope > div:not([inert]) [data-item-index]')
  ).toHaveAttribute('data-item-index', '5');
  await expect(carousel.locator('[data-item-index="4"]')).toHaveCount(1);
  await expect
    .poll(async () =>
      Math.abs((await carousel.boundingBox())!.height - initialHeight)
    )
    .toBeLessThan(2);
});

test('intrinsic content is centered inside a fixed viewport', async ({
  page,
}) => {
  const carousel = await open(
    page,
    'content-sizing',
    'crossAxisSize:container;slideAlign:center'
  );
  await expect(carousel).toHaveCSS('height', '280px');
  await expect
    .poll(() =>
      carousel.evaluate((root) => {
        const viewport = root.getBoundingClientRect();
        const card = root
          .querySelector(':scope > div:not([inert]) [data-item-index]')
          ?.getBoundingClientRect();
        if (!card || card.height >= viewport.height) return Infinity;
        return Math.abs(
          card.top + card.height / 2 - viewport.top - viewport.height / 2
        );
      })
    )
    .toBeLessThan(2);
});

test('regression examples fit desktop and narrow viewports', async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const story of [
      'basic',
      'controlled',
      'responsive',
      'vertical',
      'large-jumps',
      'content-sizing',
    ]) {
      const carousel = await open(page, story);
      await expect(
        carousel.locator(':scope > div:not([inert])').first()
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
    }
  }
});
