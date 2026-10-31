import { expect, test } from '@playwright/test';
import { openStory } from './helpers/story.js';
import {
  expectCardCentered,
  expectAtHorizontalCenter,
  expectAtFirstHorizontalSlot,
  startHorizontalTeleportMonitor,
  stopHorizontalTeleportMonitor,
  startVerticalIntegrityMonitor,
  stopVerticalIntegrityMonitor,
  clickRapidly,
} from './helpers/geometry.js';

test('settles rapid controlled cursor changes without recycling visible slots', async ({
  page,
}) => {
  await openStory(page, 'regression-feature-harness--controlled');
  const back = page.getByRole('button', {
    name: 'Previous slide',
    exact: true,
  });
  const next = page.getByRole('button', { name: 'Next slide', exact: true });
  const firstBox = await page
    .getByRole('heading', { includeHidden: true, name: '1' })
    .boundingBox();
  if (!firstBox) {
    throw new Error('The first card has no browser layout box');
  }
  const firstVisiblePosition = firstBox.x + firstBox.width / 2;

  await next.click();
  await next.click();
  await expectAtHorizontalCenter(
    page.getByRole('heading', { includeHidden: true, name: '3' }),
    firstVisiblePosition
  );

  await back.click();
  await expectAtHorizontalCenter(
    page.getByRole('heading', { includeHidden: true, name: '2' }),
    firstVisiblePosition
  );
});

test('animates an interrupted million-slide reverse jump without an update loop', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await openStory(page, 'regression-motion--million-slide-jump');
  await page.clock.pauseAt(new Date('2026-10-22T00:01:00Z'));
  const carousel = page.getByTestId('carousel');

  await page.getByTestId('million-next').click();
  await page.clock.runFor(100);
  await page.getByTestId('million-back').click();
  // The original loop started when the interrupted spring settled.
  await page.clock.runFor(3000);

  await expect
    .poll(() =>
      carousel.evaluate((element) => {
        const carouselBox = element.getBoundingClientRect();
        const firstSlotCenter = carouselBox.left + carouselBox.width / 6;
        const closestActor = [...element.children]
          .map((actor) => {
            const actorBox = actor.getBoundingClientRect();
            return {
              distance: Math.abs(
                actorBox.left + actorBox.width / 2 - firstSlotCenter
              ),
              text: actor.textContent?.trim(),
            };
          })
          .sort((left, right) => left.distance - right.distance)[0];

        return closestActor?.text;
      })
    )
    .toBe('1');
  expect(pageErrors).toEqual([]);
});

test('keeps a million-slide jump bounded after a small follow-up request', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await openStory(page, 'regression-motion--million-slide-jump');
  await page.clock.pauseAt(new Date('2026-10-22T00:01:00Z'));
  const carousel = page.getByTestId('carousel');

  await page.getByTestId('million-next').click();
  await page.clock.runFor(100);
  await page.getByTestId('million-jump').click();
  await page.getByTestId('million-next').click();
  await page.clock.runFor(3000);

  await expect
    .poll(() =>
      carousel.evaluate((element) => {
        const viewport = element.getBoundingClientRect();
        const firstSlotCenter = viewport.left + viewport.width / 6;
        return [...element.children]
          .map((actor) => {
            const rect = actor.getBoundingClientRect();
            return {
              distance: Math.abs(rect.left + rect.width / 2 - firstSlotCenter),
              text: actor.textContent?.trim(),
            };
          })
          .sort((left, right) => left.distance - right.distance)[0]?.text;
      })
    )
    .toBe('6');
  await expect(carousel.locator(':scope > div')).toHaveCount(9);
  expect(pageErrors).toEqual([]);
});

test('keeps a fixed shared-spring pool through rapid loop navigation', async ({
  page,
}) => {
  await openStory(page, 'regression-motion--rapid-controlled-loop');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');
  const cursor = page.getByTestId('rapid-cursor');
  const next = page.getByTestId('rapid-next');

  await expect(actors).toHaveCount(9);
  await expectAtFirstHorizontalSlot(
    carousel,
    page
      .getByTestId('rapid-slide-1')
      .getByRole('heading', { includeHidden: true }),
    3
  );
  await startHorizontalTeleportMonitor(carousel);

  // A single update starts the spring with the baseline V + V + V actors.
  await next.click();
  await expect(cursor).toHaveText('1');
  await expect(actors).toHaveCount(9);

  // Retarget the same shared spring without reserving extra carriers.
  await next.click();
  await expect(cursor).toHaveText('2');
  await expect(actors).toHaveCount(9);

  await clickRapidly(page, 'rapid-next', 5);
  await expect(cursor).toHaveText('7');
  await expect(actors).toHaveCount(9);

  await clickRapidly(page, 'rapid-back', 13);
  await expect(cursor).toHaveText('-6');

  await expect.poll(() => actors.count(), { timeout: 10_000 }).toBe(9);
  await expectAtFirstHorizontalSlot(
    carousel,
    page
      .getByTestId('rapid-slide-27')
      .getByRole('heading', { includeHidden: true }),
    3
  );

  const teleportViolations = await stopHorizontalTeleportMonitor(carousel);
  expect(teleportViolations).toEqual([]);
});

