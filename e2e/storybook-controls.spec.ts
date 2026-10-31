import { expect, test, type Page } from '@playwright/test';
import { openStory } from './helpers/story.js';

async function publicStories(page: Page): Promise<string[]> {
  const response = await page.request.get('/index.json');
  const index = await response.json();
  return Object.values(
    index.entries as Record<string, { id: string; title: string; type: string }>
  )
    .filter((story) => story.title === 'RCarousel' && story.type === 'story')
    .map((story) => story.id);
}

const controlRow = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });

async function openControls(page: Page, story: string) {
  await page.goto(`/?path=/story/${story}`);
  await page
    .frameLocator('#storybook-preview-iframe')
    .getByTestId('carousel')
    .waitFor();
  await page.getByRole('tab', { name: /Controls/ }).click();
  await expect(controlRow(page, 'mode')).toBeVisible();
  return page.frameLocator('#storybook-preview-iframe').getByTestId('carousel');
}

test('every public story exposes the full configuration Controls panel', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stories = await publicStories(page);
  expect(stories.length).toBeGreaterThan(0);
  for (const story of stories) {
    await openControls(page, story);
    for (const name of [
      'mode',
      'axis',
      'slidesPerView',
      'slidesToScroll',
      'gap',
      'snapAlign',
      'insetStart',
      'insetEnd',
      'maxSlideSize',
      'trimEnd',
      'drag',
      'dragMode',
      'wheel',
      'swipeThreshold',
      'crossAxisSize',
      'slideAlign',
      'animation',
      'breakpoints',
      'breakpointsBase',
      'index',
      'absoluteIndex',
      'defaultIndex',
      'defaultAbsoluteIndex',
      'style',
      'slideStyle',
      'className',
      'slideClassName',
    ]) {
      await expect(controlRow(page, name), `${story}: ${name}`).toBeVisible();
    }
    await expect(
      page.getByText('This story has no controls', { exact: true })
    ).toHaveCount(0);
  }
});

test('every public demo honors shared layout, wheel, mode, and styling overrides', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const stories = await publicStories(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const story of stories) {
    const carousel = await openStory(
      page,
      story,
      [
        'axis:vertical',
        'mode:loop',
        'slidesPerView:2',
        'maxSlideSize:!undefined',
        'breakpoints:!undefined',
        'crossAxisSize:container',
        'gap:24',
        'snapAlign:start',
        'insetStart:0px',
        'insetEnd:0px',
        'dragMode:free',
        'wheel:true',
        'animation:!false',
        'style.height:360',
        'className:control-root',
        'slideClassName:control-slide',
      ].join(';')
    );
    await expect(carousel, story).toHaveCSS('height', '360px');
    await expect(carousel, story).toHaveClass(/control-root/);
    const actors = carousel.locator(':scope > [data-carousel-slide]');
    await expect(
      carousel.locator(':scope > [data-carousel-slide]:not([inert])'),
      story
    ).toHaveCount(2);
    await expect(actors.first(), story).toHaveCSS('height', '192px');
    await expect(actors.first(), story).toHaveCSS('padding-bottom', '24px');
    await expect(
      carousel.locator('.control-slide').first(),
      story
    ).toBeAttached();
    await carousel.dispatchEvent('wheel', { deltaY: -72, cancelable: true });
    await expect
      .poll(
        () =>
          actors.first().evaluate((actor) => {
            const transform = new DOMMatrixReadOnly(
              getComputedStyle(actor).transform
            );
            const position =
              transform.m42 / actor.getBoundingClientRect().height;
            return Math.abs(position - Math.round(position));
          }),
        { message: story }
      )
      .toBeGreaterThan(0.2);
  }
  expect(errors).toEqual([]);
});

test('live Controls update axis, navigation mode, and spacing', async ({
  page,
}) => {
  const carousel = await openControls(page, 'rcarousel--controlled');
  await controlRow(page, 'axis')
    .getByRole('radio', { name: 'vertical', exact: true })
    .check();
  await expect(carousel).toHaveCSS('height', '320px');
  const next = page
    .frameLocator('#storybook-preview-iframe')
    .getByRole('button', { name: 'Next slide', exact: true });
  await expect(next.locator('svg')).toHaveAttribute('style', /rotate\(90deg\)/);
  await controlRow(page, 'mode').getByRole('combobox').selectOption('loop');
  await expect(
    page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('button', { name: 'Previous slide', exact: true })
  ).toBeEnabled();
  await controlRow(page, 'gap').getByRole('spinbutton').fill('40');
  await expect(
    carousel.locator(':scope > [data-carousel-slide]').first()
  ).toHaveCSS('padding-bottom', '40px');
});

test('initial position Controls remount while keeping the rendered-slot readout connected', async ({
  page,
}) => {
  const carousel = await openControls(page, 'rcarousel--large-jumps');
  const position = controlRow(page, 'defaultIndex');
  await position
    .getByRole('button', { name: 'Set number', exact: true })
    .click();
  await position.getByRole('spinbutton').fill('950');
  const preview = page.frameLocator('#storybook-preview-iframe');
  await expect(preview.getByTestId('slide-number')).toHaveText('951');
  // The slot readout must observe the replacement viewport after remounting.
  await controlRow(page, 'insetStart').getByRole('textbox').fill('200px');
  const pool = carousel.locator(':scope > [data-carousel-slide]');
  await expect
    .poll(
      async () =>
        Number(await preview.getByTestId('slot-count').textContent()) ===
        (await pool.count())
    )
    .toBe(true);
  await expect.poll(() => pool.count()).toBeGreaterThan(3);
});

test('numeric and auto slide counts remain editable across presets', async ({
  page,
}) => {
  for (const [story, args] of [
    ['basic', 'slidesPerView:auto;maxSlideSize:280px'],
    ['responsive', 'slidesPerView:3;maxSlideSize:!undefined'],
  ]) {
    const carousel = await openStory(page, `rcarousel--${story}`, args);
    await expect(
      carousel.locator(':scope > [data-carousel-slide]:not([inert])')
    ).not.toHaveCount(0);
    if (story === 'responsive')
      await expect(
        carousel.locator(':scope > [data-carousel-slide]:not([inert])')
      ).toHaveCount(3);
    else {
      const sizes = await carousel
        .locator(':scope > [data-carousel-slide]:not([inert])')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width)
        );
      expect(Math.max(...sizes)).toBeLessThanOrEqual(280);
    }
  }
});
