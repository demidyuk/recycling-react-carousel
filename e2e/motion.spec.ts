import { expect, test } from '@playwright/test';
import {
  openMotion,
  expectAligned,
  startIntegrityMonitor,
  stopIntegrityMonitor,
  openPausedMotion,
  readOffset,
  navigateRapidly,
} from './helpers/motion.js';

for (const [axis, direction, reversePixels, jitterAfterPause] of [
  ['horizontal', 1, 0, false],
  ['horizontal', 1, 1, false],
  ['horizontal', -1, 1, false],
  ['vertical', 1, 1, false],
  ['horizontal', 1, 1, true],
  ['vertical', 1, 1, true],
] as const) {
  test(`${axis}: stopped drag commits in direction ${direction}, ${reversePixels}px jitter ${jitterAfterPause ? 'after' : 'before'} pause`, async ({
    page,
  }) => {
    const carousel = await openPausedMotion(
      page,
      axis === 'vertical' ? 'vertical' : 'spring'
    );
    const box = await carousel.boundingBox();
    if (!box) throw new Error('Missing carousel layout');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const itemSize = await carousel
      .locator(':scope > div')
      .first()
      .evaluate(
        (actor, axis) =>
          actor.getBoundingClientRect()[
            axis === 'horizontal' ? 'width' : 'height'
          ],
        axis
      );
    const distance = itemSize * 0.7 * direction;
    const target = (jitter: number) =>
      axis === 'horizontal'
        ? { x: x - distance + jitter * direction, y }
        : { x, y: y - distance + jitter * direction };
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(target(0).x, target(0).y, { steps: 12 });
    if (jitterAfterPause) {
      await page.clock.runFor(2000);
      expect(await readOffset(carousel, axis)).toBeCloseTo(-0.7 * direction, 2);
    }
    if (reversePixels)
      await page.mouse.move(target(reversePixels).x, target(reversePixels).y);
    if (!jitterAfterPause) {
      await page.clock.runFor(2000);
      expect(await readOffset(carousel, axis)).toBeCloseTo(
        (-0.7 + reversePixels / itemSize) * direction,
        2
      );
    }
    await page.mouse.up();
    await expect(page.getByTestId('cursor')).toHaveText(String(direction));
    await page.clock.runFor(2000);
    await expectAligned(page, direction, axis);
  });
}

for (const [story, visibleCount, axis] of [
  ['spring', 3, 'horizontal'],
  ['bouncy', 3, 'horizontal'],
  ['rich', 1, 'horizontal'],
  ['vertical-jumps', 4, 'vertical'],
] as const) {
  test(`${story}: large jumps and immediate reversals preserve visible content`, async ({
    page,
  }) => {
    const carousel = await openPausedMotion(
      page,
      story,
      `slidesPerView:${visibleCount}`
    );
    await startIntegrityMonitor(carousel, axis);
    const originalActors = await carousel.evaluateHandle((root) =>
      Array.from(root.children)
    );
    // The global cursor is accepted before animation has taken even one frame.
    await page
      .getByRole('button', { name: 'Jump +1,000,000', exact: true })
      .click();
    await expect(page.getByTestId('cursor')).toHaveText('1000000');
    await expect(
      carousel.locator('[data-item-index="0"]').first()
    ).toBeVisible();
    await page.clock.runFor(96);
    await page
      .getByRole('button', { name: 'Jump −1,000,000', exact: true })
      .click();
    await expect(page.getByTestId('cursor')).toHaveText('-1000000');
    await page.clock.runFor(64);
    // A small update during projection must not replace the outgoing content.
    await page.getByRole('button', { name: 'Next slide', exact: true }).click();
    await page.clock.runFor(3000);
    await expectAligned(page, -999_999, axis);
    await page.getByRole('button', { name: 'Last slide', exact: true }).click();
    await page.clock.runFor(3000);
    await expectAligned(page, 499, axis);
    await page
      .getByRole('button', { name: 'First slide', exact: true })
      .click();
    await page.clock.runFor(3000);
    await expectAligned(page, 0, axis);
    expect(await stopIntegrityMonitor(carousel)).toEqual([]);
    await expect(carousel.locator(':scope > div')).toHaveCount(
      visibleCount * 3
    );
    expect(
      await carousel.evaluate(
        (root, actors) =>
          actors.every((actor, index) => actor === root.children[index]),
        originalActors
      )
    ).toBe(true);
    await originalActors.dispose();
  });
}

