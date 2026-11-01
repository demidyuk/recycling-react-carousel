import { expect, test, type Locator, type Page } from '@playwright/test';
import { openStory } from './helpers/story.js';

const hour = (page: Page) =>
  page.getByRole('spinbutton', { name: 'Hours', exact: true });
const minute = (page: Page) =>
  page.getByRole('spinbutton', { name: 'Minutes', exact: true });
const time = (page: Page) => page.getByTestId('selected-time');

async function open(page: Page, args = '') {
  await openStory(page, 'rcarousel--time-picker', args);
  await expect(hour(page)).toHaveAttribute('aria-valuenow', '12');
  await expect(minute(page)).toHaveAttribute('aria-valuenow', '0');
  await expect(time(page)).toHaveText('12:00');
}

async function centered(root: Locator, value: number, vertical = true) {
  await expect
    .poll(() =>
      root.evaluate(
        (element, { value, vertical }) => {
          const bounds = element.getBoundingClientRect();
          const center = vertical
            ? bounds.y + bounds.height / 2
            : bounds.x + bounds.width / 2;
          return Math.min(
            ...Array.from(
              element.querySelectorAll<HTMLElement>(
                `[data-picker-option="${value}"]`
              ),
              (option) => {
                const box = option.getBoundingClientRect();
                return Math.abs(
                  (vertical ? box.y + box.height / 2 : box.x + box.width / 2) -
                    center
                );
              }
            )
          );
        },
        { value, vertical }
      )
    )
    .toBeLessThan(1);
}

async function drag(page: Page, root: Locator, rows: number) {
  const bounds = (await root.boundingBox())!;
  const option = (await root
    .locator('[data-picker-option]')
    .first()
    .boundingBox())!;
  const x = bounds.x + bounds.width / 3;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - option.height * rows, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

const position = (root: Locator) =>
  root.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const center = bounds.y + bounds.height / 2;
    const rows = Array.from(
      element.querySelectorAll<HTMLElement>('[data-picker-option]'),
      (row) => {
        const box = row.getBoundingClientRect();
        return {
          value: Number(row.dataset.pickerOption),
          size: box.height,
          distance: center - box.y - box.height / 2,
        };
      }
    ).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
    return rows[0].value + rows[0].distance / rows[0].size;
  });

async function paused(page: Page, reduced = false) {
  await page.clock.install({ time: new Date('2026-11-01T00:00:00Z') });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.clock.pauseAt(new Date('2026-11-01T00:01:00Z'));
}

async function flick(page: Page, root: Locator) {
  const bounds = (await root.boundingBox())!;
  const pitch = (await root
    .locator('[data-picker-option]')
    .first()
    .boundingBox())!.height;
  const x = bounds.x + bounds.width / 3;
  const y = bounds.y + bounds.height / 2 + pitch * 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) {
    await page.clock.runFor(16);
    await page.mouse.move(x, y - (pitch * step) / 2);
  }
  const release = await position(root);
  await page.mouse.up();
  return release;
}

test('time picker projects values around a cylinder with a single shared selection band', async ({
  page,
}) => {
  await open(page);
  const geometry = await hour(page).evaluate((root) => {
    const column = root.parentElement!;
    const face = (value: number) =>
      Array.from(
        column.querySelectorAll<HTMLElement>(`[data-picker-face="${value}"]`)
      ).find((node) => node.style.visibility === 'visible')!;
    const center = (value: number) => {
      const box = face(value).getBoundingClientRect();
      return box.y + box.height / 2;
    };
    const wheel = root.getBoundingClientRect();
    const band = getComputedStyle(column.parentElement!, '::before');
    return {
      selected: Math.abs(center(12) - wheel.y - wheel.height / 2),
      nearStep: center(13) - center(12),
      farStep: center(16) - center(15),
      centerHeight: face(12).getBoundingClientRect().height,
      edgeHeight: face(16).getBoundingClientRect().height,
      bandWidth: parseFloat(band.width),
      wheelWidth: wheel.width,
    };
  });
  expect(geometry.selected).toBeLessThan(1);
  expect(geometry.farStep).toBeLessThan(geometry.nearStep * 0.5);
  expect(geometry.edgeHeight).toBeLessThan(geometry.centerHeight * 0.5);
  expect(geometry.bandWidth).toBeCloseTo(geometry.wheelWidth * 2, 0);
});

