import { expect, test, type Locator, type Page } from '@playwright/test';
import { openStory } from './helpers/story.js';

const open = (page: Page, story: string, args = '') =>
  openStory(page, `rcarousel--${story}`, args);
const visibleSlides = (carousel: Locator) =>
  carousel.locator(':scope > [data-carousel-slide]:not([inert])');
const next = (page: Page) =>
  page.getByRole('button', { name: 'Next slide', exact: true });
const previous = (page: Page) =>
  page.getByRole('button', { name: 'Previous slide', exact: true });
const current = (page: Page) => page.getByTestId('slide-number');
const card = (carousel: Locator, index: number) =>
  visibleSlides(carousel).locator(`[data-item-index="${index}"]`);

async function drag(
  page: Page,
  carousel: Locator,
  fraction: number,
  vertical = false
) {
  const box = (await carousel.boundingBox())!;
  const x = box.x + box.width * (vertical ? 0.5 : 0.8);
  const y = box.y + box.height * (vertical ? 0.8 : 0.5);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x - (vertical ? 0 : box.width * fraction),
    y - (vertical ? box.height * fraction : 0),
    { steps: 12 }
  );
  await page.waitForTimeout(150);
  await page.mouse.up();
}

const restingFraction = (carousel: Locator) =>
  carousel.evaluate((root) => {
    const actor = root.querySelector<HTMLElement>('[data-carousel-slide]')!;
    const box = actor.getBoundingClientRect();
    const offset =
      new DOMMatrixReadOnly(getComputedStyle(actor).transform).m41 / box.width;
    return Math.abs(offset - Math.round(offset));
  });

test('basic dragging is uncontrolled and snaps to the next slide', async ({
  page,
}) => {
  const carousel = await open(page, 'basic');
  await expect(next(page)).toHaveCount(0);
  await drag(page, carousel, 0.6);
  await expect(card(carousel, 1)).toBeVisible();
  await open(page, 'basic', 'drag:false');
  await drag(page, carousel, 0.6);
  await expect(card(carousel, 0)).toBeVisible();
});

test('navigation buttons honor finite boundaries', async ({ page }) => {
  const carousel = await open(page, 'controlled');
  await expect(previous(page)).toBeDisabled();
  for (let index = 1; index < 6; index++) {
    await next(page).click();
    await expect(card(carousel, index)).toBeVisible();
  }
  await expect(next(page)).toBeDisabled();
  await previous(page).click();
  await expect(current(page)).toHaveText('05');
});

test('pagination selects pages and keeps the current page focusable', async ({
  page,
}) => {
  const carousel = await open(page, 'pagination');
  const pageButton = page.getByRole('button', {
    name: 'Go to page 4 of 6',
    exact: true,
  });
  await pageButton.click();
  await expect(pageButton).toHaveAttribute('aria-current', 'page');
  await expect(pageButton).toHaveAttribute('aria-disabled', 'true');
  await pageButton.focus();
  await expect(pageButton).toBeFocused();
  expect(
    await pageButton.evaluate((button: HTMLButtonElement) => button.disabled)
  ).toBe(false);
  await expect(card(carousel, 3)).toBeVisible();
});

test('loop repeats in both directions', async ({ page }) => {
  const carousel = await open(page, 'loop');
  await previous(page).click();
  await expect(page.getByTestId('absolute-index')).toHaveText('-1');
  await expect(card(carousel, 5)).toBeVisible();
  await next(page).click();
  await expect(card(carousel, 0)).toBeVisible();
  await expect(page.getByTestId('absolute-index')).toHaveText('0');
});

test('forward loop repeats beyond the collection but has a starting boundary', async ({
  page,
}) => {
  const carousel = await open(page, 'inspiration');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(previous(page)).toBeDisabled();
  for (let index = 0; index < 6; index++) await next(page).click();
  await expect(page.getByTestId('absolute-index')).toHaveText('6');
  await expect(card(carousel, 0)).toBeVisible();
  await previous(page).click();
  await expect(card(carousel, 5)).toBeVisible();
});