test('compressed jumps keep animating while drag attempts are ignored', async ({
  page,
}) => {
  const carousel = await openPausedMotion(
    page,
    'spring',
    'swipeThreshold:200px'
  );
  await startIntegrityMonitor(carousel);
  await page
    .getByRole('button', { name: 'Jump +1,000,000', exact: true })
    .click();
  await page.clock.runFor(96);
  const before = await readOffset(carousel);
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Missing carousel layout');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (box.width / 3) * 0.3, y);
  expect(await readOffset(carousel)).toBeCloseTo(before, 4);
  await page.clock.runFor(240);
  expect(await readOffset(carousel)).toBeLessThan(before - 0.03);
  await page.mouse.up();
  await page.clock.runFor(2000);
  await expectAligned(page, 1_000_000);
  // A swipe above the threshold is ignored during a reverse jump too.
  await page
    .getByRole('button', { name: 'Jump −1,000,000', exact: true })
    .click();
  await page.clock.runFor(96);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (box.width / 3) * 0.7, y, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('cursor')).toHaveText('-1000000');
  await page.clock.runFor(2000);
  await expectAligned(page, -1_000_000);
  expect(await stopIntegrityMonitor(carousel)).toEqual([]);
});

test('finite large transitions honor trimmed bounds in both directions', async ({
  page,
}) => {
  const carousel = await openPausedMotion(
    page,
    'spring',
    'mode:finite;trimEnd:true'
  );
  await startIntegrityMonitor(carousel);
  await page
    .getByRole('button', { name: 'Jump +1,000,000', exact: true })
    .click();
  await page.clock.runFor(2000);
  await expectAligned(page, 497);
  await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(3);
  await page
    .getByRole('button', { name: 'Jump −1,000,000', exact: true })
    .click();
  await page.clock.runFor(2000);
  await expectAligned(page, 0);
  expect(await stopIntegrityMonitor(carousel)).toEqual([]);
});

test('reduced motion shows large destinations immediately', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await openPausedMotion(page);
  await startIntegrityMonitor(carousel);
  for (const [label, cursor] of [
    ['Jump +1,000,000', 1_000_000],
    ['Jump −1,000,000', -1_000_000],
  ] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expectAligned(page, cursor);
    await expect(carousel.locator(':scope > div')).toHaveCount(9);
  }
  // Immediate replacement is intentional with reduced motion; check geometry.
  expect(
    (await stopIntegrityMonitor(carousel)).filter((violation) =>
      violation.includes('gap')
    )
  ).toEqual([]);
});

test('dense pointer updates keep dragging responsive through a direction reversal', async ({
  page,
}) => {
  const carousel = await openPausedMotion(
    page,
    'spring',
    'swipeThreshold:200px'
  );
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Missing carousel layout');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const itemWidth = box.width / 3;
  await startIntegrityMonitor(carousel);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (const direction of [1, -1]) {
    await page.mouse.move(x + direction * itemWidth * 0.3, y);
    for (let frame = 0; frame < 10; frame += 1) {
      await page.clock.runFor(15);
      await page.mouse.move(
        x + itemWidth * (direction * 0.3 + (frame % 2) * 0.001),
        y
      );
      await page.clock.runFor(1);
    }
    const offset = await readOffset(carousel);
    if (direction > 0) expect(offset).toBeGreaterThan(0.14);
    else expect(offset).toBeLessThan(-0.05);
  }
  await page.mouse.up();
  await page.clock.runFor(2000);
  await expectAligned(page, 0);
  expect(await stopIntegrityMonitor(carousel)).toEqual([]);
});

