import { expect, test, type Locator, type Page } from '@playwright/test';
import { openStory } from './helpers/story.js';

const stopped = (page: Page) =>
  expect(page.getByTestId('moving')).toHaveText('false');
const input = (page: Page, args = '') =>
  openStory(page, 'regression-input--momentum', args);
const position = (root: Locator, vertical = false) =>
  root.evaluate((element, vertical) => {
    const card = element.querySelector<HTMLElement>('[data-input-index]')!;
    const box = card.closest('[data-carousel-slide]')!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    const local = Number(card.dataset.inputIndex);
    const cursor = Number(
      document.querySelector('[data-testid="cursor"]')!.textContent
    );
    const absolute = local + Math.round((cursor - local) / 1000) * 1000;
    return (
      absolute +
      (vertical
        ? (bounds.y - box.y) / box.height
        : (bounds.x - box.x) / box.width)
    );
  }, vertical);

async function pause(page: Page) {
  await page.clock.pauseAt(new Date('2026-11-01T00:01:00Z'));
}
async function clock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-01T00:00:00Z') });
}
async function gesture(
  page: Page,
  root: Locator,
  fraction: number,
  vertical = false,
  stopped = false
) {
  const box = (await root.boundingBox())!;
  const actor = (await root
    .locator('[data-carousel-slide]')
    .first()
    .boundingBox())!;
  const pitch = vertical ? actor.height : actor.width;
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.clock.runFor(5);
    const movement = (pitch * fraction * step) / 8;
    await page.mouse.move(
      x - (vertical ? 0 : movement),
      y - (vertical ? movement : 0)
    );
  }
  if (stopped) await page.clock.runFor(150);
  const release = await position(root, vertical);
  await page.mouse.up();
  return release;
}

for (const vertical of [false, true]) {
  test(`momentum snapping coasts, respects step increments and aligns ${vertical ? 'vertical' : 'horizontal'} loops`, async ({
    page,
  }) => {
    await clock(page);
    const root = await input(
      page,
      `mode:loop;axis:${vertical ? 'vertical' : 'horizontal'};slidesToScroll:2`
    );
    await pause(page);
    const released = await gesture(page, root, 0.6, vertical);
    await page.clock.runFor(96);
    expect(await position(root, vertical)).toBeGreaterThan(released + 0.1);
    await page.clock.runFor(1400);
    await stopped(page);
    const cursor = Number(await page.getByTestId('cursor').textContent());
    expect(cursor).toBeGreaterThan(0);
    expect(cursor % 2).toBe(0);
    expect(Math.abs((await position(root, vertical)) - cursor)).toBeLessThan(
      0.01
    );
    await expect(page.getByTestId('source')).toHaveText('drag');
    await expect(page.getByTestId('settles')).toHaveText('1');
    await expect(root.locator('[data-carousel-slide]')).toHaveCount(3);
  });

  test(`momentum snapping reaches the fractional trimmed ${vertical ? 'vertical' : 'horizontal'} end and resists its boundary`, async ({
    page,
  }) => {
    await clock(page);
    const root = await input(
      page,
      `axis:${vertical ? 'vertical' : 'horizontal'};slidesPerView:2.5;slidesToScroll:2`
    );
    // Keep 1,000 items so the position helper's loop period remains unchanged.
    await page
      .getByRole('button', { name: 'Jump to last', exact: true })
      .click();
    await stopped(page);
    await pause(page);
    await page.clock.runFor(1000);
    await stopped(page);
    expect(await position(root, vertical)).toBeCloseTo(997.5, 2);
    await gesture(page, root, 0.6, vertical, true);
    await page.clock.runFor(1000);
    await stopped(page);
    expect(await position(root, vertical)).toBeCloseTo(997.5, 2);
    await expect(page.getByTestId('blocked')).toHaveText('true');
  });
}