test('multiple slides keep the final finite viewport full', async ({
  page,
}) => {
  const carousel = await open(page, 'multiple-slides');
  await expect(visibleSlides(carousel)).toHaveCount(3);
  for (let index = 0; index < 3; index++) await next(page).click();
  await expect(next(page)).toBeDisabled();
  await expect(visibleSlides(carousel)).toHaveCount(3);
  await expect(card(carousel, 5)).toBeVisible();
});

test('scroll step advances two slides at a time and clamps to the finite end', async ({
  page,
}) => {
  const carousel = await open(page, 'scroll-step');
  await next(page).click();
  await expect(current(page)).toHaveText('03');
  await next(page).click();
  await expect(current(page)).toHaveText('04');
  await expect(visibleSlides(carousel)).toHaveCount(3);
  await expect(next(page)).toBeDisabled();
});

test('center alignment keeps both finite endpoints centered with neighbor previews', async ({
  page,
}) => {
  const carousel = await open(page, 'gallery');
  const centerError = (index: number) =>
    carousel.evaluate((root, index) => {
      const viewport = root.getBoundingClientRect();
      const selected = root
        .querySelector(`[data-item-index="${index}"]`)!
        .getBoundingClientRect();
      return Math.abs(
        selected.left + selected.width / 2 - viewport.left - viewport.width / 2
      );
    }, index);
  await expect.poll(() => centerError(0)).toBeLessThan(2);
  for (let index = 0; index < 5; index++) await next(page).click();
  await expect(card(carousel, 5)).toBeVisible();
  await expect.poll(() => centerError(5)).toBeLessThan(2);
  await expect(next(page)).toBeDisabled();
});

test('automatic sizing chooses equal slides below the maximum size', async ({
  page,
}) => {
  const carousel = await open(page, 'responsive');
  for (const width of [390, 720, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const viewport = await carousel.boundingBox();
        return visibleSlides(carousel)
          .count()
          .then(
            (count) => count === Math.ceil((viewport!.width + 16) / (280 + 16))
          );
      })
      .toBe(true);
    const widths = await visibleSlides(carousel).evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().width)
    );
    expect(Math.max(...widths)).toBeLessThanOrEqual(280);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  }
});

for (const [story, args, count] of [
  ['multiple-slides', 'slidesPerView:6', 6],
  ['responsive', 'maxSlideSize:100px', 4],
] as const) {
  test(`${story} keeps slide numbers inside dense mobile cards`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const carousel = await open(page, story, args);
    await expect(visibleSlides(carousel)).toHaveCount(count);
    const fits = await visibleSlides(carousel)
      .locator('article')
      .evaluateAll((cards) =>
        cards.every((card) => {
          const box = card.getBoundingClientRect();
          const number = card
            .querySelector(':scope > span[aria-hidden="true"]')!
            .getBoundingClientRect();
          return number.left >= box.left && number.right <= box.right;
        })
      );
    expect(fits).toBe(true);
  });
}

test('container width slider activates breakpoints without resizing the browser', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const carousel = await open(page, 'breakpoints');
  const viewportWidth = await page.evaluate(() => innerWidth);
  for (const [width, count] of [
    [350, 1],
    [600, 2],
    [900, 3],
  ]) {
    await page
      .getByRole('slider', { name: 'Container width' })
      .fill(String(width));
    await expect(visibleSlides(carousel)).toHaveCount(count);
    await expect(page.getByTestId('visible-count')).toHaveText(String(count));
  }
  expect(await page.evaluate(() => innerWidth)).toBe(viewportWidth);
});

test('vertical axis supports vertical gestures and navigation', async ({
  page,
}) => {
  const carousel = await open(page, 'vertical');
  await expect(carousel).toHaveCSS('height', '320px');
  await drag(page, carousel, 0.6, true);
  await expect(card(carousel, 1)).toBeVisible();
  await next(page).click();
  await expect(card(carousel, 2)).toBeVisible();
});

test('free dragging rests between slides and navigation realigns', async ({
  page,
}) => {
  const carousel = await open(page, 'free-flow');
  await drag(page, carousel, 0.3);
  expect(await restingFraction(carousel)).toBeGreaterThan(0.2);
  await next(page).click();
  await expect.poll(() => restingFraction(carousel)).toBeLessThan(0.01);
});

