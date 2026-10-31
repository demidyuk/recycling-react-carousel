import { expect, test, type Locator, type Page } from '@playwright/test';

const openApi = async (page: Page, source: string) => {
  await page.goto(`/iframe.html?id=regression-api--${source}&viewMode=story`);
  const carousel = page.getByTestId('api-carousel');
  await expect(carousel).toHaveCSS('height', '136px');
  return carousel;
};
const drag = async (page: Page, target: Locator, distance = 180) => {
  const box = await target.boundingBox();
  if (!box) throw new Error('Missing drag target');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.8 - distance,
    box.y + box.height / 2,
    { steps: 12 }
  );
  await page.mouse.up();
};

for (const source of ['contract', 'items']) {
  test.describe(source, () => {
    const open = (page: Page) => openApi(page, source);

    test('controller button getters work inside forms and respect cancelled click handlers', async ({
      page,
    }) => {
      const carousel = await open(page);
      const next = page.getByRole('button', { name: 'API next', exact: true });
      await expect(next).toHaveAttribute(
        'aria-controls',
        (await carousel.getAttribute('id')) as string
      );
      await next.click();
      await expect(page.getByTestId('api-index')).toHaveText('1');
      await expect(page.getByTestId('api-settled')).toHaveText('1');
      await page.getByRole('button', { name: 'Cancel next' }).click();
      await expect(page.getByTestId('api-index')).toHaveText('1');
      await expect(page.getByTestId('api-submissions')).toHaveText('0');
    });

    test('container resizing changes both buttons and swipe steps without a window resize', async ({
      page,
    }) => {
      const carousel = await open(page);
      const windowWidth = page.viewportSize()!.width;
      await page.getByRole('button', { name: 'Resize container' }).click();
      await expect(carousel.locator(':scope > div')).toHaveCount(6);
      await page.getByRole('button', { name: 'API next', exact: true }).click();
      await expect(page.getByTestId('api-index')).toHaveText('2');
      await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
        2
      );
      await drag(page, carousel, 300);
      await expect(page.getByTestId('api-index')).toHaveText('4');
      expect(page.viewportSize()!.width).toBe(windowWidth);
    });

    test('default content sizing grows, shrinks, and includes slide padding', async ({
      page,
    }) => {
      const carousel = await open(page);
      await page.getByRole('button', { name: 'Tall content' }).click();
      await expect(page.getByTestId('api-index')).toHaveText('3');
      await expect(carousel).toHaveCSS('height', '256px');
      await page.getByRole('button', { name: 'API next', exact: true }).click();
      await expect(carousel).toHaveCSS('height', '136px');
    });

    test('editable controls, no-drag regions, and preventDefault preserve interaction', async ({
      page,
    }) => {
      const carousel = await open(page);
      await drag(page, page.getByRole('textbox', { name: 'Quantity 0' }), 80);
      await expect(page.getByTestId('api-index')).toHaveText('0');
      await drag(page, page.getByRole('button', { name: 'No drag 0' }), 80);
      await expect(page.getByTestId('api-index')).toHaveText('0');
      await page.getByRole('button', { name: 'Cancel dragging' }).click();
      await drag(page, carousel);
      await expect(page.getByTestId('api-index')).toHaveText('0');
    });

    test('a completed drag does not block later clicks on excluded controls', async ({
      page,
    }) => {
      const carousel = await open(page);
      await drag(page, carousel);
      await expect(page.getByTestId('api-index')).toHaveText('1');
      await expect(page.getByTestId('api-actions')).toHaveText('0');
      await carousel.getByRole('button', { name: 'No drag 1' }).click();
      await expect(page.getByTestId('api-actions')).toHaveText('1');
      await carousel.getByRole('textbox', { name: 'Quantity 1' }).click();
      await expect(page.getByTestId('api-actions')).toHaveText('2');
      await expect(page.getByTestId('api-index')).toHaveText('1');
    });

    test('content alignment is independent of the viewport height', async ({
      page,
    }) => {
      const carousel = await open(page);
      await page.getByRole('button', { name: 'Resize container' }).click();
      await page.getByRole('button', { name: 'Tall content' }).click();
      await expect(carousel.locator(':scope > div:not([inert])')).toHaveCount(
        2
      );
      await expect(carousel).toHaveCSS('height', '256px');
      await page.getByRole('button', { name: 'Center content' }).click();
      const offset = (end: boolean) =>
        carousel.evaluate((root, alignEnd) => {
          const viewport = root.getBoundingClientRect();
          const card = root
            .querySelector('[data-api-index="4"]')!
            .getBoundingClientRect();
          return alignEnd
            ? viewport.bottom - card.bottom
            : Math.abs(
                (viewport.top + viewport.bottom - card.top - card.bottom) / 2
              );
        }, end);
      await expect.poll(() => offset(false)).toBeLessThan(1);
      await page.getByRole('button', { name: 'End content' }).click();
      await expect.poll(() => offset(true)).toBeCloseTo(8, 0);
    });
  });
}

test('vertical content sizing measures intrinsic widths and can shrink again', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=regression-api--vertical-content&viewMode=story'
  );
  const carousel = page.getByTestId('vertical-content');
  await expect(carousel).toHaveCSS('height', '200px');
  await expect(carousel).toHaveCSS('width', '120px');
  await page.getByRole('button', { name: 'Vertical next' }).click();
  await expect(carousel).toHaveCSS('width', '240px');
  await page.getByRole('button', { name: 'Vertical previous' }).click();
  await expect(carousel).toHaveCSS('width', '120px');
});

