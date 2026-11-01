import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectAligned,
  openMotion,
  startIntegrityMonitor,
  stopIntegrityMonitor,
} from './helpers/motion.js';

type Axis = 'horizontal' | 'vertical';

async function openDrag(page: Page, axis: Axis, args = '') {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.clock.install({ time: new Date('2026-10-27T00:00:00Z') });
  await openMotion(
    page,
    axis === 'vertical' ? 'vertical-jumps' : 'spring',
    args
  );
  const carousel = page.getByTestId('carousel');
  // Leave room for genuine pointer capture beyond several viewport widths.
  await carousel.evaluate((root) => {
    Object.assign((root as HTMLElement).style, {
      width: '160px',
      height: '160px',
      marginLeft: '600px',
      marginTop: '700px',
    });
  });
  await expectAligned(page, 0, axis);
  await page.clock.pauseAt(new Date('2026-10-27T00:01:00Z'));
  return carousel;
}

async function position(carousel: Locator, axis: Axis, reference: number) {
  return carousel.evaluate(
    (root, { axis, reference }) => {
      const actor = [...root.children].find((element) =>
        element.querySelector('[data-item-index]')
      )!;
      const index = Number(
        actor
          .querySelector('[data-item-index]')!
          .getAttribute('data-item-index')
      );
      const absolute = index + Math.round((reference - index) / 500) * 500;
      const rect = actor.getBoundingClientRect();
      const viewport = root.getBoundingClientRect();
      return (
        absolute -
        (axis === 'horizontal'
          ? (rect.left - viewport.left) / rect.width
          : (rect.top - viewport.top) / rect.height)
      );
    },
    { axis, reference }
  );
}

async function expectPosition(
  carousel: Locator,
  axis: Axis,
  reference: number,
  expected: number
) {
  const pitch = await carousel
    .locator(':scope > div')
    .first()
    .evaluate(
      (actor, axis) =>
        actor.getBoundingClientRect()[
          axis === 'horizontal' ? 'width' : 'height'
        ],
      axis
    );
  const pixels = await carousel.evaluate(
    (root) => (root as HTMLElement & { __dragPixels: number }).__dragPixels
  );
  // Compare delivered pointer coordinates, allowing fractional carrier rounding.
  expect(Math.abs(pixels - (expected - reference) * pitch)).toBeLessThan(2);
  expect(
    Math.abs(
      ((await position(carousel, axis, reference)) - reference) * pitch - pixels
    )
  ).toBeLessThan(1);
}