test('momentum snapping uses the reached position after a pause and on reversal', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:loop');
  await pause(page);
  await gesture(page, root, 1.2, false, true);
  await page.clock.runFor(1000);
  await stopped(page);
  expect(await position(root)).toBeCloseTo(1, 2);
  await gesture(page, root, -1.2, false, true);
  await page.clock.runFor(1000);
  await stopped(page);
  expect(await position(root)).toBeCloseTo(0, 2);
});

test('momentum snapping uses a spring by default and honors explicit duration', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:loop');
  await pause(page);
  await gesture(page, root, 0.65, false, true);
  await page.clock.runFor(240);
  expect(await position(root)).toBeGreaterThan(0.65);
  expect(await position(root)).toBeLessThan(0.99);
  await expect(page.getByTestId('moving')).toHaveText('true');
  await page.clock.runFor(1400);
  await stopped(page);
  expect(await position(root)).toBeCloseTo(1, 2);
  // An explicit duration remains available; it is not the momentum default.
  const timed = await openStory(
    page,
    'regression-input--momentum-duration',
    'mode:loop'
  );
  await gesture(page, timed, 0.65, false, true);
  await page.clock.runFor(240);
  await stopped(page);
  expect(await position(timed)).toBeCloseTo(1, 2);
});

for (const accept of [false, true]) {
  test(`controlled momentum snapping can ${accept ? 'accept' : 'reject'} the predicted destination`, async ({
    page,
  }) => {
    await clock(page);
    const root = await input(
      page,
      `mode:loop;controlled:true;accept:${accept}`
    );
    await pause(page);
    await gesture(page, root, 0.45);
    await page.clock.runFor(1400);
    await stopped(page);
    const cursor = Number(await page.getByTestId('cursor').textContent());
    if (accept) expect(cursor).toBeGreaterThan(0);
    else expect(cursor).toBe(0);
    expect(await position(root)).toBeCloseTo(cursor, 2);
    await expect(page.getByTestId('reason')).toHaveText('drag');
  });
}

for (const reduced of [false, true]) {
  test(`momentum snapping skips inertia with ${reduced ? 'reduced motion' : 'disabled animation'}`, async ({
    page,
  }) => {
    await clock(page);
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = reduced
      ? await input(page, 'mode:loop')
      : await openStory(
          page,
          'regression-input--momentum-without-animation',
          'mode:loop'
        );
    await pause(page);
    const released = await gesture(page, root, 0.65);
    await page.clock.runFor(32);
    await stopped(page);
    expect(Math.abs((await position(root)) - released)).toBeLessThanOrEqual(
      0.51
    );
    expect(await position(root)).toBeCloseTo(1, 2);
  });
}

test('momentum snapping follows trackpad pixels, then snaps without another fling', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:loop');
  await pause(page);
  const width = (await root.boundingBox())!.width;
  await root.dispatchEvent('wheel', { deltaX: width * 0.65, cancelable: true });
  await page.clock.runFor(16);
  expect(await position(root)).toBeCloseTo(0.65, 2);
  await page.clock.runFor(140);
  await expect(page.getByTestId('cursor')).toHaveText('1');
  await page.clock.runFor(1200);
  await stopped(page);
  expect(await position(root)).toBeCloseTo(1, 2);
});

test('API navigation interrupts momentum without a stale settle target', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:loop');
  await pause(page);
  await gesture(page, root, 0.45);
  await page.clock.runFor(64);
  await page.getByRole('button', { name: 'Jump to 700', exact: true }).click();
  await page.clock.runFor(1500);
  await stopped(page);
  await expect(page.getByTestId('cursor')).toHaveText('-300');
  expect(await position(root)).toBeCloseTo(-300, 2);
  await expect(page.getByTestId('settles')).toHaveText('1');
});

