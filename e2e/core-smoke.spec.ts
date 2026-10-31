import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  openPausedMotion,
  expectAligned as expectMotionAligned,
  startIntegrityMonitor,
  stopIntegrityMonitor,
} from './helpers/motion.js';
import {
  delaySizingObservers,
  openSizing,
  startSizingMonitor,
  stopSizingMonitor,
  releaseSizingObservers,
} from './helpers/sizing.js';

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const gap of [0, 16]) {
    test(`${axis} gap=${gap}: swipe 6 → 7 never flashes a stale height during overshoot`, async ({
      page,
    }) => {
      await delaySizingObservers(page);
      const carousel = await openSizing(page, `axis:${axis};gap:${gap}`);
      await startSizingMonitor(carousel, axis);
      const box = await carousel.boundingBox();
      if (!box) throw new Error('Missing sizing viewport');
      const x = box.x + box.width * 0.8;
      const y = box.y + box.height * 0.8;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        axis === 'horizontal' ? x - box.width * 0.55 : x,
        axis === 'vertical' ? y - box.height * 0.55 : y,
        { steps: 8 }
      );
      await page.mouse.up();
      await expect(page.getByTestId('cursor')).toHaveText('6');
      await expect(
        carousel.locator(':scope > div:not([inert]) [data-item-index]')
      ).toHaveAttribute('data-item-index', '6');
      const audit = await stopSizingMonitor(carousel);
      expect(audit.samples).toBeGreaterThan(10);
      expect(audit.overshot).toBe(true);
      expect(audit.recycled).toBe(true);
      expect(audit.badSizes).toEqual([]);
      await releaseSizingObservers(page);
    });
  }
}

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const visibleCount of [1, 3]) {
    for (const [animation, configuration] of [
      ['spring', ''],
      [
        'bouncy',
        'animation.type:spring;animation.tension:180;animation.friction:12',
      ],
      ['duration', 'animation.type:duration;animation.duration:500'],
    ]) {
      test(`${axis} ${animation} V=${visibleCount}: first/last reversals never duplicate visible slides`, async ({
        page,
      }) => {
        const count = visibleCount * 2 + 4;
        const last = count - visibleCount;
        const carousel = await openPausedMotion(
          page,
          axis === 'vertical' ? 'vertical' : 'spring',
          `mode:finite;trimEnd:true;itemCount:${count};slidesPerView:${visibleCount};${configuration}`
        );
        await startIntegrityMonitor(carousel, axis, {
          uniqueContent: true,
          // Finite boundaries can expose empty space during spring overshoot.
          allowEmptySpace: true,
        });
        const firstButton = page.getByRole('button', {
          name: 'First slide',
          exact: true,
        });
        const lastButton = page.getByRole('button', {
          name: 'Last slide',
          exact: true,
        });
        await lastButton.click();
        await page.clock.runFor(3000);
        await expectMotionAligned(page, last, axis, count);
        for (const delay of [0, 80, 240]) {
          await firstButton.click();
          await page.clock.runFor(delay);
          await lastButton.click();
          await page.clock.runFor(3000);
          await expectMotionAligned(page, last, axis, count);
        }
        expect(await stopIntegrityMonitor(carousel)).toEqual([]);
        await expect(carousel.locator(':scope > div')).toHaveCount(
          visibleCount * 3
        );
      });
    }
  }
}

test('autosize follows visible content and ignores hidden resizes', async ({
  page,
}) => {
  for (const visible of [1, 2]) {
    await page.goto(
      `/iframe.html?id=regression-feature-harness--content-sizing&viewMode=story&args=slidesPerView:${visible}`
    );
    const carousel = page.getByTestId('carousel');
    const active = carousel.locator(':scope > div:not([inert])');
    await expect(active).toHaveCount(visible);
    const initialHeight = (await carousel.boundingBox())!.height;
    const select = async (index: number) => {
      await page
        .getByLabel('Go to slide', { exact: true })
        .selectOption({ value: String(index) });
      await expectMotionAligned(page, index, 'horizontal', 8);
      await expect(active).toHaveCount(visible);
    };
    await select(visible === 1 ? 2 : 1);
    await expect(carousel.locator('[data-item-index="3"]')).toHaveCount(1);
    await expect
      .poll(async () =>
        Math.abs((await carousel.boundingBox())!.height - initialHeight)
      )
      .toBeLessThan(2);
    await select(3);
    await expect
      .poll(async () => (await carousel.boundingBox())!.height)
      .toBeGreaterThan(initialHeight + 100);
    await select(5);
    const hidden = carousel.locator('[data-item-index="4"]');
    await expect(hidden).toHaveCount(1);
    await expect
      .poll(async () =>
        Math.abs((await carousel.boundingBox())!.height - initialHeight)
      )
      .toBeLessThan(2);
    const content = carousel.locator('[data-item-index="5"]');
    await content.evaluate((element) => {
      (element as HTMLElement).style.minHeight = '400px';
    });
    await expect
      .poll(async () => (await carousel.boundingBox())!.height)
      .toBeGreaterThan(initialHeight + 100);
    await hidden.evaluate((element) => {
      (element as HTMLElement).style.minHeight = '900px';
    });
    await content.evaluate((element) => {
      (element as HTMLElement).style.minHeight = '120px';
    });
    await expect
      .poll(async () =>
        Math.abs((await carousel.boundingBox())!.height - initialHeight)
      )
      .toBeLessThan(2);
  }
});