const openPagination = async (page: Page) => {
  await page.goto('/iframe.html?id=regression-api--pagination&viewMode=story');
  await expect(page.getByTestId('pagination-page')).toHaveText('1/3');
  return page.locator('#pagination-carousel');
};

test('consumer pagination buttons support native keyboard activation and retain focus without submitting forms', async ({
  page,
}) => {
  await openPagination(page);
  const first = page.getByRole('button', { name: 'Go to page 1 of 3' });
  await expect(first).toHaveAttribute('aria-current', 'page');
  await expect(first).toHaveAttribute('aria-disabled', 'true');
  // aria-disabled keeps the selected button in the native tab sequence.
  expect(
    await first.evaluate((button: HTMLButtonElement) => button.disabled)
  ).toBe(false);
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pagination-requests')).toHaveText('0');
  await expect(first).toBeFocused();
  const second = page.getByRole('button', { name: 'Go to page 2 of 3' });
  // Focus explicitly: native Tab traversal depends on the browser's keyboard settings.
  await second.focus();
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pagination-index')).toHaveText('3');
  await expect(second).toHaveAttribute('aria-current', 'page');
  await expect(second).toBeFocused();
  await page.getByRole('button', { name: 'Cancel page' }).click();
  await expect(page.getByTestId('pagination-index')).toHaveText('3');
  await expect(
    page.getByRole('button', { name: 'Disabled page' })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Go to page 3 of 3' }).click();
  await expect(page.getByTestId('pagination-index')).toHaveText('5');
  await expect(page.getByTestId('pagination-page')).toHaveText('3/3');
  await expect(page.getByTestId('pagination-submissions')).toHaveText('0');
  await expect(second).toHaveAttribute('aria-controls', 'pagination-carousel');
});

test('pagination updates for step-only breakpoints, resizing, and collection changes', async ({
  page,
}) => {
  const carousel = await openPagination(page);
  await expect(carousel.locator(':scope > div')).toHaveCount(9);
  await page.getByRole('button', { name: 'Change pagination step' }).click();
  await expect(page.getByTestId('pagination-page')).toHaveText('1/6');
  await expect(carousel.locator(':scope > div')).toHaveCount(9);
  await page.getByRole('button', { name: 'Go to page 5 of 6' }).click();
  await expect(page.getByTestId('pagination-index')).toHaveText('4');
  await page
    .getByRole('button', { name: 'Resize pagination', exact: true })
    .click();
  await expect(page.getByTestId('pagination-page')).toHaveText('5/5');
  await expect(carousel.locator(':scope > div')).toHaveCount(12);
  await page
    .getByRole('button', { name: 'Shrink pagination collection' })
    .click();
  await expect(page.getByTestId('pagination-page')).toHaveText('1/1');
  await expect(page.getByTestId('pagination-index')).toHaveText('0');
});

for (const mode of ['loop', 'forward-loop']) {
  test(`${mode} pagination chooses the nearest reachable occurrence`, async ({
    page,
  }) => {
    await openPagination(page);
    await page.getByLabel('Pagination mode').selectOption(mode);
    await page.getByRole('button', { name: 'Go to page 3 of 3' }).click();
    await expect(page.getByTestId('pagination-absolute-index')).toHaveText(
      mode === 'loop' ? '-2' : '6'
    );
    await expect(page.getByTestId('pagination-page')).toHaveText('3/3');
    await page.getByRole('button', { name: 'Jump pagination cycle' }).click();
    await expect(page.getByTestId('pagination-page')).toHaveText('2/3');
    await page.getByRole('button', { name: 'Go to page 1 of 3' }).click();
    await expect(page.getByTestId('pagination-absolute-index')).toHaveText(
      '104'
    );
    await expect(page.getByTestId('pagination-page')).toHaveText('1/3');
  });
}

test('consumer page windows and recycled slide containers stay bounded for large collections', async ({
  page,
}) => {
  const carousel = await openPagination(page);
  await page
    .getByRole('button', { name: 'Large pagination collection' })
    .click();
  const pages = page
    .getByRole('group', { name: 'Choose a page' })
    .getByRole('button');
  await expect(page.getByTestId('pagination-page')).toHaveText('1/334');
  await expect(pages).toHaveCount(7);
  await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect(page.getByTestId('pagination-page')).toHaveText('334/334');
  await expect(page.getByTestId('pagination-index')).toHaveText('997');
  await expect(pages).toHaveCount(7);
  await expect(pages.first()).toHaveText('328');
  await expect(pages.last()).toHaveAttribute('aria-current', 'page');
  await expect(carousel.locator(':scope > div')).toHaveCount(9);
});

for (const effect of ['passive', 'layout']) {
  test(`${effect} effects select pages using the newly committed movement step`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=regression-api--pagination-${effect}-effect&viewMode=story`
    );
    await expect(page.getByTestId('effect-page')).toHaveText('1/6');
    await page
      .getByRole('button', { name: 'Change step and select page' })
      .click();
    await expect(page.getByTestId('effect-index')).toHaveText('5');
    await expect(page.getByTestId('effect-page')).toHaveText('3/3');
  });
}