for (const vertical of [false, true]) {
  test(`a pointer catches an active ${vertical ? 'vertical' : 'horizontal'} wheel stream and remains draggable`, async ({
    page,
  }) => {
    await clock(page);
    const root = await input(
      page,
      `mode:loop;axis:${vertical ? 'vertical' : 'horizontal'}`
    );
    await pause(page);
    const box = (await root.boundingBox())!;
    const pitch = vertical ? box.height : box.width;
    await root.dispatchEvent('wheel', {
      deltaX: vertical ? 0 : pitch * 0.65,
      deltaY: vertical ? pitch * 0.65 : 0,
      cancelable: true,
    });
    await page.clock.runFor(16);
    expect(await position(root, vertical)).toBeCloseTo(0.65, 2);
    const x = box.x + box.width * 0.8;
    const y = box.y + box.height * 0.9;
    await page.mouse.move(x, y);
    await page.mouse.down();
    const caught = await position(root, vertical);
    await page.clock.runFor(600);
    expect(await position(root, vertical)).toBeCloseTo(caught, 3);
    await expect(page.getByTestId('cursor')).toHaveText('0');
    await page.mouse.move(
      x - (vertical ? 0 : pitch * 0.35),
      y - (vertical ? pitch * 0.35 : 0),
      { steps: 8 }
    );
    expect(await position(root, vertical)).toBeCloseTo(1, 2);
    await page.clock.runFor(150);
    await page.mouse.up();
    await page.clock.runFor(1400);
    await stopped(page);
    expect(await position(root, vertical)).toBeCloseTo(1, 2);
    await expect(page.getByTestId('settles')).toHaveText('1');
  });
}

test('forward-loop momentum retains its starting boundary and a caught coast can reverse', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:forward-loop;slidesToScroll:2');
  await pause(page);
  await gesture(page, root, -0.6);
  await page.clock.runFor(1400);
  await stopped(page);
  expect(await position(root)).toBeCloseTo(0, 2);
  await gesture(page, root, 0.6);
  await page.clock.runFor(96);
  const box = (await root.boundingBox())!;
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height * 0.9;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const caught = await position(root);
  await page.clock.runFor(600);
  expect(await position(root)).toBeCloseTo(caught, 3);
  await page.mouse.move(x + box.width * 0.2, y, { steps: 8 });
  await page.clock.runFor(150);
  await page.mouse.up();
  await page.clock.runFor(1400);
  await stopped(page);
  expect(await position(root)).toBeLessThanOrEqual(caught + 0.5);
  expect(await position(root)).toBeGreaterThanOrEqual(0);
});

test('canceling a stationary catch aligns it without leaving a gesture active', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:loop');
  await pause(page);
  await gesture(page, root, 0.45);
  await page.clock.runFor(64);
  const box = (await root.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.9);
  await page.mouse.down();
  await root.dispatchEvent('pointercancel', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
  });
  await page.clock.runFor(1000);
  await page.mouse.up();
  await stopped(page);
  const cursor = Number(await page.getByTestId('cursor').textContent());
  expect(await position(root)).toBeCloseTo(cursor, 2);
});

