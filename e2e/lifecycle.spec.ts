import { expect, test, type Locator, type Page } from '@playwright/test';

const open = async (page: Page, story: string) => {
  await page.goto(
    `/iframe.html?id=regression-lifecycle--${story}&viewMode=story`
  );
  const carousel = page.getByTestId('lifecycle-carousel');
  await expect(carousel.getByRole('button').first()).toBeVisible();
  const box = await carousel.boundingBox();
  if (!box) throw new Error('Missing carousel layout');
  return { carousel, box };
};

const position = (carousel: Locator, index: number) =>
  carousel.evaluate((element, itemIndex) => {
    const actor = [...element.children].find(
      (child) => child.textContent === `Item ${itemIndex}`
    );
    return actor
      ? actor.getBoundingClientRect().left -
          element.getBoundingClientRect().left
      : Infinity;
  }, index);

for (const [story, initial, expected] of [
  ['positive-count-removal', 5, 3],
  ['negative-count-removal', -1, -1],
  ['forward-count-removal', 5, 3],
] as const) {
  test(`${story}: removing the selected item preserves its cycle and requests correction once`, async ({
    page,
  }) => {
    const { carousel } = await open(page, story);
    await expect(page.getByTestId('lifecycle-cursor')).toHaveText(
      String(initial)
    );
    await expect(
      carousel.getByRole('button', { name: 'Item 2', exact: true })
    ).toBeVisible();
    await page.getByTestId('lifecycle-remove').click();
    await expect(page.getByTestId('lifecycle-cursor')).toHaveText(
      String(expected)
    );
    await expect(
      carousel.getByRole('button', { name: 'Item 1', exact: true })
    ).toBeVisible();
    const correction = { cursor: expected, reason: 'slides-change' };
    await expect(page.getByTestId('lifecycle-requests')).toHaveText(
      JSON.stringify([correction])
    );
    await page.getByTestId('lifecycle-next').click();
    await expect(page.getByTestId('lifecycle-cursor')).toHaveText(
      String(expected + 1)
    );
    await expect(
      carousel.getByRole('button', { name: 'Item 0', exact: true })
    ).toBeVisible();
    await expect(page.getByTestId('lifecycle-requests')).toHaveText(
      JSON.stringify([correction, { cursor: expected + 1, reason: 'api' }])
    );
  });
}

test('a count correction cancels the old drag and rebases the next swipe', async ({
  page,
}) => {
  const { carousel, box } = await open(page, 'count-correction');
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('100');
  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 50, { steps: 4 });
  await page
    .getByTestId('lifecycle-append')
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('133');
  await page.mouse.move(box.x + 30, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('lifecycle-requests')).toHaveText(
    JSON.stringify([{ cursor: 133, reason: 'slides-change' }])
  );
  await expect
    .poll(async () => Math.abs(await position(carousel, 1)))
    .toBeLessThan(1);

  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('134');
  await expect(page.getByTestId('lifecycle-requests')).toHaveText(
    JSON.stringify([
      { cursor: 133, reason: 'slides-change' },
      { cursor: 134, reason: 'drag' },
    ])
  );
  await expect(
    carousel.getByRole('button', { name: 'Item 2', exact: true })
  ).toBeVisible();
  await expect
    .poll(async () => Math.abs(await position(carousel, 2)))
    .toBeLessThan(1);
});

test('Suspense hide and reveal settles the active target and restores interaction', async ({
  page,
}) => {
  const { carousel } = await open(page, 'suspense-reattachment');
  await page.getByTestId('lifecycle-next').click();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('1');
  await expect
    .poll(async () => {
      const left = await position(carousel, 1);
      return left > 5 && left < 295;
    })
    .toBe(true);
  await page.getByTestId('lifecycle-hide').click();
  await expect(page.getByTestId('lifecycle-fallback')).toBeVisible();
  await expect(carousel).toBeHidden();
  await page.getByTestId('lifecycle-reveal').click();
  await expect(page.getByTestId('lifecycle-fallback')).toHaveCount(0);
  const active = carousel.getByRole('button', {
    name: 'Item 1',
    exact: true,
  });
  await expect(active).toBeVisible();
  await expect
    .poll(async () => Math.abs(await position(carousel, 1)))
    .toBeLessThan(1);
  await active.click();
  await expect(page.getByTestId('lifecycle-clicks')).toHaveText('1');
  await page.getByTestId('lifecycle-next').click();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('2');
  await expect(
    carousel.getByRole('button', { name: 'Item 2', exact: true })
  ).toBeVisible();
});

test('configuration changes cancel pointer-down before delayed gesture activation', async ({
  page,
}) => {
  const { carousel, box } = await open(page, 'delayed-gesture-cancellation');
  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  // This configuration commit happens before any movement can establish intent.
  await page
    .getByTestId('lifecycle-configure')
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.move(box.x + 30, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('0');
  await expect(page.getByTestId('lifecycle-requests')).toHaveText('[]');
  await expect
    .poll(async () => Math.abs(await position(carousel, 0)))
    .toBeLessThan(1);

  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  // A short qualifying swipe isolates cancellation from multi-slide snapping.
  await page.mouse.move(box.x + 150, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('1');
  await expect(page.getByTestId('lifecycle-requests')).toHaveText(
    JSON.stringify([{ cursor: 1, reason: 'drag' }])
  );
  await expect(
    carousel.getByRole('button', { name: 'Item 1', exact: true })
  ).toBeVisible();
  await expect
    .poll(async () => Math.abs(await position(carousel, 1)))
    .toBeLessThan(1);

  // Changing collection bounds also invalidates an already active drag.
  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 50, { steps: 4 });
  await page
    .getByTestId('lifecycle-mode')
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.mouse.move(box.x + 30, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('1');
  await expect(page.getByTestId('lifecycle-requests')).toHaveText(
    JSON.stringify([{ cursor: 1, reason: 'drag' }])
  );

  await page.mouse.move(box.x + 270, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 50, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByTestId('lifecycle-cursor')).toHaveText('2');
  await expect(page.getByTestId('lifecycle-requests')).toHaveText(
    JSON.stringify([
      { cursor: 1, reason: 'drag' },
      { cursor: 2, reason: 'drag' },
    ])
  );
  await expect(
    carousel.getByRole('button', { name: 'Item 2', exact: true })
  ).toBeVisible();
});