test('recycles from the live shared position without extending the pool', async ({
  page,
}) => {
  await openStory(page, 'regression-motion--slow-recycling');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');

  await expect(actors).toHaveCount(3);
  await startHorizontalTeleportMonitor(carousel);

  await page.getByTestId('motion-next').click();
  await expect(page.getByTestId('motion-cursor')).toHaveText('1');

  await expect(actors).toHaveCount(3);
  await expect.poll(() => actors.count(), { timeout: 10_000 }).toBe(3);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '2' }),
    'x'
  );

  const teleportViolations = await stopHorizontalTeleportMonitor(carousel);
  expect(teleportViolations).toEqual([]);
});

test('guards an overshooting spring without teleporting actors', async ({
  page,
}) => {
  await openStory(page, 'regression-motion--overshoot');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');

  await expect(actors).toHaveCount(3);
  await startHorizontalTeleportMonitor(carousel);

  await page.getByTestId('motion-next').click();
  await expect(page.getByTestId('motion-cursor')).toHaveText('1');
  await expect(actors).toHaveCount(3);

  const secondCard = page.getByRole('heading', {
    includeHidden: true,
    name: '2',
  });
  await expect
    .poll(async () => {
      const carouselBox = await carousel.boundingBox();
      const cardBox = await secondCard.boundingBox();
      if (!carouselBox || !cardBox) return 0;
      return (
        cardBox.x + cardBox.width / 2 - (carouselBox.x + carouselBox.width / 2)
      );
    })
    .toBeLessThan(-4);
  await expect.poll(() => actors.count(), { timeout: 10_000 }).toBe(3);
  await expectCardCentered(carousel, secondCard, 'x');

  const teleportViolations = await stopHorizontalTeleportMonitor(carousel);
  expect(teleportViolations).toEqual([]);
});

test('keeps a fixed pool during vertical dragging', async ({ page }) => {
  await openStory(page, 'regression-motion--vertical-recycling');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');
  const box = await carousel.boundingBox();
  if (!box) {
    throw new Error('Carousel has no browser layout box');
  }

  await expect(actors).toHaveCount(3);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, {
    steps: 8,
  });
  await expect(actors).toHaveCount(3);
  await page.mouse.up();

  await expect.poll(() => actors.count(), { timeout: 10_000 }).toBe(3);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '1' }),
    'y'
  );
});

test('preserves unit spacing during interrupted vertical springs', async ({
  page,
}) => {
  await openStory(page, 'regression-motion--vertical-recycling');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');

  await expect(actors).toHaveCount(3);
  await startVerticalIntegrityMonitor(carousel);

  await clickRapidly(page, 'motion-next', 2, 500);
  await expect(page.getByTestId('motion-cursor')).toHaveText('2');
  await expect(actors).toHaveCount(3);

  await page.getByTestId('motion-next').click();
  await expect(page.getByTestId('motion-cursor')).toHaveText('3');
  await expect(actors).toHaveCount(3);
  await expect.poll(() => actors.count(), { timeout: 10_000 }).toBe(3);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '4' }),
    'y'
  );

  await clickRapidly(page, 'motion-back', 2, 500);
  await expect(page.getByTestId('motion-cursor')).toHaveText('1');
  await expect(actors).toHaveCount(3);

  await page.getByTestId('motion-back').click();
  await expect(page.getByTestId('motion-cursor')).toHaveText('0');
  await expect(actors).toHaveCount(3);
  await expect.poll(() => actors.count(), { timeout: 10_000 }).toBe(3);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '1' }),
    'y'
  );

  expect(await stopVerticalIntegrityMonitor(carousel)).toEqual([]);
});

