import { expect, test, type Locator, type Page } from '@playwright/test';
import { openStory } from './helpers/story.js';

const open = (page: Page, args = '') =>
  openStory(page, 'regression-input--free', args);
const stopped = (page: Page) =>
  expect(page.getByTestId('moving')).toHaveText('false');
const position = (root: Locator, vertical = false) =>
  root.evaluate((element, vertical) => {
    const card = element.querySelector<HTMLElement>('[data-input-index]')!;
    const actor = card
      .closest('[data-carousel-slide]')!
      .getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const local = Number(card.dataset.inputIndex);
    const cursor = Number(
      document.querySelector('[data-testid="cursor"]')!.textContent
    );
    const global = local + Math.round((cursor - local) / 1000) * 1000;
    return (
      global +
      (vertical
        ? (box.top - actor.top) / actor.height
        : (box.left - actor.left) / actor.width)
    );
  }, vertical);

for (const reduced of [false, true]) {
  for (const vertical of [false, true]) {
    test(`free ${vertical ? 'vertical' : 'horizontal'} keyboard focus reveals clipped controls without native scrolling${reduced ? ' with reduced motion' : ''}`, async ({
      page,
    }) => {
      if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      const root = await open(
        page,
        `focusEdges:true;axis:${vertical ? 'vertical' : 'horizontal'}`
      );
      const box = (await root.boundingBox())!;
      await root.dispatchEvent('wheel', {
        deltaX: vertical ? 0 : box.width * 0.7,
        deltaY: vertical ? box.height * 0.7 : 0,
        cancelable: true,
      });
      await stopped(page);
      await root
        .getByRole('button', { name: 'Open item 1', exact: true })
        .focus();
      await page.keyboard.press('Tab');
      const field = root.getByRole('spinbutton', {
        name: 'Quantity 1',
        exact: true,
      });
      await expect(field).toBeFocused();
      await expect
        .poll(async () => Math.abs((await position(root, vertical)) - 1))
        .toBeLessThan(0.01);
      await stopped(page);
      await expect(field).toBeFocused();
      expect(
        await root.evaluate((node) => [node.scrollLeft, node.scrollTop])
      ).toEqual([0, 0]);
      const inputBox = (await field.boundingBox())!;
      const viewport = (await root.boundingBox())!;
      expect(inputBox.x).toBeGreaterThanOrEqual(viewport.x);
      expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(
        viewport.x + viewport.width
      );
      expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(
        viewport.y + viewport.height
      );
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect
        .poll(async () => Math.abs((await position(root, vertical)) - 2))
        .toBeLessThan(0.01);
      expect(
        await root.evaluate((node) => [node.scrollLeft, node.scrollTop])
      ).toEqual([0, 0]);
    });
  }
}

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const dragMode of ['snap', 'free', 'free-snap']) {
    test(`${axis} ${dragMode}: keyboard focus reveals a control in a partial preview`, async ({
      page,
    }) => {
      const root = await open(
        page,
        `focusEdges:true;axis:${axis};dragMode:${dragMode};snapAlign:center;slidesPerView:1.5`
      );
      const field = root.getByRole('spinbutton', {
        name: 'Quantity 1',
        exact: true,
      });
      await field.focus();
      await expect(page.getByTestId('cursor')).toHaveText('1');
      await stopped(page);
      await expect(field).toBeFocused();
      const viewport = (await root.boundingBox())!;
      const box = (await field.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(viewport.x - 0.5);
      expect(box.y).toBeGreaterThanOrEqual(viewport.y - 0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(
        viewport.x + viewport.width + 0.5
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        viewport.y + viewport.height + 0.5
      );
      expect(
        await root.evaluate((node) => [node.scrollLeft, node.scrollTop])
      ).toEqual([0, 0]);
    });
  }
}

test('focus alignment does not steal focus after it leaves the carousel', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const root = await open(page, 'focusEdges:true');
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.7, cancelable: true });
  await page.clock.runFor(150);
  await stopped(page);
  await root.getByRole('button', { name: 'Open item 1', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('moving')).toHaveText('true');
  await expect(
    root.getByRole('spinbutton', { name: 'Quantity 1', exact: true })
  ).toBeFocused();
  const after = page.getByRole('textbox', {
    name: 'After carousel',
    exact: true,
  });
  await after.focus();
  await expect(after).toBeFocused();
  await page.clock.runFor(500);
  await stopped(page);
  await expect(after).toBeFocused();
  expect(Math.abs((await position(root)) - 1)).toBeLessThan(0.01);
});

