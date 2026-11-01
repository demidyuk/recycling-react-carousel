import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, story: string, args = '') => {
  await page.goto(
    `/iframe.html?id=regression-interactions--${story}&viewMode=story&args=${args}`
  );
  await expect(page.getByTestId('interaction-cursor')).toBeVisible();
  return page.getByTestId('interaction-carousel');
};

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const kind of ['buttons', 'links', 'images']) {
    for (const animation of ['spring', 'duration']) {
      test(`${axis} ${kind} accept clicks on entering and leaving cards during ${animation} animation`, async ({
        page,
        isMobile,
      }) => {
        await page.clock.install({ time: new Date('2026-11-01T00:00:00Z') });
        const root = await open(
          page,
          kind,
          `axis:${axis};animation.type:${animation}`
        );
        await page.clock.pauseAt(new Date('2026-11-01T00:01:00Z'));
        await page.getByTestId('interaction-next').click();
        await page.clock.runFor(animation === 'spring' ? 64 : 175);
        await expect(page.getByTestId('interaction-moving')).toHaveText('true');

        const viewport = (await root.boundingBox())!;
        for (const [index, name] of ['leaving', 'entering'].entries()) {
          const card = root.locator('[data-carousel-slide]').filter({
            has:
              kind === 'images'
                ? page.getByRole('img', { name: `Image ${index}`, exact: true })
                : page.getByText(`Item ${index}`, { exact: true }),
          });
          await expect(card, name).not.toHaveAttribute('inert');
          await expect(card, name).not.toHaveAttribute('aria-hidden');
          const box = (await card.locator('button, a, img').boundingBox())!;
          const left = Math.max(box.x, viewport.x);
          const right = Math.min(
            box.x + box.width,
            viewport.x + viewport.width
          );
          const top = Math.max(box.y, viewport.y);
          const bottom = Math.min(
            box.y + box.height,
            viewport.y + viewport.height
          );
          expect(right - left, name).toBeGreaterThan(0);
          expect(bottom - top, name).toBeGreaterThan(0);
          // Native coordinates bypass Locator.click's animation stability wait.
          if (isMobile)
            await page.touchscreen.tap((left + right) / 2, (top + bottom) / 2);
          else await page.mouse.click((left + right) / 2, (top + bottom) / 2);
          await expect(page.getByTestId('interaction-clicks')).toHaveText(
            String(index + 1)
          );
          await expect(page.getByTestId('interaction-moving')).toHaveText(
            'true'
          );
          await expect(page.getByTestId('interaction-cursor')).toHaveText('1');
        }
        if (kind === 'links') expect(new URL(page.url()).hash).toBe('#item-1');
        expect(
          await root.evaluate((node) => [node.scrollLeft, node.scrollTop])
        ).toEqual([0, 0]);
        await page.clock.runFor(2000);
        await expect(page.getByTestId('interaction-moving')).toHaveText(
          'false'
        );
        await expect(
          root.locator('[data-carousel-slide][inert]')
        ).not.toHaveCount(0);
      });
    }
  }
}

const beginDrag = async (page: Page) => {
  const box = await page.getByTestId('interaction-carousel').boundingBox();
  if (!box) throw new Error('Missing carousel layout');
  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 50, { steps: 4 });
  return box;
};

test('keyboard skips buffers without changing native scroll offsets', async ({
  page,
  browserName,
}) => {
  const carousel = await open(page, 'keyboard');
  await expect(
    carousel.getByRole('button', { name: 'Item 1', exact: true })
  ).toBeVisible();
  await page.getByTestId('before').focus();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(
    carousel.getByRole('button', { name: 'Item 1', exact: true })
  ).toBeFocused();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByTestId('after')).toBeFocused();
  expect(
    await carousel.evaluate((element) => [
      element.scrollLeft,
      element.scrollTop,
    ])
  ).toEqual([0, 0]);
  await expect(page.getByTestId('interaction-cursor')).toHaveText('1');
});

test('swiping a button suppresses its click while clicks and keyboard activation still work', async ({
  page,
}) => {
  const carousel = await open(page, 'buttons');
  const box = await beginDrag(page);
  await page.mouse.move(box.x + 30, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('interaction-cursor')).toHaveText('1');
  await expect(page.getByTestId('interaction-clicks')).toHaveText('0');
  await expect(page.getByTestId('interaction-root-clicks')).toHaveText('0');
  await expect(page.getByTestId('interaction-pointer-downs')).toHaveText('1');
  const active = carousel.getByRole('button', { name: 'Item 1', exact: true });
  await active.click();
  await expect(page.getByTestId('interaction-clicks')).toHaveText('1');
  await active.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('interaction-clicks')).toHaveText('2');
});