test('time picker carries flick momentum after release and finally aligns a value', async ({
  page,
}) => {
  await paused(page);
  const root = minute(page);
  const release = await flick(page, root);
  await page.clock.runFor(96);
  const coasting = await position(root);
  expect(coasting).toBeGreaterThan(release + 1);
  await page.clock.runFor(64);
  expect(await position(root)).toBeGreaterThan(coasting + 0.2);
  await page.clock.runFor(1200);
  const value = Number(await root.getAttribute('aria-valuenow'));
  await centered(root, value);
  expect(Math.abs((await position(root)) - value)).toBeLessThan(0.01);
  await expect(root.locator('..').locator('[data-picker-face]')).toHaveCount(
    27
  );
});

test('time picker catches a coast without snapping under a held pointer', async ({
  page,
}) => {
  await paused(page);
  const root = minute(page);
  await flick(page, root);
  await page.clock.runFor(64);
  const bounds = (await root.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 3,
    bounds.y + bounds.height / 2
  );
  await page.mouse.down();
  const caught = await position(root);
  await page.clock.runFor(600);
  expect(Math.abs((await position(root)) - caught)).toBeLessThan(0.01);
  await page.mouse.up();
  await page.clock.runFor(600);
  await centered(root, Number(await root.getAttribute('aria-valuenow')));
});

test('time picker skips momentum and aligns immediately with reduced motion', async ({
  page,
}) => {
  await paused(page, true);
  const root = minute(page);
  const release = await flick(page, root);
  await page.clock.runFor(32);
  const value = Number(await root.getAttribute('aria-valuenow'));
  expect(Math.abs(value - release)).toBeLessThanOrEqual(0.51);
  await centered(root, value);
  await page.clock.runFor(800);
  expect(Math.abs((await position(root)) - value)).toBeLessThan(0.01);
});

test('time picker starts with two independently centered values and bounded pools', async ({
  page,
}) => {
  await open(page);
  await centered(hour(page), 12);
  await centered(minute(page), 0);
  for (const root of [hour(page), minute(page)]) {
    await expect(root.locator(':scope > [data-carousel-slide]')).toHaveCount(
      27
    );
    await expect(root).toHaveAttribute('aria-valuemin', '0');
  }
  await expect(hour(page)).toHaveAttribute('aria-valuemax', '23');
  await expect(minute(page)).toHaveAttribute('aria-valuemax', '59');
});

test('time picker keyboard selection wraps both wheels without changing the other value', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await hour(page).focus();
  await page.keyboard.press('End');
  await expect(time(page)).toHaveText('23:00');
  await page.keyboard.press('ArrowUp');
  await expect(time(page)).toHaveText('00:00');
  await page.keyboard.press('ArrowDown');
  await expect(time(page)).toHaveText('23:00');
  await centered(hour(page), 23);
  await minute(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect(time(page)).toHaveText('23:59');
  await page.keyboard.press('ArrowUp');
  await expect(time(page)).toHaveText('23:00');
  await page.keyboard.press('PageUp');
  await expect(time(page)).toHaveText('23:05');
  await page.keyboard.press('PageDown');
  await expect(time(page)).toHaveText('23:00');
  await centered(minute(page), 0);
});

test('time picker supports pointer dragging, reversal, and clicking a neighboring value', async ({
  page,
}) => {
  await open(page);
  await drag(page, hour(page), 1.1);
  await expect(time(page)).toHaveText('13:00');
  await centered(hour(page), 13);
  await drag(page, minute(page), -1.1);
  await expect(time(page)).toHaveText('13:59');
  await centered(minute(page), 59);
  await drag(page, hour(page), -1.1);
  await expect(time(page)).toHaveText('12:59');
  await centered(hour(page), 12);
  await minute(page).locator('[data-picker-option="0"]').click();
  await expect(time(page)).toHaveText('12:00');
  await centered(minute(page), 0);
});

test('dragging picker digits does not select text, while the story heading stays selectable', async ({
  page,
}, info) => {
  await open(page);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const root = hour(page);
  const face = root
    .locator('[data-picker-face="12"]')
    .filter({ visible: true })
    .first();
  const box = (await face.boundingBox())!;
  const pitch = (await root
    .locator('[data-picker-option]')
    .first()
    .boundingBox())!.height;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(x, y - (pitch * 2.1 * step) / 10);
    expect(
      await page.evaluate(() => window.getSelection()?.toString() ?? '')
    ).toBe('');
  }
  expect(await position(root)).toBeGreaterThan(12.5);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(time(page)).toHaveText('14:00');
  await centered(root, 14);
  expect(
    await page.evaluate(() => window.getSelection()?.toString() ?? '')
  ).toBe('');
  if (info.project.name !== 'chromium-touch') {
    const heading = page.getByRole('heading', {
      name: 'Time picker',
      exact: true,
    });
    const headingBox = (await heading.boundingBox())!;
    await heading.dblclick({ position: { x: 24, y: headingBox.height / 2 } });
    await expect
      .poll(() =>
        page.evaluate(() => window.getSelection()?.toString().trim() ?? '')
      )
      .not.toBe('');
  }
});