test('nested wheel routing prefers the inner carousel regardless of enablement order and chains at its end', async ({
  page,
}) => {
  const inner = await openStory(page, 'regression-input--nested-wheel');
  const outer = page.getByTestId('outer-carousel');
  const outerPosition = () =>
    outer.evaluate((root) => {
      const card = root.querySelector<HTMLElement>('[data-outer-index]')!;
      const actor = card
        .closest('[data-carousel-slide]')!
        .getBoundingClientRect();
      return (
        Number(card.dataset.outerIndex) +
        (root.getBoundingClientRect().left - actor.left) / actor.width
      );
    });
  await page
    .getByRole('button', { name: 'Toggle inner wheel', exact: true })
    .click();
  const width = (await inner.boundingBox())!.width;
  await inner.dispatchEvent('wheel', { deltaX: width * 0.3, cancelable: true });
  await stopped(page);
  expect(Math.abs((await position(inner)) - 0.3)).toBeLessThan(0.01);
  expect(Math.abs(await outerPosition())).toBeLessThan(0.01);
  await inner.dispatchEvent('wheel', { deltaX: 10000, cancelable: true });
  await stopped(page);
  expect(Math.abs((await position(inner)) - 2)).toBeLessThan(0.01);
  const outerWidth = (await outer.boundingBox())!.width;
  await inner.dispatchEvent('wheel', {
    deltaX: outerWidth * 0.25,
    cancelable: true,
  });
  await stopped(page);
  expect(Math.abs((await outerPosition()) - 0.25)).toBeLessThan(0.01);
  expect(Math.abs((await position(inner)) - 2)).toBeLessThan(0.01);
});

test('input enablement toggles preserve a stationary fractional free position', async ({
  page,
}) => {
  const root = await open(page);
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.25, cancelable: true });
  await stopped(page);
  for (const control of [
    'Toggle wheel',
    'Toggle wheel',
    'Toggle dragging',
    'Toggle dragging',
  ]) {
    await page.getByRole('button', { name: control, exact: true }).click();
    expect(Math.abs((await position(root)) - 0.25)).toBeLessThan(0.01);
    await expect(page.getByTestId('cursor')).toHaveText('0');
  }
});

test('disabling wheel during a free stream preserves the reached point and cancels its timer', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const root = await open(page);
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.7, cancelable: true });
  await page.getByRole('button', { name: 'Toggle wheel', exact: true }).click();
  await stopped(page);
  expect(Math.abs((await position(root)) - 0.7)).toBeLessThan(0.01);
  await page.clock.runFor(500);
  expect(Math.abs((await position(root)) - 0.7)).toBeLessThan(0.01);
  await expect(page.getByTestId('cursor')).toHaveText('1');
});