for (const [story, axis] of [
  ['wheel-browsing', 'deltaX'],
  ['vertical-scroll', 'deltaY'],
] as const) {
  test(`${story} navigates with axis-matched wheel input`, async ({ page }) => {
    const carousel = await open(page, story);
    const box = (await carousel.boundingBox())!;
    await carousel.dispatchEvent('wheel', {
      [axis]: axis === 'deltaX' ? box.width * 0.6 : box.height * 0.6,
      cancelable: true,
    });
    await expect(current(page)).toHaveText('02');
    await expect(card(carousel, 1)).toBeVisible();
  });
}

test('fixed height stays constant during navigation', async ({ page }) => {
  const carousel = await open(page, 'fixed-height');
  await expect(carousel).toHaveCSS('height', '320px');
  await next(page).click();
  await expect(card(carousel, 1)).toBeVisible();
  await expect(carousel).toHaveCSS('height', '320px');
  await expect(card(carousel, 1)).toHaveCSS('height', '320px');
});

for (const story of ['spring-animation', 'duration-animation']) {
  test(`${story} moves through intermediate positions and settles`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
    const carousel = await open(page, story);
    await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
    await next(page).click();
    await page.clock.runFor(100);
    expect(await restingFraction(carousel)).toBeGreaterThan(0.01);
    await page.clock.runFor(2000);
    await expect(card(carousel, 1)).toBeVisible();
    expect(await restingFraction(carousel)).toBeLessThan(0.01);
  });
}

test('disabled animation and reduced motion select immediately and preserve visible keyboard focus', async ({
  page,
}) => {
  for (const [story, reducedMotion, args] of [
    ['controlled', 'no-preference', 'animation:!false'],
    ['duration-animation', 'reduce', ''],
  ] as const) {
    await page.emulateMedia({ reducedMotion });
    const carousel = await open(page, story, args);
    await next(page).focus();
    expect(
      await next(page).evaluate(
        (button) => getComputedStyle(button).outlineStyle
      )
    ).toBe('solid');
    await page.keyboard.press('Enter');
    expect(await restingFraction(carousel)).toBeLessThan(0.01);
    await expect(card(carousel, 1)).toBeVisible();
  }
});

test('large collection jumps to distant items with a stable bounded pool', async ({
  page,
}) => {
  const carousel = await open(page, 'large-jumps');
  const pool = carousel.locator(':scope > [data-carousel-slide]');
  const poolSize = await pool.count();
  expect(poolSize).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('slot-count')).toHaveText(String(poolSize));
  for (const number of [950, 1000, 1]) {
    await page
      .getByRole('spinbutton', { name: 'Slide number' })
      .fill(String(number));
    await page
      .getByRole('button', { name: 'Go to slide', exact: true })
      .click();
    await expect(card(carousel, number - 1)).toBeVisible();
    await expect(pool).toHaveCount(poolSize);
    await expect(page.getByTestId('slot-count')).toHaveText(String(poolSize));
  }
});

test('expanded content resizes and retains state after leaving the rendered pool', async ({
  page,
}) => {
  const carousel = await open(page, 'field-notes');
  const initialHeight = (await carousel.boundingBox())!.height;
  const expand = () =>
    visibleSlides(carousel).getByRole('button', {
      name: 'Show more',
      exact: true,
    });
  await expand().focus();
  await page.keyboard.press('Enter');
  const collapse = visibleSlides(carousel).getByRole('button', {
    name: 'Show less',
    exact: true,
  });
  await expect(collapse).toBeFocused();
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  const region = await collapse.getAttribute('aria-controls');
  await expect(page.locator(`[id="${region}"]`)).toBeVisible();
  await expect
    .poll(async () => (await carousel.boundingBox())!.height)
    .toBeGreaterThan(initialHeight + 100);
  for (let index = 0; index < 5; index++) await next(page).click();
  await expect(carousel.locator('[data-item-index="0"]')).toHaveCount(0);
  for (let index = 0; index < 5; index++) await previous(page).click();
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await collapse.click();
  await expect
    .poll(async () =>
      Math.abs((await carousel.boundingBox())!.height - initialHeight)
    )
    .toBeLessThan(2);
});