test('time picker wheel input snaps and loops without scrolling the page', async ({
  page,
}) => {
  await open(page);
  const scroll = await page.evaluate(() => window.scrollY);
  const pitch = (await minute(page)
    .locator('[data-picker-option]')
    .first()
    .boundingBox())!.height;
  await minute(page).dispatchEvent('wheel', {
    deltaY: -pitch,
    cancelable: true,
  });
  await expect(time(page)).toHaveText('12:59');
  await centered(minute(page), 59);
  await minute(page).dispatchEvent('wheel', {
    deltaY: pitch,
    cancelable: true,
  });
  await expect(time(page)).toHaveText('12:00');
  await centered(minute(page), 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
});

test('time picker keeps keyboard focus and row geometry across resizing', async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await centered(hour(page), 12);
  await centered(minute(page), 0);
  await page.keyboard.press('Tab');
  await expect(hour(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(minute(page)).toBeFocused();
  const focus = await minute(page).evaluate(
    (root) => getComputedStyle(root.parentElement!).outlineStyle
  );
  expect(focus).toBe('solid');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(minute(page)).toBeFocused();
  await centered(hour(page), 12);
  await centered(minute(page), 0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(1280);
});

test('time picker preserves its small recycling pools through repeated wraps', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const root of [hour(page), minute(page)]) {
    await root.focus();
    for (let index = 0; index < 30; index++)
      await page.keyboard.press('PageUp');
    await expect(root.locator(':scope > [data-carousel-slide]')).toHaveCount(
      27
    );
    const values = await root
      .locator('..')
      .locator('[data-picker-face]')
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) => (node as HTMLElement).style.visibility === 'visible'
          )
          .map((node) => node.getAttribute('data-picker-face'))
      );
    expect(values.length).toBeGreaterThanOrEqual(7);
    expect(new Set(values).size).toBe(values.length);
  }
});

test('time picker can disable dragging and wheel input through Controls', async ({
  page,
}) => {
  await open(page, 'drag:false;wheel:false');
  await drag(page, hour(page), 1.1);
  await minute(page).dispatchEvent('wheel', { deltaY: 56, cancelable: true });
  await expect(time(page)).toHaveText('12:00');
  await hour(page).focus();
  await page.keyboard.press('ArrowUp');
  await expect(time(page)).toHaveText('13:00');
  await centered(hour(page), 13);
});

test('time picker supports horizontal orientation through Controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'axis:horizontal');
  await centered(hour(page), 12, false);
  await hour(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(time(page)).toHaveText('13:00');
  await centered(hour(page), 13, false);
});

test('time picker responds to trusted touch on mobile', async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== 'chromium-touch',
    'Trusted touch uses Chromium mobile emulation.'
  );
  await open(page);
  const bounds = (await minute(page).boundingBox())!;
  const x = bounds.x + bounds.width / 3;
  const y = bounds.y + bounds.height / 2;
  const pitch = (await minute(page)
    .locator('[data-picker-option]')
    .first()
    .boundingBox())!.height;
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - (pitch * 1.1 * step) / 8 }],
    });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(time(page)).toHaveText('12:01');
  await centered(minute(page), 1);
  // A moving finger releases velocity; a finger paused above deliberately did not.
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: y + pitch * 2 }],
  });
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + pitch * 2 - (pitch * step) / 2 }],
    });
    await page.waitForTimeout(16);
  }
  const released = await position(minute(page));
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() => position(minute(page)), { intervals: [16] })
    .toBeGreaterThan(released + 0.5);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  const caught = await position(minute(page));
  await page.waitForTimeout(200);
  expect(Math.abs((await position(minute(page))) - caught)).toBeLessThan(0.02);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await centered(
    minute(page),
    Number(await minute(page).getAttribute('aria-valuenow'))
  );
  await client.detach();
});
