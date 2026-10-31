import { expect, test } from '@playwright/test';
import { expectAligned } from './helpers/motion.js';
import { openStory } from './helpers/story.js';
import {
  delaySizingObservers,
  openSizing,
  startSizingMonitor,
  stopSizingMonitor,
  releaseSizingObservers,
} from './helpers/sizing.js';

for (const initial of [0, 7]) {
  test(`height follows a compressed reversal away from retained endpoint ${initial}`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
    const carousel = await openStory(
      page,
      'regression-sizing--content',
      `initialIndex:${initial};animation.type:duration;animation.duration:1000`
    );
    await expect(carousel).toHaveCSS('height', '136px');
    await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
    const select = page.getByRole('combobox', {
      name: 'Go to slide',
      exact: true,
    });
    await select.selectOption({ value: String(7 - initial) });
    await page.clock.runFor(100);
    await select.selectOption({ value: initial === 0 ? '3' : '4' });
    await expect(carousel).toHaveCSS('height', '136px');
    await page.clock.runFor(160);
    const middle = (await carousel.boundingBox())!.height;
    expect(middle).toBeGreaterThan(196);
    expect(middle).toBeLessThan(316);
    await page.clock.runFor(240);
    const approaching = (await carousel.boundingBox())!.height;
    expect(approaching).toBeGreaterThan(330);
    expect(approaching).toBeLessThan(336);
    await page.clock.runFor(150);
    await expect(carousel).toHaveCSS('height', '336px');
    expect(336 - approaching).toBeLessThan(6);
  });
}

for (const { layout, initial, elapsed } of [
  { layout: 'slidesPerView:2.5', initial: 0, elapsed: 250 },
  { layout: 'gap:64', initial: 2, elapsed: 80 },
]) {
  test(`retargeting preserves interpolated height with ${layout}`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
    const carousel = await openStory(
      page,
      'regression-sizing--content',
      `initialIndex:${initial};${layout};animation.type:duration;animation.duration:1000`
    );
    await expect(carousel).toHaveCSS('height', '136px');
    await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
    const select = page.getByRole('combobox', {
      name: 'Go to slide',
      exact: true,
    });
    await select.selectOption({ value: String(initial + 1) });
    await page.clock.runFor(elapsed);
    const before = (await carousel.boundingBox())!.height;
    expect(before).toBeGreaterThan(146);
    await select.selectOption({ value: '7' });
    expect(
      Math.abs((await carousel.boundingBox())!.height - before)
    ).toBeLessThan(1);
    await page.clock.runFor(16);
    const nextFrame = (await carousel.boundingBox())!.height;
    expect(nextFrame).toBeLessThan(before);
    expect(nextFrame).toBeGreaterThan(136);
    await page.clock.runFor(550);
    await expect(carousel).toHaveCSS('height', '136px');
  });
}

test('animated content height includes slide and viewport padding during movement', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const carousel = await openStory(
    page,
    'regression-sizing--content',
    'initialIndex:2;animation.type:duration;animation.duration:1000'
  );
  await carousel.evaluate((root) => {
    Object.assign(root.style, {
      border: '4px solid',
      padding: '6px',
      boxSizing: 'border-box',
    });
  });
  await expect(carousel).toHaveCSS('height', '156px');
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  await page
    .getByRole('combobox', { name: 'Go to slide', exact: true })
    .selectOption({ value: '3' });
  await page.clock.runFor(250);
  const state = await carousel.evaluate((root) => {
    const box = root.getBoundingClientRect();
    const actor = root
      .querySelector('[data-item-index="2"]')!
      .closest('[data-carousel-slide]')!
      .getBoundingClientRect();
    return {
      height: box.height,
      progress: (box.left + 4 - actor.left) / actor.width,
    };
  });
  expect(state.progress).toBeGreaterThan(0.1);
  expect(state.progress).toBeLessThan(0.4);
  expect(Math.abs(state.height - (156 + 200 * state.progress))).toBeLessThan(1);
  await page.clock.runFor(1100);
  await expect(carousel).toHaveCSS('height', '356px');
});