test('expanded multi-slide content fits the tallest visible item', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const carousel = await open(page, 'field-notes', 'slidesPerView:3');
  await expect(visibleSlides(carousel)).toHaveCount(3);
  const initialHeight = (await carousel.boundingBox())!.height;
  await visibleSlides(carousel)
    .getByRole('button', { name: 'Show more', exact: true })
    .nth(1)
    .click();
  const tallest = () =>
    visibleSlides(carousel)
      .locator('figure')
      .evaluateAll((cards) =>
        Math.max(...cards.map((card) => card.getBoundingClientRect().height))
      );
  await expect
    .poll(async () =>
      Math.abs((await carousel.boundingBox())!.height - (await tallest()))
    )
    .toBeLessThan(2);
  await expect
    .poll(async () => (await carousel.boundingBox())!.height)
    .toBeGreaterThan(initialHeight + 100);
  await visibleSlides(carousel)
    .getByRole('button', { name: 'Show less', exact: true })
    .click();
  await expect
    .poll(async () =>
      Math.abs((await carousel.boundingBox())!.height - initialHeight)
    )
    .toBeLessThan(2);
});

test('viewport fits the selected slide and shrinks again', async ({ page }) => {
  const carousel = await open(page, 'content-sizing');
  const initialHeight = (await carousel.boundingBox())!.height;
  await page.getByRole('button', { name: 'Long content', exact: true }).click();
  await expect
    .poll(async () => (await carousel.boundingBox())!.height)
    .toBeGreaterThan(initialHeight + 100);
  await page
    .getByRole('button', { name: 'Short content', exact: true })
    .click();
  await expect
    .poll(async () =>
      Math.abs((await carousel.boundingBox())!.height - initialHeight)
    )
    .toBeLessThan(2);
});

const quoteHeight = (carousel: Locator, name: string) =>
  carousel
    .locator('figure')
    .filter({ hasText: name })
    .first()
    .evaluate((quote) => Math.round(quote.getBoundingClientRect().height));

test('content animation keeps the page scroll position after scrolling to the bottom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 704, height: 568 });
  const carousel = await open(page, 'content-sizing');
  const initialHeight = (await carousel.boundingBox())!.height;
  const initialBottom = await page.evaluate(
    () => document.documentElement.scrollHeight - innerHeight
  );
  await page.getByRole('button', { name: 'Long content', exact: true }).click();
  await expect
    .poll(async () => (await carousel.boundingBox())!.height, {
      intervals: [16],
    })
    .toBeGreaterThan(initialHeight + 60);
  await page.mouse.wheel(0, 4000);
  await expect
    .poll(() => page.evaluate(() => scrollY), { intervals: [16] })
    .toBeGreaterThan(initialBottom + 20);
  const duringAnimation = await page.evaluate(() => scrollY);
  await expect(visibleSlides(carousel).locator('figcaption strong')).toHaveText(
    ['Long content']
  );
  const afterAnimation = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return scrollY;
  });
  expect(afterAnimation).toBeGreaterThanOrEqual(duringAnimation - 2);
});

test('content duration animation preserves a bottom scroll across settlement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 704, height: 568 });
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const carousel = await openStory(
    page,
    'rcarousel--content-sizing',
    'animation.type:duration;animation.duration:1000'
  );
  const initialBottom = await page.evaluate(
    () => document.documentElement.scrollHeight - innerHeight
  );
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  await page.getByRole('button', { name: 'Long content', exact: true }).click();
  await page.clock.runFor(400);
  const duringAnimation = await page.evaluate(() => {
    scrollTo(0, document.documentElement.scrollHeight);
    return scrollY;
  });
  expect(duringAnimation).toBeGreaterThan(initialBottom + 20);
  await page.clock.runFor(1200);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(
    duringAnimation - 2
  );
  await expect(visibleSlides(carousel).locator('figcaption strong')).toHaveText(
    ['Long content']
  );
});

async function expectHeightAtQuoteProgress(
  carousel: Locator,
  short: number,
  tall: number
) {
  const state = await carousel.evaluate((root) => {
    const anna = [...root.querySelectorAll('figure')].find(
      (quote) => quote.querySelector('strong')?.textContent === 'Short content'
    )!;
    const viewport = root.getBoundingClientRect();
    const pitch = anna
      .closest('[data-carousel-slide]')!
      .getBoundingClientRect().width;
    return {
      height: viewport.height,
      progress: (viewport.left - anna.getBoundingClientRect().left) / pitch,
    };
  });
  expect(state.progress).toBeGreaterThan(0.05);
  expect(state.progress).toBeLessThan(0.95);
  expect(
    Math.abs(state.height - (short + (tall - short) * state.progress))
  ).toBeLessThan(2);
  return state.height;
}