test('disabling dragging while a pointer is held preserves its free position', async ({
  page,
}) => {
  const root = await open(page);
  const box = (await root.boundingBox())!;
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.85;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width * 0.7, y, { steps: 8 });
  await page
    .getByRole('button', { name: 'Toggle dragging', exact: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await stopped(page);
  expect(Math.abs((await position(root)) - 0.7)).toBeLessThan(0.01);
  await expect(page.getByTestId('cursor')).toHaveText('1');
  await page.mouse.move(x - box.width * 0.75, y);
  await page.mouse.up();
  expect(Math.abs((await position(root)) - 0.7)).toBeLessThan(0.01);
});

test('dragging enablement does not interrupt an active wheel stream', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const root = await open(page);
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.3, cancelable: true });
  await page
    .getByRole('button', { name: 'Toggle dragging', exact: true })
    .click();
  expect(Math.abs((await position(root)) - 0.3)).toBeLessThan(0.01);
  await expect(page.getByTestId('moving')).toHaveText('true');
  await root.dispatchEvent('wheel', { deltaX: width * 0.4, cancelable: true });
  expect(Math.abs((await position(root)) - 0.7)).toBeLessThan(0.01);
  await page.clock.runFor(500);
  await stopped(page);
  expect(Math.abs((await position(root)) - 0.7)).toBeLessThan(0.01);
  await expect(page.getByTestId('cursor')).toHaveText('1');
});

async function drag(
  page: Page,
  root: Locator,
  fraction: number,
  pause = true,
  vertical = false
) {
  const box = (await root.boundingBox())!;
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.85;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x - (vertical ? 0 : box.width * fraction),
    y - (vertical ? box.height * fraction : 0),
    { steps: 8 }
  );
  if (pause) await page.waitForTimeout(150);
  await page.mouse.up();
}

async function hover(page: Page, root: Locator) {
  const box = (await root.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.85);
}

for (const vertical of [false, true]) {
  test(`${vertical ? 'vertical' : 'horizontal'} free dragging stops between slides and API navigation still aligns`, async ({
    page,
  }) => {
    const root = await open(
      page,
      `axis:${vertical ? 'vertical' : 'horizontal'}`
    );
    await drag(page, root, 0.25, true, vertical);
    await stopped(page);
    expect(Math.abs((await position(root, vertical)) - 0.25)).toBeLessThan(
      0.015
    );
    await expect(page.getByTestId('cursor')).toHaveText('0');
    await expect(
      page.getByRole('button', { name: 'Previous', exact: true })
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Current page', exact: true })
    ).not.toHaveAttribute('aria-disabled', 'true');
    await page
      .getByRole('button', { name: 'Current page', exact: true })
      .click();
    await expect
      .poll(async () => Math.abs(await position(root, vertical)))
      .toBeLessThan(0.01);
    await drag(page, root, 0.3, true, vertical);
    await stopped(page);
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect
      .poll(async () => Math.abs(await position(root, vertical)))
      .toBeLessThan(0.01);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect
      .poll(async () => Math.abs((await position(root, vertical)) - 1))
      .toBeLessThan(0.01);
  });
}

test('a free fling coasts, can be caught, and keeps the rendering pool bounded', async ({
  page,
}) => {
  const root = await open(page, 'mode:loop;slidesPerView:3');
  const box = (await root.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + 210);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + 210, { steps: 4 });
  const release = await position(root);
  await page.mouse.up();
  await expect
    .poll(() => position(root), { intervals: [16] })
    .toBeGreaterThan(release + 0.1);
  await page.mouse.move(box.x + box.width * 0.7, box.y + 210);
  await page.mouse.down();
  const caught = await position(root);
  await page.waitForTimeout(150);
  expect(Math.abs((await position(root)) - caught)).toBeLessThan(0.02);
  await page.mouse.move(box.x + box.width * 0.68, box.y + 210);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await stopped(page);
  expect(await position(root)).toBeGreaterThan(caught - 0.1);
  await expect(root.locator(':scope > [data-carousel-slide]')).toHaveCount(9);
  await expect(root.locator('[data-input-index]')).toHaveCount(9);
});

test('loop free motion crosses zero and retains its fractional rest after rebasing', async ({
  page,
}) => {
  const root = await open(page, 'mode:loop');
  await drag(page, root, -0.7);
  await stopped(page);
  await expect(page.getByTestId('cursor')).toHaveText('-1');
  expect(Math.abs((await position(root)) + 0.7)).toBeLessThan(0.015);
  const before = await position(root);
  await page.waitForTimeout(200);
  expect(Math.abs((await position(root)) - before)).toBeLessThan(0.005);
});