test('continues a slow spring without relocating the visible slide', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await openStory(page, 'regression-motion--slow-recycling');
  await page.clock.pauseAt(new Date('2026-10-22T00:01:00Z'));
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');
  const secondCard = page.getByRole('heading', {
    includeHidden: true,
    name: '2',
  });

  await expect(actors).toHaveCount(3);
  await startHorizontalTeleportMonitor(carousel);
  await page.getByTestId('motion-next').click();
  await expect(page.getByTestId('motion-cursor')).toHaveText('1');
  await expect(actors).toHaveCount(3);
  await page.clock.runFor(100);

  const carouselBox = await carousel.boundingBox();
  const secondCardBox = await secondCard.boundingBox();
  if (!carouselBox || !secondCardBox) {
    throw new Error('Carousel or second card has no browser layout box');
  }
  expect(
    Math.abs(
      secondCardBox.x +
        secondCardBox.width / 2 -
        (carouselBox.x + carouselBox.width / 2)
    )
  ).toBeGreaterThan(20);

  await page.clock.runFor(3000);
  await expectCardCentered(carousel, secondCard, 'x');
  expect(await stopHorizontalTeleportMonitor(carousel)).toEqual([]);
});

test('reuses a fixed actor ring during a fast cursor burst', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await openStory(page, 'regression-motion--fast-recycling');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');

  await expect(actors).toHaveCount(3);
  await page.clock.pauseAt(new Date('2026-10-22T00:01:00Z'));
  await startHorizontalTeleportMonitor(carousel);
  // Audit recycling at a controlled cadence, independent of browser task stalls.
  for (let step = 0; step < 12; step += 1) {
    await page.getByTestId('motion-next').click();
    await page.clock.runFor(40);
  }
  await page.clock.runFor(200);
  await expect(page.getByTestId('motion-cursor')).toHaveText('12');
  await expect(actors).toHaveCount(3);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '1' }),
    'x'
  );

  expect(await stopHorizontalTeleportMonitor(carousel)).toEqual([]);
});

test('reverses rapid cursor updates without replacing visible content', async ({
  page,
}) => {
  await openStory(page, 'regression-motion--fast-recycling');
  const carousel = page.getByTestId('carousel');

  await startHorizontalTeleportMonitor(carousel);
  await clickRapidly(page, 'motion-next', 6, 20);
  await clickRapidly(page, 'motion-back', 4, 20);
  await expect(page.getByTestId('motion-cursor')).toHaveText('2');
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '3' }),
    'x'
  );
  await expect(carousel.locator(':scope > div')).toHaveCount(3);
  expect(await stopHorizontalTeleportMonitor(carousel)).toEqual([]);
});

test('animates dragging continuously and returns to the controlled cursor on release', async ({
  page,
}) => {
  await openStory(page, 'regression-motion--slow-recycling');
  const carousel = page.getByTestId('carousel');
  const actors = carousel.locator(':scope > div');
  const firstCard = page.getByRole('heading', {
    includeHidden: true,
    name: '1',
  });
  const box = await carousel.boundingBox();
  if (!box) {
    throw new Error('Carousel has no browser layout box');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await startHorizontalTeleportMonitor(carousel);
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, {
    steps: 8,
  });
  await expect
    .poll(async () => {
      const card = await firstCard.boundingBox();
      if (!card) throw new Error('The first card has no browser layout box');
      return card.x + card.width / 2 - (box.x + box.width / 2);
    })
    .toBeGreaterThan(4);
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, {
    steps: 4,
  });
  await expect(actors).toHaveCount(3);
  await page.mouse.up();
  await expect(page.getByTestId('motion-cursor')).toHaveText('0');
  await expectCardCentered(carousel, firstCard, 'x');
  expect(await stopHorizontalTeleportMonitor(carousel)).toEqual([]);
});

test('continues the transition from the finger release position', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-27T00:00:00Z') });
  await openStory(page, 'regression-feature-harness--basic');
  const carousel = page.getByTestId('carousel');
  const firstCard = page.getByRole('heading', {
    includeHidden: true,
    name: '1',
  });
  const box = await carousel.boundingBox();
  if (!box) {
    throw new Error('Carousel has no browser layout box');
  }

  await page.clock.pauseAt(new Date('2026-10-27T00:01:00Z'));
  await page.mouse.move(box.x + 700, box.y + 125);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 125, { steps: 8 });
  const beforeRelease = await firstCard.boundingBox();
  await page.mouse.up();
  const afterRelease = await firstCard.boundingBox();

  if (!beforeRelease || !afterRelease) {
    throw new Error('The first card has no browser layout box');
  }
  expect(Math.abs(afterRelease.x - beforeRelease.x)).toBeLessThan(100);
  await page.clock.runFor(2000);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '2' }),
    'x'
  );
});