async function grab(page: Page, carousel: Locator, axis: Axis) {
  const box = (await carousel.boundingBox())!;
  const pitch = await carousel
    .locator(':scope > div')
    .first()
    .evaluate(
      (actor, axis) =>
        actor.getBoundingClientRect()[
          axis === 'horizontal' ? 'width' : 'height'
        ],
      axis
    );
  const x = box.x + box.width * 0.85;
  const y = box.y + box.height * 0.85;
  await carousel.evaluate((root, axis) => {
    const target = root as HTMLElement & { __dragPixels: number };
    let origin = 0;
    target.addEventListener(
      'pointerdown',
      (event) => {
        origin = axis === 'horizontal' ? event.clientX : event.clientY;
      },
      { once: true }
    );
    const record = (event: PointerEvent) => {
      target.__dragPixels =
        origin - (axis === 'horizontal' ? event.clientX : event.clientY);
    };
    document.addEventListener('pointermove', record);
    document.addEventListener(
      'pointerup',
      () => document.removeEventListener('pointermove', record),
      { once: true }
    );
  }, axis);
  await page.mouse.move(x, y);
  await page.mouse.down();
  return async (slides: number) => {
    await page.mouse.move(
      axis === 'horizontal' ? x - slides * pitch : x,
      axis === 'vertical' ? y - slides * pitch : y
    );
    await page.clock.runFor(16);
  };
}

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const [lastDistance, releaseDistance, target] of [
    [0.2, 0.8, 1],
    [1.2, 1.8, 2],
  ]) {
    test(`${axis}: release at ${releaseDistance} slides uses a final coordinate missing from pointermove`, async ({
      page,
    }) => {
      const carousel = await openDrag(page, axis);
      const box = (await carousel.boundingBox())!;
      const pitch = await carousel
        .locator(':scope > div')
        .first()
        .evaluate(
          (actor, axis) =>
            actor.getBoundingClientRect()[
              axis === 'horizontal' ? 'width' : 'height'
            ],
          axis
        );
      await carousel.evaluate((root) =>
        (root as HTMLElement).addEventListener(
          'pointerdown',
          (event) =>
            Object.assign(root, { __releasePointerId: event.pointerId }),
          { once: true }
        )
      );
      const move = await grab(page, carousel, axis);
      await move(lastDistance);
      await page.clock.runFor(150);
      const pointerId = await carousel.evaluate(
        (root) =>
          (root as HTMLElement & { __releasePointerId: number })
            .__releasePointerId
      );
      await carousel.dispatchEvent('pointerup', {
        pointerId,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX:
          box.x +
          box.width * 0.85 -
          (axis === 'horizontal' ? pitch * releaseDistance : 0),
        clientY:
          box.y +
          box.height * 0.85 -
          (axis === 'vertical' ? pitch * releaseDistance : 0),
      });
      await page.mouse.up();
      await page.clock.runFor(2000);
      await expectAligned(page, target, axis);
    });
  }
  for (const visible of [1, 3]) {
    for (const step of [1, 2]) {
      test(`${axis} V=${visible} step=${step}: long drags track the pointer and snap by distance`, async ({
        page,
      }) => {
        const carousel = await openDrag(
          page,
          axis,
          `slidesPerView:${visible};slidesToScroll:${step};gap:16;${step === 2 ? 'motion:duration' : ''}`
        );
        await startIntegrityMonitor(carousel, axis, { uniqueContent: true });
        const actors = await carousel.locator(':scope > div').elementHandles();
        let cursor = 0;
        for (const [distance, delta] of step === 1
          ? [
              [2.2, 2],
              [2.8, 3],
              [-4.2, -4],
              [-2.8, -3],
            ]
          : [
              [4.2, 4],
              [5.2, 6],
              [-4.2, -4],
              [-5.2, -6],
            ]) {
          const move = await grab(page, carousel, axis);
          for (let i = 1; i <= 16; i++) await move((distance * i) / 16);
          await expect(page.getByTestId('cursor')).toHaveText(String(cursor));
          await expectPosition(carousel, axis, cursor, cursor + distance);
          await page.clock.runFor(150);
          await page.mouse.up();
          cursor += delta;
          await expect(page.getByTestId('cursor')).toHaveText(String(cursor));
          await page.clock.runFor(2000);
          await expectAligned(page, cursor, axis);
        }
        expect(await stopIntegrityMonitor(carousel)).toEqual([]);
        for (const actor of actors)
          expect(await actor.evaluate((element) => element.isConnected)).toBe(
            true
          );
        await expect(carousel.locator(':scope > div')).toHaveCount(visible * 3);
      });
    }
  }

  test(`${axis}: reversing a long drag chooses the reached slide`, async ({
    page,
  }) => {
    const carousel = await openDrag(page, axis);
    await startIntegrityMonitor(carousel, axis, { uniqueContent: true });
    const move = await grab(page, carousel, axis);
    for (const distance of [0.5, 1.5, 2.5, 3.5, 2.5, 1.5, 0.3])
      await move(distance);
    await expectPosition(carousel, axis, 0, 0.3);
    await page.mouse.up();
    await page.clock.runFor(2000);
    await expectAligned(page, 0, axis);
    expect(await stopIntegrityMonitor(carousel)).toEqual([]);
  });

  test(`${axis}: first/last jumps ignore dragging until settlement`, async ({
    page,
  }) => {
    const carousel = await openDrag(
      page,
      axis,
      'mode:finite;itemCount:6;slidesPerView:2;trimEnd:false;animation.type:duration;animation.duration:1000'
    );
    await startIntegrityMonitor(carousel, axis, {
      uniqueContent: true,
      allowEmptySpace: true,
    });
    for (const [button, target, distance] of [
      ['Last slide', 5, -0.7],
      ['First slide', 0, 0.7],
    ] as const) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.clock.runFor(200);
      const before = await position(carousel, axis, target);
      const move = await grab(page, carousel, axis);
      await move(distance);
      // Real input can advance an animation frame, but the opposing drag must
      // not reverse the compressed transition.
      const after = await position(carousel, axis, target);
      if (target === 0) expect(after).toBeLessThanOrEqual(before);
      else expect(after).toBeGreaterThanOrEqual(before);
      // Holding the pointer must not freeze the temporary outgoing screen.
      await page.clock.runFor(2000);
      await expectAligned(page, target, axis, 6);
      await move(distance * 2);
      await expectAligned(page, target, axis, 6);
      await page.mouse.up();

      // A fresh press can navigate as soon as the normal grid is restored.
      const drag = await grab(page, carousel, axis);
      await drag(distance);
      await page.clock.runFor(150);
      await page.mouse.up();
      await page.clock.runFor(2000);
      await expectAligned(page, target + Math.sign(distance), axis, 6);
    }
    expect(await stopIntegrityMonitor(carousel)).toEqual([]);
    await expect(carousel.locator(':scope > div')).toHaveCount(6);
  });

  test(`${axis}: a press spanning a compressed jump requires a fresh drag`, async ({
    page,
  }) => {
    const carousel = await openDrag(
      page,
      axis,
      'mode:finite;itemCount:6;slidesPerView:2;animation.type:duration;animation.duration:1000'
    );
    const move = await grab(page, carousel, axis);
    // Keep the real pointer pressed while the API starts the compressed jump.
    await page
      .getByRole('button', { name: 'Last slide', exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await move(-0.7);
    await page.clock.runFor(550);
    await expectAligned(page, 4, axis, 6);
    await move(-1.4);
    await expectAligned(page, 4, axis, 6);
    await page.mouse.up();

    const freshDrag = await grab(page, carousel, axis);
    await freshDrag(-0.7);
    await page.clock.runFor(150);
    await page.mouse.up();
    await page.clock.runFor(2000);
    await expectAligned(page, 3, axis, 6);
  });

  for (const animation of [
    'animation.type:spring;animation.mass:100;animation.friction:1',
    'animation.type:spring;animation.mass:1;animation.friction:0',
    'animation.type:duration;animation.duration:10000',
  ]) {
    test(`${axis}: compressed jumps leave the mixed screen within 500 ms with ${animation}`, async ({
      page,
    }) => {
      const carousel = await openDrag(
        page,
        axis,
        `mode:finite;itemCount:6;slidesPerView:2;${animation}`
      );
      await startIntegrityMonitor(carousel, axis, { uniqueContent: true });
      for (const [button, target] of [
        ['Last slide', 4],
        ['First slide', 0],
      ] as const) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await page.clock.runFor(550);
        await expectAligned(page, target, axis, 6);
        await expect(
          carousel.locator(':scope > [data-carousel-slide]:not([inert])')
        ).toHaveCount(2);
      }
      expect(await stopIntegrityMonitor(carousel)).toEqual([]);
      await expect(carousel.locator(':scope > div')).toHaveCount(6);

      // Ordinary movement still uses the configured long or undamped animation.
      await page
        .getByRole('button', { name: 'Next slide', exact: true })
        .click();
      await expect(page.getByTestId('cursor')).toHaveText('1');
      await page.clock.runFor(550);
      expect(Math.abs((await position(carousel, axis, 1)) - 1)).toBeGreaterThan(
        0.01
      );
    });
  }

  for (const mode of ['finite', 'loop', 'forward-loop']) {
    test(`${axis} ${mode}: edges resist dragging and allow reversal`, async ({
      page,
    }) => {
      const carousel = await openDrag(
        page,
        axis,
        `mode:${mode};slidesPerView:3;slidesToScroll:2`
      );
      const move = await grab(page, carousel, axis);
      for (let i = 1; i <= 12; i++) await move((-4.2 * i) / 12);
      const reached = await position(carousel, axis, 0);
      if (mode === 'loop') await expectPosition(carousel, axis, 0, -4.2);
      else {
        expect(reached).toBeGreaterThan(-0.5);
        expect(reached).toBeLessThan(0);
      }
      for (let i = 1; i <= 12; i++) await move(-4.2 + (4.8 * i) / 12);
      await expectPosition(carousel, axis, 0, 0.6);
      await page.clock.runFor(150);
      await page.mouse.up();
      await page.clock.runFor(2000);
      await expectAligned(page, 2, axis);
      if (mode === 'finite') {
        await page
          .getByRole('button', { name: 'Last slide', exact: true })
          .evaluate((button: HTMLButtonElement) => button.click());
        await page.clock.runFor(2000);
        await expectAligned(page, 497, axis);
        const move = await grab(page, carousel, axis);
        await move(2.8);
        const end = await position(carousel, axis, 497);
        expect(end).toBeGreaterThan(497);
        expect(end).toBeLessThan(497.5);
        await page.mouse.up();
        await page.clock.runFor(2000);
        await expectAligned(page, 497, axis);
      }
    });
  }

  for (const animation of ['zero', 'reduced']) {
    test(`${axis}: ${animation} motion preserves distance-based snapping`, async ({
      page,
    }) => {
      if (animation === 'reduced')
        await page.emulateMedia({ reducedMotion: 'reduce' });
      const carousel = await openDrag(
        page,
        axis,
        animation === 'zero'
          ? 'animation.type:duration;animation.duration:0'
          : ''
      );
      const move = await grab(page, carousel, axis);
      await move(2.2);
      await expectPosition(carousel, axis, 0, 2.2);
      await expect(page.getByTestId('cursor')).toHaveText('0');
      await page.clock.runFor(150);
      await page.mouse.up();
      await expectAligned(page, 2, axis);
    });
  }
}

test('a recent flick biases the nearest stop; a paused finger has no bias', async ({
  page,
}) => {
  const carousel = await openDrag(page, 'horizontal');
  for (const paused of [true, false]) {
    const move = await grab(page, carousel, 'horizontal');
    const cursor = paused ? 0 : 2;
    for (let i = 1; i <= 12; i++) await move((2.4 * i) / 12);
    if (paused) await page.clock.runFor(150);
    await page.mouse.up();
    await page.clock.runFor(2000);
    await expectAligned(page, cursor + (paused ? 2 : 3));
  }
});