test('an opposite swipe catches a transition at its visible position', async ({
  page,
}) => {
  const carousel = await openPausedMotion(
    page,
    'spring',
    'swipeThreshold:200px'
  );
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.clock.runFor(96);
  const before = await readOffset(carousel);
  expect(before).toBeLessThan(-0.25);
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Missing carousel layout');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (box.width / 3) * 0.2, y);
  await page.clock.runFor(240);
  expect(await readOffset(carousel)).toBeGreaterThan(before + 0.03);
  await page.mouse.up();
  await page.clock.runFor(2000);
  await expectAligned(page, 1);
});

test('wraps across the collection boundary in both directions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await openMotion(page);
  await expectAligned(page, 0);
  await page
    .getByRole('button', { name: 'Previous slide', exact: true })
    .click();
  await expectAligned(page, -1);
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expectAligned(page, 0);
  await page.getByRole('button', { name: 'Last slide', exact: true }).click();
  await expectAligned(page, 499);
  await startIntegrityMonitor(page.getByTestId('carousel'));
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expectAligned(page, 500);
  await page
    .getByRole('button', { name: 'Previous slide', exact: true })
    .click();
  await expectAligned(page, 499);
  expect(await stopIntegrityMonitor(page.getByTestId('carousel'))).toEqual([]);
  expect(errors).toEqual([]);
});

for (const [story, visibleCount] of [
  ['spring', 3],
  ['bouncy', 3],
  ['rich', 1],
] as const) {
  test(`${story}: rapid retargeting and reversal preserve the fixed pool`, async ({
    page,
  }) => {
    await openMotion(page, story);
    await expectAligned(page, 0);
    const carousel = page.getByTestId('carousel');
    await carousel.evaluate((root) => {
      Object.assign(root, { __initialActors: Array.from(root.children) });
    });
    await startIntegrityMonitor(carousel);
    await navigateRapidly(page, Array(16).fill(1));
    await expectAligned(page, 16);
    await navigateRapidly(page, [...Array(8).fill(1), ...Array(8).fill(-1)]);
    await expectAligned(page, 16);
    expect(await stopIntegrityMonitor(carousel)).toEqual([]);
    await expect(carousel.locator(':scope > div')).toHaveCount(
      visibleCount * 3
    );
    expect(
      await carousel.evaluate((root) => {
        const initial = (root as HTMLElement & { __initialActors: Element[] })
          .__initialActors;
        return initial.every((actor, index) => actor === root.children[index]);
      })
    ).toBe(true);
  });
}

test('swipes navigate before and after resize', async ({ page }) => {
  await openMotion(page);
  for (let cursor = 1; cursor <= 2; cursor += 1) {
    const carousel = page.getByTestId('carousel');
    const box = await carousel.boundingBox();
    if (!box) throw new Error('Missing carousel layout');
    const x = box.x + box.width * 0.7;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - (box.width / 3) * 0.7, y, { steps: 12 });
    await page.mouse.up();
    await expectAligned(page, cursor);
    await page.setViewportSize({ width: 390, height: 900 });
    // ResizeObserver and React must commit the new geometry before a new drag.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
  }
  await expectAligned(page, 2);
});

test('vertical recycling works with four visible slides and negative cursors', async ({
  page,
}) => {
  await openMotion(page, 'vertical', 'slidesPerView:4');
  await expectAligned(page, 0, 'vertical');
  await startIntegrityMonitor(page.getByTestId('carousel'), 'vertical');
  await page
    .getByRole('button', { name: 'Previous slide', exact: true })
    .click();
  await expectAligned(page, -1, 'vertical');
  await navigateRapidly(page, Array(16).fill(1));
  await expectAligned(page, 15, 'vertical');
  expect(await stopIntegrityMonitor(page.getByTestId('carousel'))).toEqual([]);
  await expect(
    page.getByTestId('carousel').locator(':scope > div')
  ).toHaveCount(12);
});
