import { expect, test, type Locator } from '@playwright/test';
import { openStory } from './helpers/story.js';
import {
  startIntegrityMonitor,
  stopIntegrityMonitor,
} from './helpers/motion.js';

async function geometry(
  root: Locator,
  axis: 'horizontal' | 'vertical',
  item: number
) {
  return root.evaluate(
    (element, { axis, item }) => {
      const viewport = element.getBoundingClientRect();
      const cards = Array.from(
        element.querySelectorAll<HTMLElement>('[data-item-index]')
      );
      const visible = cards.filter((card) => {
        const box = card.getBoundingClientRect();
        return axis === 'horizontal'
          ? box.right > viewport.left + 0.5 && box.left < viewport.right - 0.5
          : box.bottom > viewport.top + 0.5 && box.top < viewport.bottom - 0.5;
      });
      const card = visible.find(
        (card) => Number(card.dataset.itemIndex) === item
      );
      if (!card) return null;
      const box = card.getBoundingClientRect();
      const start =
        axis === 'horizontal'
          ? box.left - viewport.left
          : box.top - viewport.top;
      const size = axis === 'horizontal' ? box.width : box.height;
      const extent = axis === 'horizontal' ? viewport.width : viewport.height;
      return {
        start,
        size,
        extent,
        center: start + size / 2,
        visible: visible.length,
        actors: element.children.length,
      };
    },
    { axis, item }
  );
}

const openLayout = (page: Parameters<typeof openStory>[0], args = '') =>
  openStory(page, 'regression-layouts--geometry', args);