for (const dragMode of ['snap', 'free', 'free-snap']) {
  test(`${dragMode} blocks the drag's click and accepts a fresh click before settling`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-01T00:00:00Z') });
    const root = await open(page, 'buttons', `dragMode:${dragMode}`);
    await page.clock.pauseAt(new Date('2026-11-01T00:01:00Z'));
    const box = await beginDrag(page);
    await page.clock.runFor(16);
    await page.mouse.move(box.x + 80, box.y + 50);
    await page.clock.runFor(16);
    await page.mouse.up();
    await expect(page.getByTestId('interaction-clicks')).toHaveText('0');
    await expect(page.getByTestId('interaction-root-clicks')).toHaveText('0');
    await expect(page.getByTestId('interaction-moving')).toHaveText('true');
    await page.mouse.click(box.x + 180, box.y + 50);
    await expect(page.getByTestId('interaction-clicks')).toHaveText('1');
    await expect(page.getByTestId('interaction-root-clicks')).toHaveText('1');
    expect(
      await root.evaluate((node) => [node.scrollLeft, node.scrollTop])
    ).toEqual([0, 0]);
  });
}

for (const kind of ['images', 'links']) {
  test(`native ${kind} drag does not take over the carousel`, async ({
    page,
  }) => {
    await open(page, kind);
    const box = await beginDrag(page);
    await page.mouse.move(box.x + 30, box.y + 50, { steps: 20 });
    await page.mouse.up();
    await expect(page.getByTestId('interaction-cursor')).toHaveText('1');
    await expect(page.getByTestId('interaction-clicks')).toHaveText('0');
    expect(new URL(page.url()).hash).toBe('');
  });
}

test('gesture disabling during pointer-down does not freeze controlled navigation', async ({
  page,
}) => {
  const carousel = await open(page, 'buttons');
  await beginDrag(page);
  await page
    .getByTestId('interaction-drag-enabled')
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.up();
  await page.getByTestId('interaction-next').click();
  await expect(page.getByTestId('interaction-cursor')).toHaveText('1');
  await expect(
    carousel.getByRole('button', { name: 'Item 1', exact: true })
  ).toBeVisible();
  await expect
    .poll(() =>
      carousel.evaluate((element) => {
        const item = [...element.children].find(
          (actor) => actor.textContent === 'Item 1'
        );
        return item
          ? Math.abs(
              item.getBoundingClientRect().left -
                element.getBoundingClientRect().left
            )
          : Infinity;
      })
    )
    .toBeLessThan(1);
});

test('resizing during pointer-down cancels the old gesture and preserves later navigation', async ({
  page,
}) => {
  const carousel = await open(page, 'buttons');
  await beginDrag(page);
  await page
    .getByTestId('interaction-visible')
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.up();
  await expect(page.getByTestId('interaction-cursor')).toHaveText('0');
  await page.getByTestId('interaction-next').click();
  await expect(
    carousel.getByRole('button', { name: 'Item 1', exact: true })
  ).toBeVisible();
  await expect(
    carousel.getByRole('button', { name: 'Item 2', exact: true })
  ).toBeVisible();
});

test('autosize stays short after the tall actor is recycled', async ({
  page,
}) => {
  const carousel = await open(page, 'content-size');
  await expect(carousel).toHaveCSS('height', '400px');
  for (let index = 0; index < 3; index += 1) {
    await page
      .getByTestId('interaction-next')
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByTestId('interaction-cursor')).toHaveText(
      String(index + 1)
    );
  }
  await expect(page.getByTestId('interaction-cursor')).toHaveText('3');
  await expect(carousel.locator(':scope > div')).toHaveCount(3);
  await expect(carousel).toHaveCSS('height', '100px');
});

test('hidden initialization preserves the requested forward-loop cursor', async ({
  page,
}) => {
  const carousel = await open(page, 'hidden-initialization');
  await expect(page.getByTestId('interaction-cursor')).toHaveText('100');
  await expect(page.getByTestId('interaction-next')).toBeDisabled();
  await page.getByTestId('interaction-toggle-hidden').click();
  await expect(
    carousel.getByRole('button', { name: 'Item 1', exact: true })
  ).toBeVisible();
  await expect(page.getByTestId('interaction-cursor')).toHaveText('100');
  await expect(page.getByTestId('interaction-next')).toBeEnabled();
  await page.getByTestId('interaction-toggle-hidden').click();
  await page.getByTestId('interaction-toggle-hidden').click();
  await expect(page.getByTestId('interaction-cursor')).toHaveText('100');
});