test('an explicit command resumes the selected destination while a coast is caught', async ({
  page,
}) => {
  await clock(page);
  const root = await input(page, 'mode:loop');
  await pause(page);
  await gesture(page, root, 0.45);
  await page.clock.runFor(64);
  const target = Number(await page.getByTestId('cursor').textContent());
  const box = (await root.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.9);
  await page.mouse.down();
  expect(Math.abs((await position(root)) - target)).toBeGreaterThan(0.2);
  await page
    .getByRole('button', { name: 'Select current', exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await page.clock.runFor(1000);
  await stopped(page);
  expect(await position(root)).toBeCloseTo(target, 2);
  await page.mouse.up();
});

interface MotionAudit {
  frames: number;
  maxError: number;
  mismatches: number;
  unreadyFrames: number;
  position: number;
  axis: string;
  maxPosition: number;
  slides: { index: number; absoluteIndex: number; distance: number }[];
}
const read = async (page: Page): Promise<MotionAudit> =>
  JSON.parse((await page.getByTestId('motion-data').textContent()) || '{}');
async function subscription(page: Page, args = '') {
  const root = await openStory(
    page,
    'regression-motion-subscription--example',
    args
  );
  await expect.poll(async () => (await read(page)).frames).toBeGreaterThan(0);
  return root;
}

for (const vertical of [false, true]) {
  test(`motion frames match actual ${vertical ? 'vertical' : 'horizontal'} geometry through recycling, compressed jumps and resize`, async ({
    page,
  }) => {
    await clock(page);
    const root = await subscription(
      page,
      `axis:${vertical ? 'vertical' : 'horizontal'}`
    );
    await pause(page);
    for (let move = 0; move < 12; move++) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.clock.runFor(1100);
    }
    for (const [button, target] of [
      ['Jump backwards', -1000],
      ['Jump forwards', 1000],
    ] as const) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.clock.runFor(1100);
      expect((await read(page)).position).toBeCloseTo(target, 5);
    }
    await page.getByRole('slider', { name: 'Container width' }).focus();
    await page.keyboard.press('Home');
    await page.clock.runFor(64);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.clock.runFor(64);
    const audit = await read(page);
    expect(audit.axis).toBe(vertical ? 'vertical' : 'horizontal');
    // WebKit rounds composited fractional coordinates; allow one CSS pixel.
    expect(audit.maxError).toBeLessThan(1.1);
    expect(audit.mismatches).toBe(0);
    expect(audit.frames).toBeGreaterThan(100);
    const visible = audit.slides.filter(
      (slide) => Math.abs(slide.distance) < 2
    );
    expect(new Set(visible.map((slide) => slide.absoluteIndex)).size).toBe(
      visible.length
    );
    expect(audit.slides.length).toBe(
      await root.locator('[data-carousel-slide]').count()
    );
  });
}

test('motion subscriptions update between indexes without rendering the consumer every frame', async ({
  page,
}) => {
  await clock(page);
  await subscription(page);
  await pause(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  // Pass the initial enter/leave commits; recycling may legitimately render.
  await page.clock.runFor(240);
  const before = await read(page);
  const renders = await page.getByTestId('consumer-renders').textContent();
  await page.clock.runFor(240);
  const after = await read(page);
  expect(after.frames).toBeGreaterThan(before.frames + 10);
  expect(after.position).toBeGreaterThan(before.position);
  expect(after.position).toBeLessThan(1);
  await expect(page.getByTestId('consumer-renders')).toHaveText(renders!);
  expect(after.maxError).toBeLessThan(1.1);
});

test('motion subscriptions track spring overshoot in the default snap mode', async ({
  page,
}) => {
  await clock(page);
  await openStory(page, 'regression-motion-subscription--spring');
  await expect.poll(async () => (await read(page)).frames).toBeGreaterThan(0);
  await pause(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.clock.runFor(2500);
  await stopped(page);
  const audit = await read(page);
  expect(audit.maxPosition).toBeGreaterThan(1.05);
  expect(audit.position).toBeCloseTo(1, 5);
  expect(audit.maxError).toBeLessThan(1.1);
  expect(audit.mismatches).toBe(0);
});

test('unsubscribe, late subscription and detach/rebind deliver only committed mounted content', async ({
  page,
}) => {
  await clock(page);
  await subscription(page);
  await pause(page);
  await page
    .getByRole('button', { name: 'Toggle subscription', exact: true })
    .click();
  const before = (await read(page)).frames;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.clock.runFor(1100);
  expect((await read(page)).frames).toBe(before);
  await page
    .getByRole('button', { name: 'Toggle subscription', exact: true })
    .click();
  expect((await read(page)).position).toBeCloseTo(1, 5);
  await page
    .getByRole('button', { name: 'Toggle mounted', exact: true })
    .click();
  const detached = (await read(page)).frames;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.clock.runFor(1100);
  expect((await read(page)).frames).toBe(detached);
  await page
    .getByRole('button', { name: 'Toggle mounted', exact: true })
    .click();
  await page.clock.runFor(64);
  expect((await read(page)).frames).toBeGreaterThan(detached);
  expect((await read(page)).mismatches).toBe(0);
  expect((await read(page)).unreadyFrames).toBe(0);
  expect((await read(page)).maxError).toBeLessThan(1.1);
});
