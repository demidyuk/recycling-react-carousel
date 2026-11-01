import { test } from '@playwright/test';
import { openStory } from './helpers/story.js';
import { drag, expectCardCentered } from './helpers/geometry.js';

test('swipes horizontally and stops at the previous boundary', async ({
  page,
}) => {
  await openStory(page, 'regression-feature-harness--basic');
  const carousel = page.getByTestId('carousel');

  await drag(page, carousel, [700, 125], [200, 125]);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '2' }),
    'x'
  );

  await openStory(page, 'regression-feature-harness--basic');
  await drag(page, carousel, [200, 125], [700, 125]);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '1' }),
    'x'
  );
});

test('swipes vertically', async ({ page }) => {
  await openStory(page, 'regression-feature-harness--vertical');
  const carousel = page.getByTestId('carousel');

  await drag(page, carousel, [400, 210], [400, 40]);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '2' }),
    'y'
  );
});

test('does not move until the configured threshold is reached', async ({
  page,
}) => {
  await openStory(
    page,
    'regression-feature-harness--basic',
    'swipeThreshold:20px'
  );
  const carousel = page.getByTestId('carousel');

  await drag(page, carousel, [500, 125], [490, 125]);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '1' }),
    'x'
  );

  await drag(page, carousel, [500, 125], [450, 125]);
  await expectCardCentered(
    carousel,
    page.getByRole('heading', { includeHidden: true, name: '2' }),
    'x'
  );
});