test('content height follows slide animation in both directions and through interruptions', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const carousel = await openStory(
    page,
    'rcarousel--content-sizing',
    'animation.type:duration;animation.duration:1000'
  );
  const short = await quoteHeight(carousel, 'Short content');
  const tall = await quoteHeight(carousel, 'Long content');
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  await next(page).click();
  expect((await carousel.boundingBox())!.height).toBeCloseTo(short, 0);
  await page.clock.runFor(250);
  const growing = await expectHeightAtQuoteProgress(carousel, short, tall);
  await previous(page).click();
  expect((await carousel.boundingBox())!.height).toBeCloseTo(growing, 0);
  await page.clock.runFor(250);
  const reversing = await expectHeightAtQuoteProgress(carousel, short, tall);
  expect(reversing).toBeLessThan(growing);
  await page.clock.runFor(1100);
  expect((await carousel.boundingBox())!.height).toBeCloseTo(short, 0);
  await next(page).click();
  await page.clock.runFor(1100);
  expect((await carousel.boundingBox())!.height).toBeCloseTo(tall, 0);
  await previous(page).click();
  expect((await carousel.boundingBox())!.height).toBeCloseTo(tall, 0);
  await page.clock.runFor(250);
  await expectHeightAtQuoteProgress(carousel, short, tall);
  await page.clock.runFor(1100);
  expect((await carousel.boundingBox())!.height).toBeCloseTo(short, 0);
});

test('content height tracks the pointer during a drag and reversal', async ({
  page,
}) => {
  const carousel = await open(page, 'content-sizing');
  const short = await quoteHeight(carousel, 'Short content');
  const tall = await quoteHeight(carousel, 'Long content');
  const box = (await carousel.boundingBox())!;
  const start = box.x + box.width * 0.85;
  const y = box.y + 50;
  await page.mouse.move(start, y);
  await page.mouse.down();
  await page.mouse.move(start - box.width * 0.3, y, { steps: 8 });
  const first = await expectHeightAtQuoteProgress(carousel, short, tall);
  await page.mouse.move(start - box.width * 0.65, y, { steps: 8 });
  const second = await expectHeightAtQuoteProgress(carousel, short, tall);
  expect(second).toBeGreaterThan(first);
  await page.mouse.move(start - box.width * 0.2, y, { steps: 8 });
  const reversed = await expectHeightAtQuoteProgress(carousel, short, tall);
  expect(reversed).toBeLessThan(second);
  await page.mouse.up();
  await page
    .getByRole('button', { name: 'Short content', exact: true })
    .click();
  await expect
    .poll(async () => Math.abs((await carousel.boundingBox())!.height - short))
    .toBeLessThan(2);
});