test('controlled free movement respects a rejected logical selection', async ({
  page,
}) => {
  const root = await open(page, 'controlled:true;accept:false');
  await drag(page, root, 0.7);
  await expect
    .poll(async () => Math.abs(await position(root)))
    .toBeLessThan(0.01);
  await expect(page.getByTestId('cursor')).toHaveText('0');
});

test('free wheel input follows pixels without adding a second momentum animation', async ({
  page,
}) => {
  const root = await open(page);
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.8, cancelable: true });
  await expect.poll(() => position(root)).toBeGreaterThan(0.7);
  await stopped(page);
  const rest = await position(root);
  expect(Math.abs(rest - 0.8)).toBeLessThan(0.02);
  await expect(page.getByTestId('reason')).toHaveText('wheel');
  await expect(page.getByTestId('source')).toHaveText('wheel');
  await page.waitForTimeout(200);
  expect(Math.abs((await position(root)) - rest)).toBeLessThan(0.005);
  await page
    .getByRole('button', { name: 'Select current', exact: true })
    .click();
  await expect
    .poll(async () => Math.abs((await position(root)) - 1))
    .toBeLessThan(0.01);
});

test('horizontal wheel support preserves vertical page scrolling and ignores zoom gestures', async ({
  page,
}) => {
  const root = await open(page);
  await hover(page, root);
  await page.mouse.wheel(0, 180);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  expect(Math.abs(await position(root))).toBeLessThan(0.005);
  const consumed = await root.evaluate(
    (node) =>
      !node.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: 100,
          ctrlKey: true,
        })
      )
  );
  expect(consumed).toBe(false);
  expect(Math.abs(await position(root))).toBeLessThan(0.005);
});

test('wheel input is opt-in, independent of pointer dragging, and normalizes line/page deltas', async ({
  page,
}) => {
  const root = await open(page, 'wheel:false;drag:false');
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: 40, cancelable: true });
  expect(Math.abs(await position(root))).toBeLessThan(0.005);
  await page.getByRole('button', { name: 'Toggle wheel' }).click();
  const line = await root.evaluate(
    (node) =>
      !node.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: 3,
          deltaMode: 1,
        })
      )
  );
  expect(line).toBe(true);
  expect(Math.abs((await position(root)) - 48 / width)).toBeLessThan(0.015);
  await root.dispatchEvent('wheel', {
    deltaX: 0.2,
    deltaMode: 2,
    cancelable: true,
  });
  expect(Math.abs((await position(root)) - (48 / width + 0.2))).toBeLessThan(
    0.015
  );
  await stopped(page);
});

test('free input reports physical boundary attempts without treating fractional moves as blocked', async ({
  page,
}) => {
  const root = await open(page);
  await drag(page, root, -0.25);
  await stopped(page);
  await expect(page.getByTestId('blocked')).toHaveText('true');
  await drag(page, root, 0.25);
  await stopped(page);
  await expect(page.getByTestId('blocked')).toHaveText('false');
  await expect(page.getByTestId('cursor')).toHaveText('0');
});

test('consumer onWheel cancellation prevents carousel input', async ({
  page,
}) => {
  const root = await open(page);
  await page
    .getByRole('button', { name: 'Cancel wheel events', exact: true })
    .click();
  const allowed = await root.evaluate((node) =>
    node.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 100 })
    )
  );
  expect(allowed).toBe(false);
  expect(Math.abs(await position(root))).toBeLessThan(0.005);
});

test('non-cancelable trackpad tail events still advance the free position', async ({
  page,
}) => {
  const root = await open(page);
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.1, cancelable: true });
  await root.dispatchEvent('wheel', {
    deltaX: width * 0.05,
    cancelable: false,
  });
  await stopped(page);
  expect(Math.abs((await position(root)) - 0.15)).toBeLessThan(0.01);
});