test.describe('layout geometry', () => {
  test.skip(({ isMobile }) => isMobile);
  for (const axis of ['horizontal', 'vertical'] as const) {
    for (const capacity of [1.2, 2.5]) {
      for (const mode of ['finite', 'loop', 'forward-loop']) {
        test(`${axis} ${mode} capacity=${capacity}: centered geometry and interactive previews`, async ({
          page,
        }) => {
          const root = await openLayout(
            page,
            `axis:${axis};mode:${mode};slidesPerView:${capacity}`
          );
          const result = (await geometry(root, axis, 3))!;
          expect(result.size).toBeCloseTo(
            (result.extent - 48 - (capacity - 1) * 16) / capacity,
            1
          );
          expect(result.center).toBeCloseTo(result.extent / 2, 0);
          expect(result.visible).toBeGreaterThan(1);
          const cards = root.locator(
            '[data-carousel-slide]:not([inert]) [data-item-index]'
          );
          await expect(cards).toHaveCount(result.visible);
          await expect(
            cards.filter({
              has: page.getByRole('button', { name: 'Action 3', exact: true }),
            })
          ).toHaveCount(1);
          await page.getByRole('button', { name: 'Last', exact: true }).click();
          await expect(page.getByTestId('cursor')).toHaveText('7');
          expect((await geometry(root, axis, 7))!.center).toBeCloseTo(
            result.extent / 2,
            1
          );
          await page
            .getByRole('button', { name: 'First', exact: true })
            .click();
          expect((await geometry(root, axis, 0))!.center).toBeCloseTo(
            result.extent / 2,
            1
          );
        });
      }
    }
    test(`${axis}: borders and subpixel viewport dimensions preserve sizing and alignment`, async ({
      page,
    }) => {
      const root = await openLayout(
        page,
        `axis:${axis};slidesPerView:2.5;decorated:true`
      );
      const metrics = await root.evaluate((element, axis) => {
        const root = element as HTMLElement;
        const viewport = root.getBoundingClientRect();
        const style = getComputedStyle(root);
        const borderStart = parseFloat(
          axis === 'horizontal' ? style.borderLeftWidth : style.borderTopWidth
        );
        const borderEnd = parseFloat(
          axis === 'horizontal'
            ? style.borderRightWidth
            : style.borderBottomWidth
        );
        const start =
          (axis === 'horizontal' ? viewport.left : viewport.top) + borderStart;
        const extent =
          (axis === 'horizontal' ? viewport.width : viewport.height) -
          borderStart -
          borderEnd;
        const card = root
          .querySelector('[data-item-index="3"]')!
          .getBoundingClientRect();
        const cardStart =
          (axis === 'horizontal' ? card.left : card.top) - start;
        const size = axis === 'horizontal' ? card.width : card.height;
        return { extent, size, borderStart, center: cardStart + size / 2 };
      }, axis);
      expect(metrics.borderStart).toBe(12);
      expect(metrics.size).toBeCloseTo(
        (metrics.extent - 48 - 1.5 * 16) / 2.5,
        1
      );
      expect(metrics.center).toBeCloseTo(metrics.extent / 2, 1);
    });

    test(`${axis}: content sizing fits bordered viewports and padding changes`, async ({
      page,
    }) => {
      const root = await openLayout(
        page,
        `axis:${axis};crossAxisSize:content;decorated:true`
      );
      const fits = () =>
        root.evaluate((element, axis) => {
          const viewport = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const start = axis === 'horizontal' ? 'top' : 'left';
          const end = axis === 'horizontal' ? 'bottom' : 'right';
          const contentStart =
            viewport[start] +
            parseFloat(style.getPropertyValue(`border-${start}-width`)) +
            parseFloat(style.getPropertyValue(`padding-${start}`));
          const contentEnd =
            viewport[end] -
            parseFloat(style.getPropertyValue(`border-${end}-width`)) -
            parseFloat(style.getPropertyValue(`padding-${end}`));
          const card = element
            .querySelector('[data-item-index="4"]')!
            .getBoundingClientRect();
          return (
            card[start] >= contentStart - 0.5 && card[end] <= contentEnd + 0.5
          );
        }, axis);
      await expect.poll(fits).toBe(true);
      await root.evaluate((element) => {
        (element as HTMLElement).style.padding = '12px';
      });
      await expect.poll(fits).toBe(true);
    });

    test(`${axis}: collapse cancels dragging and restoration accepts only a fresh gesture`, async ({
      page,
    }) => {
      const root = await openLayout(page, `axis:${axis}`);
      const box = (await root.boundingBox())!;
      const x = box.x + box.width * 0.8,
        y = box.y + box.height * 0.8;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        axis === 'horizontal' ? x - 40 : x,
        axis === 'vertical' ? y - 40 : y,
        { steps: 4 }
      );
      await expect(page.getByTestId('moving')).toHaveText('true');
      await root.evaluate((element, axis) => {
        (element as HTMLElement).style[
          axis === 'horizontal' ? 'width' : 'height'
        ] = '40px';
      }, axis);
      await expect(page.getByTestId('ready')).toHaveText('false');
      await expect(page.getByTestId('moving')).toHaveText('false');
      await root.evaluate((element, axis) => {
        (element as HTMLElement).style[
          axis === 'horizontal' ? 'width' : 'height'
        ] = axis === 'horizontal' ? '600px' : '320px';
      }, axis);
      await expect(page.getByTestId('ready')).toHaveText('true');
      await page.mouse.move(
        axis === 'horizontal' ? x - 150 : x,
        axis === 'vertical' ? y - 150 : y
      );
      await page.mouse.up();
      await expect(page.getByTestId('cursor')).toHaveText('3');
      await page.mouse.move(x, y);
      await page.mouse.down();
      const distance =
        (((axis === 'horizontal' ? box.width : box.height) - 48 + 16) / 1.2) *
        0.7;
      await page.mouse.move(
        axis === 'horizontal' ? x - distance : x,
        axis === 'vertical' ? y - distance : y,
        { steps: 8 }
      );
      await page.mouse.up();
      await expect(page.getByTestId('cursor')).toHaveText('4');
    });

    test(`${axis}: unusable insets leave navigation and page scrolling available`, async ({
      page,
    }) => {
      await page.goto(
        `/iframe.html?id=regression-layouts--geometry&viewMode=story&args=${encodeURIComponent(`axis:${axis};defaultIndex:0;insetStart:400;insetEnd:400`)}`
      );
      const root = page.getByTestId('carousel');
      await expect(page.getByTestId('ready')).toHaveText('false');
      const box = (await root.boundingBox())!;
      const x = box.x + box.width * 0.8,
        y = box.y + box.height * 0.8;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        axis === 'horizontal' ? x - 100 : x,
        axis === 'vertical' ? y - 100 : y,
        { steps: 8 }
      );
      await page.mouse.up();
      await expect(page.getByTestId('cursor')).toHaveText('0');
      await expect(page.getByTestId('navigate')).toBeEmpty();
      await expect(root).toHaveCSS('touch-action', 'auto');
    });

    test(`${axis}: dragging fractional centered slides follows the pointer and snaps`, async ({
      page,
    }) => {
      const root = await openLayout(page, `axis:${axis}`);
      const box = (await root.boundingBox())!;
      const initial = (await geometry(root, axis, 3))!;
      const x = box.x + box.width * 0.7,
        y = box.y + box.height * 0.7;
      const distance = (initial.size + 16) * 0.8;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        axis === 'horizontal' ? x - distance : x,
        axis === 'vertical' ? y - distance : y,
        { steps: 8 }
      );
      const during = (await geometry(root, axis, 3))!;
      expect(
        Math.abs(during.center - (initial.center - distance))
      ).toBeLessThan(1);
      await page.mouse.up();
      await expect(page.getByTestId('cursor')).toHaveText('4');
      expect((await geometry(root, axis, 4))!.center).toBeCloseTo(
        initial.extent / 2,
        0
      );
    });

    test(`${axis}: a compressed jump settles at a fractional end without replacing a visible preview`, async ({
      page,
    }) => {
      await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
      const root = await openLayout(
        page,
        `axis:${axis};defaultIndex:0;snapAlign:start;slidesPerView:2.5;animation.type:duration;animation.duration:1000`
      );
      await page.clock.pauseAt(new Date('2026-10-29T00:01:00Z'));
      await startIntegrityMonitor(root, axis, {
        uniqueContent: true,
        allowEmptySpace: true,
      });
      await page.getByRole('button', { name: 'Last', exact: true }).click();
      await page.clock.runFor(1200);
      await expect(page.getByTestId('cursor')).toHaveText('6');
      await expect(page.getByTestId('moving')).toHaveText('false');
      expect(await stopIntegrityMonitor(root)).toEqual([]);
      const last = (await geometry(root, axis, 7))!;
      expect(last.start + last.size).toBeCloseTo(last.extent - 24, 0);
    });

    test(`${axis}: responsive changes cancel motion and recenter the requested anchor`, async ({
      page,
    }) => {
      await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
      const root = await openLayout(
        page,
        `axis:${axis};responsive:true;animation.type:duration;animation.duration:1000`
      );
      await page.clock.pauseAt(new Date('2026-10-29T00:01:00Z'));
      await page.getByRole('button', { name: 'Last', exact: true }).click();
      await expect(page.getByTestId('moving')).toHaveText('true');
      await page.clock.runFor(200);
      await page.getByRole('button', { name: 'Resize', exact: true }).click();
      await page.clock.runFor(50);
      await expect(page.getByTestId('capacity')).toHaveText('1.2');
      await expect(page.getByTestId('moving')).toHaveText('false');
      await expect(page.getByTestId('cursor')).toHaveText('7');
      const result = (await geometry(root, axis, 7))!;
      expect(result.center).toBeCloseTo(result.extent / 2, 0);
    });

    test(`${axis}: short outward swipes at fractional ends report blocked navigation`, async ({
      page,
    }) => {
      const root = await openLayout(
        page,
        `axis:${axis};snapAlign:start;slidesPerView:2.5`
      );
      await page.getByRole('button', { name: 'Last', exact: true }).click();
      const box = (await root.boundingBox())!;
      const x = box.x + box.width * 0.7,
        y = box.y + box.height * 0.7;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        axis === 'horizontal' ? x - 40 : x,
        axis === 'vertical' ? y - 40 : y,
        { steps: 4 }
      );
      await page.mouse.up();
      await expect(page.getByTestId('cursor')).toHaveText('6');
      await expect(page.getByTestId('navigate')).toHaveText(
        JSON.stringify({ direction: 'next', source: 'drag', blocked: true })
      );
    });

    for (const capacity of [2.5, 3.8]) {
      test(`${axis} capacity=${capacity}: interrupting the final step reverses by one slide`, async ({
        page,
      }) => {
        const last = Math.ceil(8 - capacity);
        await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
        const root = await openLayout(
          page,
          `axis:${axis};defaultIndex:${last - 1};snapAlign:start;slidesPerView:${capacity};animation.type:duration;animation.duration:1000`
        );
        await page.clock.pauseAt(new Date('2026-10-29T00:01:00Z'));
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.clock.runFor(900);
        const box = (await root.boundingBox())!;
        const x = box.x + box.width * 0.5,
          y = box.y + box.height * 0.5;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(
          axis === 'horizontal' ? x + 40 : x,
          axis === 'vertical' ? y + 40 : y,
          { steps: 4 }
        );
        await page.mouse.up();
        await expect(page.getByTestId('cursor')).toHaveText(String(last - 1));
        await page.clock.runFor(1200);
        expect((await geometry(root, axis, last - 1))!.start).toBeCloseTo(
          24,
          1
        );
      });
    }

    test(`${axis}: fractional trimmed final viewport keeps integer indexes`, async ({
      page,
    }) => {
      const root = await openLayout(
        page,
        `axis:${axis};snapAlign:start;slidesPerView:2.5;insetStart:20;insetEnd:40`
      );
      await page.getByRole('button', { name: 'Last', exact: true }).click();
      await expect(page.getByTestId('cursor')).toHaveText('6');
      const last = (await geometry(root, axis, 7))!;
      expect(last.start + last.size).toBeCloseTo(last.extent - 40, 0);
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await expect(page.getByTestId('cursor')).toHaveText('5');
    });
    test(`${axis}: asymmetric insets center within the inner alignment area`, async ({
      page,
    }) => {
      const root = await openLayout(
        page,
        `axis:${axis};insetStart:40;insetEnd:80`
      );
      const result = (await geometry(root, axis, 3))!;
      expect(result.center).toBeCloseTo(40 + (result.extent - 120) / 2, 0);
    });
  }

  test('explicitly sized hidden carousels become ready only after showing', async ({
    page,
  }) => {
    await page.goto(
      '/iframe.html?id=regression-layouts--geometry&viewMode=story&args=decorated:true;initiallyHidden:true'
    );
    const root = page.getByTestId('carousel');
    await expect(root).toBeHidden();
    await expect(page.getByTestId('ready')).toHaveText('false');
    await expect(
      page.getByRole('button', { name: 'Next', exact: true })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Last', exact: true }).click();
    await expect(page.getByTestId('cursor')).toHaveText('3');
    await page
      .getByRole('button', { name: 'Toggle visibility', exact: true })
      .click();
    await expect(page.getByTestId('ready')).toHaveText('true');
    await expect(
      root.getByRole('button', { name: 'Action 3', exact: true })
    ).toBeVisible();
  });

  test('external padding changes resize content-box viewports', async ({
    page,
  }) => {
    const root = await openLayout(page, 'decorated:true;slidesPerView:2.5');
    const carrier = root.locator('[data-carousel-slide]').first();
    await root.evaluate((element) => {
      (element as HTMLElement).style.boxSizing = 'content-box';
    });
    await expect
      .poll(async () =>
        parseFloat(
          await carrier.evaluate(
            (element) => (element as HTMLElement).style.width
          )
        )
      )
      .toBeCloseTo((599.6 - 48 + 16) / 2.5, 1);
    await root.evaluate((element) => {
      (element as HTMLElement).style.padding = '12px';
    });
    await expect
      .poll(async () =>
        parseFloat(
          await carrier.evaluate(
            (element) => (element as HTMLElement).style.width
          )
        )
      )
      .toBeCloseTo((599.6 + 24 - 48 + 16) / 2.5, 1);
  });

  test('content sizing includes tall partial previews and excludes hidden buffers', async ({
    page,
  }) => {
    const root = await openLayout(page, 'crossAxisSize:content');
    await expect(root).toHaveCSS('height', '220px');
    await page.getByRole('button', { name: 'First', exact: true }).click();
    await expect(root).toHaveCSS('height', '120px');
    await page.getByRole('button', { name: 'Last', exact: true }).click();
    await expect(root).toHaveCSS('height', '120px');
  });

  test('responsive layouts retain focus on visible previews and restore it when they leave', async ({
    page,
  }) => {
    const root = await openLayout(page, 'responsive:true;slidesPerView:1.2');
    const result = (await geometry(root, 'horizontal', 3))!;
    expect(result.center).toBeCloseTo(60 + (result.extent - 80) / 2, 0);
    await page.getByRole('button', { name: 'Resize', exact: true }).click();
    await expect(page.getByTestId('capacity')).toHaveText('1.2');
    await expect(page.getByTestId('cursor')).toHaveText('3');
    expect((await geometry(root, 'horizontal', 3))!.center).toBeCloseTo(180, 0);
    await root.getByRole('button', { name: 'Action 3', exact: true }).focus();
    await page
      .getByRole('button', { name: 'Previous', exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByTestId('cursor')).toHaveText('2');
    await expect(
      root.getByRole('button', { name: 'Action 3', exact: true })
    ).toBeFocused();
    await page
      .getByRole('button', { name: 'First', exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(root).toBeFocused();
  });

  test('large jumps and interrupted reversals retain previews and a bounded pool', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
    const root = await openLayout(
      page,
      'itemCount:10000;mode:loop;animation.type:duration;animation.duration:1000;slidesPerView:2.5'
    );
    const before = (await geometry(root, 'horizontal', 3))!.actors;
    await startIntegrityMonitor(root, 'horizontal', { uniqueContent: true });
    await page.clock.pauseAt(new Date('2026-10-29T00:01:00Z'));
    await page.getByRole('button', { name: 'Large jump', exact: true }).click();
    await page.clock.runFor(200);
    const visible = await root
      .locator('[data-item-index]')
      .evaluateAll((cards) => {
        const viewport = cards[0]
          .closest('[data-testid="carousel"]')!
          .getBoundingClientRect();
        return cards
          .filter((card) => {
            const box = card.getBoundingClientRect();
            return box.right > viewport.left && box.left < viewport.right;
          })
          .map((card) => ({
            node: card.getAttribute('data-item-index'),
            left: card.getBoundingClientRect().left,
          }));
      });
    await page
      .getByRole('button', { name: 'Reverse jump', exact: true })
      .click();
    for (const card of visible) {
      const matching = root.locator(`[data-item-index="${card.node}"]`);
      expect(
        await matching.evaluateAll(
          (nodes, left) =>
            nodes.some(
              (node) => Math.abs(node.getBoundingClientRect().left - left) < 1
            ),
          card.left
        )
      ).toBe(true);
    }
    await page.clock.runFor(1500);
    await expect(page.getByTestId('cursor')).toHaveText('-1000000');
    await expect(page.getByTestId('moving')).toHaveText('false');
    await expect(root.locator(':scope > [data-carousel-slide]')).toHaveCount(
      before
    );
    expect((await geometry(root, 'horizontal', 0))!.center).toBeCloseTo(300, 0);
    expect(await stopIntegrityMonitor(root)).toEqual([]);
  });
});

test('touch swipes select the next centered slide', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  const root = await openLayout(page);
  const box = (await root.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const x = box.x + box.width * 0.8,
    y = box.y + box.height / 2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step++)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - (box.width * 0.6 * step) / 8, y }],
    });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByTestId('cursor')).toHaveText('4');
  expect((await geometry(root, 'horizontal', 4))!.center).toBeCloseTo(
    box.width / 2,
    1
  );
});