for (const [name, reducedMotion, args] of [
  ['reduced motion', 'reduce', ''],
  ['disabled animation', 'no-preference', 'animation:!false'],
  [
    'zero duration',
    'no-preference',
    'animation.type:duration;animation.duration:0',
  ],
] as const) {
  test(`content height settles immediately with ${name}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    const carousel = await openStory(page, 'rcarousel--content-sizing', args);
    const short = await quoteHeight(carousel, 'Short content');
    const tall = await quoteHeight(carousel, 'Long content');
    await next(page).click();
    expect((await carousel.boundingBox())!.height).toBeCloseTo(tall, 0);
    await previous(page).click();
    expect((await carousel.boundingBox())!.height).toBeCloseTo(short, 0);
  });
}

test('infinite loading fetches successive pages without moving the current view or growing the slide pool', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const carousel = await open(
    page,
    'infinite-loading',
    'animation.type:duration;animation.duration:250'
  );
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  const status = page.getByRole('status', { name: 'Loading status' });
  const count = page.getByTestId('loaded-records');
  const spinner = carousel.getByTestId('loading-spinner');
  await expect(count).toHaveText('9 items loaded');
  await expect(visibleSlides(carousel)).toHaveCount(3);
  await expect(spinner).toHaveCount(0);
  await expect(carousel).toHaveAttribute('aria-busy', 'false');
  for (let batch = 0; batch < 3; batch++) {
    for (let step = 0; step < (batch === 0 ? 7 : 6); step++) {
      await next(page).click();
      await page.clock.runFor(300);
    }
    await expect(status).toHaveText('Loading more items…');
    // The visible end card starts one request, even before release.
    await expect(spinner).toBeAttached();
    await expect(carousel).toHaveAttribute('aria-busy', 'true');
    expect(
      await spinner.evaluate((node) => getComputedStyle(node).animationName)
    ).not.toBe('none');
    const visible = visibleSlides(carousel).locator('[data-item-index]');
    const before = await visible.evaluateAll((cards) =>
      cards.map((card) => ({
        id: card.getAttribute('data-item-index'),
        x: card.getBoundingClientRect().x,
      }))
    );
    await page.clock.runFor(600);
    await expect(count).toHaveText(`${9 + batch * 6} items loaded`);
    await page.clock.runFor(400);
    await expect(count).toHaveText(`${15 + batch * 6} items loaded`);
    await expect(spinner).toHaveCount(0);
    await expect(carousel).toHaveAttribute('aria-busy', 'false');
    const after = await visible.evaluateAll((cards) =>
      cards.map((card) => ({
        id: card.getAttribute('data-item-index'),
        x: card.getBoundingClientRect().x,
      }))
    );
    before.forEach((card) => {
      const matching = after.find((item) => item.id === card.id)!;
      expect(Math.abs(matching.x - card.x)).toBeLessThan(0.5);
    });
    await expect(
      carousel.locator(':scope > [data-carousel-slide]')
    ).toHaveCount(9);
    const ids = await carousel
      .locator('[data-item-index]')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-item-index'))
      );
    expect(new Set(ids).size).toBe(ids.length);
  }
});

test('infinite loading completes a response without interrupting current navigation', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const carousel = await openStory(
    page,
    'rcarousel--infinite-loading',
    'defaultIndex:6;animation.type:duration;animation.duration:1500'
  );
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  await next(page).click();
  await page.clock.runFor(300);
  await expect(carousel).toHaveAttribute('aria-busy', 'true');
  const target = carousel.locator('[data-item-index="7"]');
  const before = (await target.boundingBox())!.x;
  const pitch = await target.evaluate(
    (card) =>
      card.closest('[data-carousel-slide]')!.getBoundingClientRect().width
  );
  await page.clock.runFor(1000);
  await expect(page.getByTestId('loaded-records')).toHaveText(
    '15 items loaded'
  );
  expect(
    Math.abs((await target.boundingBox())!.x - (before - (pitch * 1000) / 1500))
  ).toBeLessThan(2);
  await expect(carousel).toHaveAttribute('aria-busy', 'false');
  const afterResponse = (await target.boundingBox())!.x;
  await page.clock.runFor(100);
  const moving = (await target.boundingBox())!.x;
  expect(moving).toBeLessThan(afterResponse - 2);
  expect(moving).toBeGreaterThan((await carousel.boundingBox())!.x + 2);
  await page.clock.runFor(600);
  await expect(
    visibleSlides(carousel).locator('[data-item-index="7"]')
  ).toBeVisible();
  await previous(page).click();
  await page.clock.runFor(1600);
  await expect(
    visibleSlides(carousel).locator('[data-item-index="6"]')
  ).toBeVisible();
});

test('infinite loading fetches successive batches through keyboard navigation with reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
  const carousel = await open(page, 'infinite-loading');
  await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
  const forward = next(page);
  await forward.focus();
  expect(
    await forward.evaluate((button) => getComputedStyle(button).outlineStyle)
  ).toBe('solid');
  for (let index = 0; index < 7; index++) await page.keyboard.press('Enter');
  await expect(forward).toBeDisabled();
  await expect(carousel).toHaveAttribute('aria-busy', 'true');
  const spinner = visibleSlides(carousel).getByTestId('loading-spinner');
  await expect(spinner).toBeInViewport();
  expect(
    await spinner.evaluate((node) => getComputedStyle(node).animationName)
  ).toBe('none');
  await page.clock.runFor(899);
  await expect(page.getByTestId('loaded-records')).toHaveText('9 items loaded');
  await page.clock.runFor(1);
  await expect(page.getByTestId('loaded-records')).toHaveText(
    '15 items loaded'
  );
  await expect(forward).toBeEnabled();
  await forward.focus();
  await expect(forward).toBeFocused();
  for (let index = 0; index < 6; index++) await page.keyboard.press('Enter');
  await expect(forward).toBeDisabled();
  await expect(carousel).toHaveAttribute('aria-busy', 'true');
  await page.clock.runFor(1000);
  await expect(page.getByTestId('loaded-records')).toHaveText(
    '21 items loaded'
  );
  await expect(visibleSlides(carousel)).toHaveCount(3);
  await expect(
    visibleSlides(carousel).locator('[data-item-index="13"]')
  ).toBeVisible();
  await expect(carousel.locator(':scope > [data-carousel-slide]')).toHaveCount(
    9
  );
});

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const dragMode of ['snap', 'free'] as const) {
    test(`infinite loading finishes during a held ${axis} ${dragMode} drag and preserves pointer movement`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 900, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
      const carousel = await open(
        page,
        'infinite-loading',
        `axis:${axis};dragMode:${dragMode};defaultIndex:6;crossAxisSize:container`
      );
      await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
      await expect(page.getByTestId('loaded-records')).toHaveText(
        '9 items loaded'
      );
      const box = (await carousel.boundingBox())!;
      const vertical = axis === 'vertical';
      const x = box.x + box.width * (vertical ? 0.5 : 0.8);
      const y = box.y + box.height * (vertical ? 0.8 : 0.5);
      const distance = ((vertical ? box.height : box.width) / 3) * 1.7;
      const endX = x - (vertical ? 0 : distance);
      const endY = y - (vertical ? distance : 0);
      await page.mouse.move(x, y);
      await page.mouse.down();
      // Reach beyond the old finite end without releasing the pointer.
      await page.mouse.move(endX, endY, { steps: 12 });
      await expect(carousel.getByTestId('loading-spinner')).toBeInViewport();
      await expect(
        page.getByRole('status', { name: 'Loading status' })
      ).toHaveText('Loading more items…');
      const anchor = carousel.locator('[data-item-index="8"]');
      const coordinate = async () =>
        (await anchor.boundingBox())![vertical ? 'y' : 'x'];
      const before = await coordinate();
      await page.clock.runFor(1000);
      await expect(page.getByTestId('loaded-records')).toHaveText(
        '15 items loaded'
      );
      await expect(carousel).toHaveAttribute('aria-busy', 'false');
      await expect(carousel.getByTestId('loading-spinner')).toHaveCount(0);
      expect(Math.abs((await coordinate()) - before)).toBeLessThan(0.5);
      // The same held pointer keeps moving from the displayed position. Old
      // edge resistance must not turn into a jump when the bounds expand.
      await page.mouse.move(
        endX - (vertical ? 0 : 12),
        endY - (vertical ? 12 : 0)
      );
      expect(await coordinate()).toBeCloseTo(before - 12, 0);
      await page.mouse.up();
      await expect(next(page)).toBeEnabled();
      const settled = await coordinate();
      await next(page).click();
      expect(await coordinate()).toBeLessThan(settled - 2);
      await expect(
        carousel.locator(':scope > [data-carousel-slide]')
      ).toHaveCount(9);
    });
  }
}

for (const axis of ['horizontal', 'vertical'] as const) {
  test(`infinite loading preserves a caught ${axis} drag when the next batch arrives`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
    const carousel = await open(
      page,
      'infinite-loading',
      `axis:${axis};dragMode:free-snap;defaultIndex:6;crossAxisSize:container`
    );
    await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
    await expect(page.getByTestId('loaded-records')).toHaveText(
      '9 items loaded'
    );
    const box = (await carousel.boundingBox())!;
    const vertical = axis === 'vertical';
    const actor = (await carousel
      .locator(':scope > [data-carousel-slide]')
      .first()
      .boundingBox())!;
    const pitch = vertical ? actor.height : actor.width;
    const x = box.x + box.width * (vertical ? 0.5 : 0.8);
    const y = box.y + box.height * (vertical ? 0.8 : 0.5);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x - (vertical ? 0 : pitch * 1.7),
      y - (vertical ? pitch * 1.7 : 0),
      { steps: 12 }
    );
    await expect(
      page.getByRole('status', { name: 'Loading status' })
    ).toHaveText('Loading more items…');
    await page.clock.runFor(150);
    await page.mouse.up();
    await page.clock.runFor(16);
    await page.mouse.move(x, y);
    await page.mouse.down();
    const anchor = carousel.locator('[data-item-index="8"]');
    const coordinate = async () =>
      (await anchor.boundingBox())![vertical ? 'y' : 'x'];
    const before = await coordinate();
    await page.clock.runFor(1000);
    await expect(page.getByTestId('loaded-records')).toHaveText(
      '15 items loaded'
    );
    expect(await coordinate()).toBeCloseTo(before, 0);
    await page.mouse.move(x - (vertical ? 0 : 12), y - (vertical ? 12 : 0));
    expect(await coordinate()).toBeCloseTo(before - 12, 0);
    await page.mouse.up();
    await page.clock.runFor(1400);
    await expect(visibleSlides(carousel)).toHaveCount(3);
    await expect(next(page)).toBeEnabled();
  });

  test(`infinite loading replaces its ${axis} loading card without shifting the current view`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date('2026-10-31T00:00:00Z') });
    const carousel = await open(
      page,
      'infinite-loading',
      `axis:${axis};crossAxisSize:container`
    );
    await page.clock.pauseAt(new Date('2026-10-31T00:01:00Z'));
    for (let index = 0; index < 7; index++) await next(page).click();
    await expect(next(page)).toBeDisabled();
    await expect(visibleSlides(carousel)).toHaveCount(3);
    const loadingCard = visibleSlides(carousel).getByTestId('loading-card');
    const spinner = loadingCard.getByTestId('loading-spinner');
    await expect(loadingCard).toBeInViewport();
    await expect(spinner).toBeInViewport();
    const loadingBox = (await loadingCard.boundingBox())!;
    await expect(
      page.getByRole('status', { name: 'Loading status' })
    ).toHaveText('Loading more items…');
    await expect(
      visibleSlides(carousel).locator('[data-item-index="8"]')
    ).toBeVisible();
    await page.clock.runFor(1000);
    await expect(page.getByTestId('loaded-records')).toHaveText(
      '15 items loaded'
    );
    await expect(page.getByTestId('loading-spinner')).toHaveCount(0);
    const replacement = visibleSlides(carousel).locator(
      '[data-item-index="9"]'
    );
    await expect(replacement).toBeVisible();
    await expect
      .poll(async () => {
        const box = (await replacement.boundingBox())!;
        return Math.max(
          Math.abs(box.x - loadingBox.x),
          Math.abs(box.y - loadingBox.y)
        );
      })
      .toBeLessThan(1);
    await expect(
      visibleSlides(carousel).locator('[data-item-index="8"]')
    ).toBeVisible();
    await expect(next(page)).toBeEnabled();
    await next(page).click();
    await expect(
      visibleSlides(carousel).locator('[data-item-index="9"]')
    ).toBeVisible();
  });
}

const publicStories = [
  'basic',
  'controlled',
  'pagination',
  'loop',
  'inspiration',
  'multiple-slides',
  'scroll-step',
  'gallery',
  'responsive',
  'breakpoints',
  'vertical',
  'free-flow',
  'wheel-browsing',
  'vertical-scroll',
  'content-sizing',
  'field-notes',
  'fixed-height',
  'spring-animation',
  'duration-animation',
  'large-jumps',
  'infinite-loading',
  'time-picker',
];

for (const width of [1280, 390]) {
  test(`public demos fit a ${width}px viewport without runtime errors or remote media`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const failures: string[] = [];
    const externalMedia: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('request', (request) => {
      if (
        ['image', 'font'].includes(request.resourceType()) &&
        !['localhost', '127.0.0.1'].includes(new URL(request.url()).hostname)
      )
        externalMedia.push(request.url());
    });
    for (const story of publicStories) {
      const carousel = await open(page, story);
      await expect(visibleSlides(carousel).first()).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        ),
        story
      ).toBe(true);
    }
    expect(failures).toEqual([]);
    expect(externalMedia).toEqual([]);
  });
}