test('animated height fits fractional finite endpoints and stays stable during outward resistance', async ({
  page,
}) => {
  const carousel = await openStory(
    page,
    'regression-sizing--content',
    'initialIndex:0;slidesPerView:2.5;animation.type:duration;animation.duration:0'
  );
  await expect(carousel).toHaveCSS('height', '136px');
  await page
    .getByRole('combobox', { name: 'Go to slide', exact: true })
    .selectOption({ value: '3' });
  await expect(carousel).toHaveCSS('height', '336px');
  await page
    .getByRole('combobox', { name: 'Go to slide', exact: true })
    .selectOption({ value: '7' });
  await expect(carousel).toHaveCSS('height', '136px');
  const box = (await carousel.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + 30, { steps: 8 });
  await expect(carousel).toHaveCSS('height', '136px');
  await page.mouse.up();
  await expect(carousel).toHaveCSS('height', '136px');
});

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const visible of [1, 2]) {
    for (const [animation, args] of [
      [
        'spring',
        'animation.type:spring;animation.tension:170;animation.friction:26',
      ],
      ['duration', 'animation.type:duration;animation.duration:150'],
      ['zero-duration', 'animation.type:duration;animation.duration:0'],
      ['reduced-motion', ''],
    ]) {
      test(`${axis} V=${visible} ${animation}: recycled measurements are correct on every frame`, async ({
        page,
      }) => {
        if (animation === 'reduced-motion')
          await page.emulateMedia({ reducedMotion: 'reduce' });
        await delaySizingObservers(page);
        const carousel = await openSizing(
          page,
          `axis:${axis};slidesPerView:${visible};initialIndex:${3 - visible};${args}`
        );
        await startSizingMonitor(carousel, axis);
        const select = async (index: number) => {
          await page
            .getByRole('combobox', { name: 'Go to slide', exact: true })
            .selectOption({ value: String(index) });
          await expect(page.getByTestId('cursor')).toHaveText(String(index));
        };
        await select(6);
        await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
          visible
        );
        // Keep this route short throughout, including intermediate cards.
        // A mixed-screen transition through tall content is covered separately.
        for (const index of [0, 6, 5, 6]) await select(index);
        await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
          visible
        );
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              )
            )
        );
        const audit = await stopSizingMonitor(carousel);
        expect(audit.samples).toBeGreaterThan(1);
        expect(audit.badSizes).toEqual([]);
        await releaseSizingObservers(page);
      });
    }
  }
}

for (const axis of ['horizontal', 'vertical'] as const) {
  test(`${axis}: a retargeted compressed transition fits a real tall card and shrinks on settlement`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-27T00:00:00Z') });
    await delaySizingObservers(page);
    const carousel = await openSizing(
      page,
      `axis:${axis};slidesPerView:2;initialIndex:0;animation.type:duration;animation.duration:1000`
    );
    const cross = axis === 'horizontal' ? 'height' : 'width';
    await expect(carousel).toHaveCSS(cross, '136px');
    await page.clock.pauseAt(new Date('2026-10-27T00:01:00Z'));
    const select = page.getByRole('combobox', {
      name: 'Go to slide',
      exact: true,
    });
    await select.selectOption({ value: '3' });
    await page.clock.runFor(100);
    const overlap = await carousel
      .locator('[data-item-index="3"]')
      .evaluate((card, axis) => {
        const viewport = card
          .closest('[data-testid="carousel"]')!
          .getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        return axis === 'horizontal'
          ? Math.min(rect.right, viewport.right) -
              Math.max(rect.left, viewport.left)
          : Math.min(rect.bottom, viewport.bottom) -
              Math.max(rect.top, viewport.top);
      }, axis);
    expect(overlap).toBeGreaterThan(10);
    if (axis === 'horizontal') {
      const state = await carousel.evaluate((root) => {
        const viewport = root.getBoundingClientRect();
        const outgoing = root
          .querySelector('[data-item-index="0"]')!
          .closest('[data-carousel-slide]')!
          .getBoundingClientRect();
        return {
          height: viewport.height,
          progress: (viewport.left - outgoing.left) / outgoing.width,
        };
      });
      // The first window is short; its neighbor contains the tall incoming card.
      expect(state.progress).toBeGreaterThan(0);
      expect(
        Math.abs(state.height - (136 + 200 * Math.min(state.progress, 1)))
      ).toBeLessThan(1);
    } else {
      await expect(carousel).toHaveCSS(cross, '336px');
    }
    // Compressed jumps reject dragging; API navigation can still reverse one
    // while the incoming tall card remains visible.
    const beforeReversal = (await carousel.boundingBox())![cross];
    await select.selectOption({ value: '1' });
    if (axis === 'horizontal')
      expect(
        Math.abs((await carousel.boundingBox())!.height - beforeReversal)
      ).toBeLessThan(1);
    await expect(page.getByTestId('cursor')).toHaveText('1');
    await page.clock.runFor(550);
    await expectAligned(page, 1, axis, 8);
    await expect(carousel).toHaveCSS(cross, '136px');
    await releaseSizingObservers(page);
  });
}
