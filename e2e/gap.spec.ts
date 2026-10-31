import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  delaySizingObservers,
  openSizing,
  releaseSizingObservers,
} from './helpers/sizing.js';

type Axis = 'horizontal' | 'vertical';

const open = async (page: Page, axis: Axis, args: string) => {
  const story = axis === 'horizontal' ? 'controlled' : 'vertical';
  await page.goto(
    `/iframe.html?id=regression-feature-harness--${story}&viewMode=story&args=${encodeURIComponent(`itemCount:8;animation.type:duration;animation.duration:0;${args}`)}`
  );
  return page.getByTestId('carousel');
};

// Check the cards themselves, including both viewport edges, rather than the
// recycling carriers which also reserve the inter-slide space.
const expectGap = async (
  carousel: Locator,
  axis: Axis,
  visible: number,
  gap: number
) => {
  await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
    visible
  );
  await expect
    .poll(() =>
      carousel.evaluate(
        (root, { axis, visible, gap }) => {
          const start = axis === 'horizontal' ? 'left' : 'top';
          const end = axis === 'horizontal' ? 'right' : 'bottom';
          const length = axis === 'horizontal' ? 'width' : 'height';
          const viewport = root.getBoundingClientRect();
          const cards = [
            ...root.querySelectorAll(
              ':scope > div:not([inert]) [data-item-index]'
            ),
          ]
            .map((card) => card.getBoundingClientRect())
            .sort((a, b) => a[start] - b[start]);
          if (cards.length !== visible) return Infinity;
          const size = (viewport[length] - (visible - 1) * gap) / visible;
          return Math.max(
            Math.abs(cards[0][start] - viewport[start]),
            Math.abs(cards[cards.length - 1][end] - viewport[end]),
            ...cards.map((card) => Math.abs(card[length] - size)),
            ...cards
              .slice(1)
              .map((card, index) =>
                Math.abs(card[start] - cards[index][end] - gap)
              )
          );
        },
        { axis, visible, gap }
      )
    )
    .toBeLessThan(1);
};

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const visible of [1, 3]) {
    for (const mode of ['finite', 'loop', 'forward-loop']) {
      test(`${axis} V=${visible} ${mode}: native gaps fit without outer insets`, async ({
        page,
      }) => {
        const carousel = await open(
          page,
          axis,
          `slidesPerView:${visible};mode:${mode};gap:12.5`
        );
        await expectGap(carousel, axis, visible, 12.5);
        await page
          .getByRole('button', { name: 'Next slide', exact: true })
          .click();
        await expect(page.getByTestId('cursor')).toHaveText('1');
        await expectGap(carousel, axis, visible, 12.5);
        await page
          .getByRole('button', { name: 'Last slide', exact: true })
          .click();
        if (mode === 'finite')
          await expect(page.getByTestId('cursor')).toHaveText(
            String(8 - visible)
          );
        else await expect(page.getByTestId('slide-number')).toHaveText('8');
        await expectGap(carousel, axis, visible, 12.5);
        await page
          .getByRole('button', { name: 'Previous slide', exact: true })
          .click();
        await expectGap(carousel, axis, visible, 12.5);
        await page
          .getByRole('combobox', { name: 'Go to slide', exact: true })
          .selectOption({ value: '2' });
        await expect(page.getByTestId('slide-number')).toHaveText('3');
        await expectGap(carousel, axis, visible, 12.5);
      });
    }
  }

  test(`${axis}: content sizing follows card edges within a gap during drag reversal`, async ({
    page,
  }) => {
    await page.clock.install();
    await delaySizingObservers(page);
    const carousel = await openSizing(
      page,
      `axis:${axis};slidesPerView:2;gap:64;initialIndex:4;animation.type:duration;animation.duration:0`
    );
    const cross = axis === 'horizontal' ? 'height' : 'width';
    await expect(carousel).toHaveCSS(cross, '336px');
    const box = await carousel.boundingBox();
    if (!box) throw new Error('Missing sizing viewport');
    const pitch = ((axis === 'horizontal' ? box.width : box.height) + 64) / 2;
    const x = box.x + box.width * 0.85;
    const y = box.y + box.height * 0.85;
    await page.mouse.move(x, y);
    await page.mouse.down();
    const move = (fraction: number) =>
      page.mouse.move(
        axis === 'horizontal' ? x - pitch * fraction : x,
        axis === 'vertical' ? y - pitch * fraction : y,
        { steps: 8 }
      );
    await move(0.9);
    await expect
      .poll(async () =>
        Math.abs(
          (await carousel.boundingBox())![cross] -
            (axis === 'horizontal' ? 156 : 136)
        )
      )
      .toBeLessThan(1);
    await move(0.3);
    await expect
      .poll(async () =>
        Math.abs(
          (await carousel.boundingBox())![cross] -
            (axis === 'horizontal' ? 276 : 336)
        )
      )
      .toBeLessThan(1);
    await page.clock.runFor(150);
    await page.mouse.up();
    await expect(page.getByTestId('cursor')).toHaveText('4');
    await expect(carousel).toHaveCSS(cross, '336px');
    await page.getByRole('button', { name: 'Next slide', exact: true }).click();
    await expect(page.getByTestId('cursor')).toHaveText('5');
    await expect(carousel).toHaveCSS(cross, '136px');
    await releaseSizingObservers(page);
  });
}

test('responsive gaps merge with sizing rules and leave the last viewport flush', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=regression-feature-harness--responsive&viewMode=story&args=gap:8;animation.type:duration;animation.duration:0'
  );
  const carousel = page.getByTestId('carousel');
  await page.getByRole('button', { name: 'Last slide', exact: true }).click();
  for (const [width, visible, gap] of [
    [400, 1, 8],
    [600, 2, 8],
    [1100, 4, 24],
  ]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
      visible
    );
    await page.getByRole('button', { name: 'Last slide', exact: true }).click();
    await expect(page.getByTestId('cursor')).toHaveText(String(12 - visible));
    await expectGap(carousel, 'horizontal', visible, gap);
  }
});

test('auto sizing uses gaps when choosing a count, and zero gap keeps slides adjacent', async ({
  page,
}) => {
  const carousel = await open(
    page,
    'horizontal',
    'slidesPerView:auto;maxSlideSize:190px;gap:16'
  );
  await carousel.evaluate((root) => {
    (root as HTMLElement).style.width = '600px';
  });
  await expectGap(carousel, 'horizontal', 3, 16);
  const adjacent = await open(page, 'horizontal', 'slidesPerView:3;gap:0');
  await expectGap(adjacent, 'horizontal', 3, 0);
});