test('short default swipes work across viewport widths and axes', async ({
  page,
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const axis of ['horizontal', 'vertical'] as const) {
      await test.step(`${axis} at ${width}px`, async () => {
        await page.goto(
          `/iframe.html?id=regression-feature-harness--${axis === 'vertical' ? 'vertical' : 'basic'}&viewMode=story`
        );
        const carousel = page.getByTestId('carousel');
        const selected = carousel.locator(
          ':scope > div:not([inert]) [data-item-index]'
        );
        await expect(selected).toHaveAttribute('data-item-index', '0');
        const box = await carousel.boundingBox();
        if (!box) throw new Error('The feature carousel has no layout box');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const swipe = async (distance: number) => {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(
            axis === 'horizontal' ? x - distance : x,
            axis === 'vertical' ? y - distance : y,
            { steps: 8 }
          );
          await page.mouse.up();
        };
        await swipe(20);
        await expect(selected).toHaveAttribute('data-item-index', '0');
        await swipe(40);
        await expect(selected).toHaveAttribute('data-item-index', '1');
        await swipe(-40);
        await expect(selected).toHaveAttribute('data-item-index', '0');
      });
    }
  }
});

test('large transitions and reversal keep a bounded pool across browser engines', async ({
  page,
}) => {
  const carousel = await openPausedMotion(page);
  await startIntegrityMonitor(carousel);
  await page
    .getByRole('button', { name: 'Jump +1,000,000', exact: true })
    .click();
  await page.clock.runFor(96);
  await page
    .getByRole('button', { name: 'Jump −1,000,000', exact: true })
    .click();
  await page.clock.runFor(2000);
  await expectMotionAligned(page, -1_000_000);
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.clock.runFor(2000);
  await expectMotionAligned(page, -999_999);
  expect(await stopIntegrityMonitor(carousel)).toEqual([]);
  await expect(carousel.locator(':scope > div')).toHaveCount(9);
});

const openFixture = async (page: Page) => {
  await page.goto(
    '/iframe.html?id=regression-core-smoke--content&viewMode=story'
  );
  await expect(page.getByTestId('smoke-carousel')).toBeVisible();
};

const expectAligned = async (page: Page, index: number) => {
  await expect
    .poll(() =>
      page.getByTestId(`smoke-slide-${index}`).evaluate((slide) => {
        const viewport = document
          .querySelector('[data-testid="smoke-carousel"]')!
          .getBoundingClientRect();
        return Math.abs(slide.getBoundingClientRect().left - viewport.left);
      })
    )
    .toBeLessThan(2);
};

const swipeWithMouse = async (page: Page, content: Locator) => {
  const box = await content.boundingBox();
  if (!box) throw new Error('The slide content has no layout box');
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
};

const swipeWithTouch = async (
  client: CDPSession,
  page: Page,
  from: [number, number],
  to: [number, number],
  holdBeforeEnd = false
) => {
  const point = (x: number, y: number) => ({
    x,
    y,
    id: 1,
    radiusX: 1,
    radiusY: 1,
    force: 1,
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(...from)],
  });
  for (let step = 1; step <= 12; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        point(
          from[0] + ((to[0] - from[0]) * step) / 12,
          from[1] + ((to[1] - from[1]) * step) / 12
        ),
      ],
    });
    await page.waitForTimeout(16);
  }
  if (holdBeforeEnd) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(to[0] + 1, to[1])],
    });
    await page.waitForTimeout(1200);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(to[0] + 2, to[1])],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
};

test('core navigation keeps image cards aligned after resize', async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'Next slide' }).click();
  await expect(page.getByTestId('smoke-cursor')).toHaveText('1');
  await expectAligned(page, 1);
  await page.setViewportSize({ width: 360, height: 740 });
  await expectAligned(page, 1);
  await page.getByRole('button', { name: 'Previous slide' }).click();
  await expectAligned(page, 0);
  await expect(
    page.getByRole('button', { name: 'Previous slide' })
  ).toBeDisabled();
});