test('Shift+wheel moves horizontal carousels and snap mode still selects slides', async ({
  page,
}) => {
  const root = await open(page, 'dragMode:snap');
  await hover(page, root);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 90);
  await page.keyboard.up('Shift');
  await expect(page.getByTestId('cursor')).toHaveText('1');
  await stopped(page);
  expect(Math.abs((await position(root)) - 1)).toBeLessThan(0.01);
});

test('native nested scroll areas and form controls keep their wheel events', async ({
  page,
}) => {
  const root = await open(page);
  const nested = root.locator(
    '[data-carousel-slide]:not([inert]) [data-native-scroll]'
  );
  await nested.hover();
  await page.mouse.wheel(60, 0);
  await expect
    .poll(() => nested.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(20);
  expect(Math.abs(await position(root))).toBeLessThan(0.005);
  const consumed = await root.getByRole('spinbutton').evaluate(
    (node) =>
      !node.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: 100,
        })
      )
  );
  expect(consumed).toBe(false);
  expect(Math.abs(await position(root))).toBeLessThan(0.005);
});

test('vertical wheel reaches finite ends then lets the page scroll', async ({
  page,
}) => {
  const root = await open(page, 'axis:vertical;count:3');
  await root.dispatchEvent('wheel', { deltaY: 800, cancelable: true });
  await expect(page.getByTestId('cursor')).toHaveText('2');
  await stopped(page);
  expect(Math.abs((await position(root, true)) - 2)).toBeLessThan(0.01);
  const before = await page.evaluate(() => scrollY);
  await hover(page, root);
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(before + 50);
  expect(Math.abs((await position(root, true)) - 2)).toBeLessThan(0.01);
});

test('API jumps interrupt a wheel stream and disabling wheel leaves no delayed navigation', async ({
  page,
}) => {
  const root = await open(page);
  await root.dispatchEvent('wheel', { deltaX: 120, cancelable: true });
  await page.getByRole('button', { name: 'Jump to 700' }).click();
  await expect(page.getByTestId('cursor')).toHaveText('700');
  await stopped(page);
  await expect
    .poll(async () => Math.abs((await position(root)) - 700))
    .toBeLessThan(0.01);
  await root.dispatchEvent('wheel', { deltaX: 120, cancelable: true });
  await page.getByRole('button', { name: 'Toggle wheel' }).click();
  await stopped(page);
  const before = await position(root);
  await page.waitForTimeout(250);
  expect(Math.abs((await position(root)) - before)).toBeLessThan(0.005);
});

test('reduced motion keeps a free release point without a fling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const root = await open(page);
  await drag(page, root, 0.3, false);
  await stopped(page);
  expect(Math.abs((await position(root)) - 0.3)).toBeLessThan(0.015);
});

test('free motion respects fractional trimmed ends and can navigate the remaining fraction', async ({
  page,
}) => {
  const root = await open(page, 'count:8;slidesPerView:2.5');
  await root.dispatchEvent('wheel', { deltaX: 10000, cancelable: true });
  await expect(page.getByTestId('cursor')).toHaveText('6');
  await stopped(page);
  expect(Math.abs((await position(root)) - 5.5)).toBeLessThan(0.015);
  await expect(
    page.getByRole('button', { name: 'Next', exact: true })
  ).toBeDisabled();
  await root.dispatchEvent('wheel', { deltaX: -20, cancelable: true });
  await expect.poll(() => position(root)).toBeLessThan(5.45);
  await stopped(page);
  await expect(
    page.getByRole('button', { name: 'Next', exact: true })
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect
    .poll(async () => Math.abs((await position(root)) - 5.5))
    .toBeLessThan(0.015);
});

test('trusted touch can stop between slides in free mode', async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== 'chromium-touch',
    'Trusted touch uses Chromium mobile emulation.'
  );
  const root = await open(page);
  const box = (await root.boundingBox())!;
  const client = await context.newCDPSession(page);
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.85;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - (box.width * 0.3 * step) / 8, y }],
    });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await stopped(page);
  expect(Math.abs((await position(root)) - 0.3)).toBeLessThan(0.02);
  await client.detach();
});