test('image and button swipes navigate without activating a card', async ({
  page,
}) => {
  await openFixture(page);
  await swipeWithMouse(page, page.getByRole('img', { name: 'Card 0' }));
  await expect(page.getByTestId('smoke-cursor')).toHaveText('1');
  await expectAligned(page, 1);
  await swipeWithMouse(
    page,
    page.getByRole('button', { name: 'Card 1 action' })
  );
  await expect(page.getByTestId('smoke-cursor')).toHaveText('2');
  await expectAligned(page, 2);
  await expect(page.getByTestId('smoke-actions')).toHaveText('0');
  await page.getByRole('button', { name: 'Card 2 action' }).click();
  await expect(page.getByTestId('smoke-actions')).toHaveText('1');
});

test('a stopped drag past halfway stays on the next slide after release', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await openFixture(page);
  await page.clock.pauseAt(new Date('2026-10-22T00:01:00Z'));
  const carousel = page.getByTestId('smoke-carousel');
  const box = await carousel.boundingBox();
  if (!box) throw new Error('The carousel has no layout box');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.85, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, y, { steps: 12 });
  await page.mouse.move(box.x + box.width * 0.15 + 1, y);
  await page.clock.runFor(2000);
  await page.mouse.move(box.x + box.width * 0.15 + 2, y);
  await page.mouse.up();
  await page.clock.runFor(2000);
  await expect(page.getByTestId('smoke-cursor')).toHaveText('1');
  await expectAligned(page, 1);
  await expect(carousel.locator(':scope > div')).toHaveCount(3);
});

test('trusted touch supports stopped releases and preserves vertical page scrolling', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name !== 'chromium-touch',
    'Trusted touch sequences use Chromium CDP in the mobile project.'
  );
  await openFixture(page);
  await page.evaluate(() => {
    const events: boolean[] = [];
    Object.assign(window, { smokeTouchEvents: events });
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') events.push(event.isTrusted);
    });
  });
  const client = await context.newCDPSession(page);
  const box = await page.getByTestId('smoke-carousel').boundingBox();
  if (!box) throw new Error('The carousel has no layout box');
  await swipeWithTouch(
    client,
    page,
    [box.x + box.width * 0.85, box.y + 60],
    [box.x + box.width * 0.85 - 20, box.y + 60]
  );
  await expect(page.getByTestId('smoke-cursor')).toHaveText('0');
  await swipeWithTouch(
    client,
    page,
    [box.x + box.width * 0.85, box.y + 60],
    [box.x + box.width * 0.85 - 40, box.y + 60]
  );
  await expect(page.getByTestId('smoke-cursor')).toHaveText('1');
  await expectAligned(page, 1);
  await swipeWithTouch(
    client,
    page,
    [box.x + box.width * 0.85, box.y + 60],
    [box.x + box.width * 0.15, box.y + 60],
    true
  );
  await expect(page.getByTestId('smoke-cursor')).toHaveText('2');
  await expectAligned(page, 2);
  await swipeWithTouch(
    client,
    page,
    [box.x + box.width / 2, box.y + 160],
    [box.x + box.width / 2, box.y + 20]
  );
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(40);
  await expect(page.getByTestId('smoke-cursor')).toHaveText('2');
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { smokeTouchEvents: boolean[] })
          .smokeTouchEvents
    )
  ).toEqual([true, true, true, true]);
  await client.detach();
});

test('trusted touch can drag across several slides before release', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name !== 'chromium-touch',
    'Trusted touch uses Chromium CDP in the mobile project.'
  );
  await page.goto(
    '/iframe.html?id=regression-feature-harness--controlled&viewMode=story&args=slidesPerView:3;itemCount:8;gap:16'
  );
  const carousel = page.getByTestId('carousel');
  await carousel.evaluate((root) => {
    (root as HTMLElement).style.width = '300px';
  });
  await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(3);
  const client = await context.newCDPSession(page);
  const box = (await carousel.boundingBox())!;
  const pitch = (box.width + 16) / 3;
  await swipeWithTouch(
    client,
    page,
    [box.x + box.width * 0.95, box.y + 60],
    [box.x + box.width * 0.95 - 2.2 * pitch, box.y + 60],
    true
  );
  await expectMotionAligned(page, 2, 'horizontal', 8);
  await swipeWithTouch(
    client,
    page,
    [box.x + 10, box.y + 60],
    [box.x + 10 + 2.2 * pitch, box.y + 60],
    true
  );
  await expectMotionAligned(page, 0, 'horizontal', 8);
  await client.detach();
});
