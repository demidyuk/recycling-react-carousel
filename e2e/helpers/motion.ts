import { openStory } from './story.js';
import { expect, type Locator, type Page } from '@playwright/test';

type MotionExample =
  'spring' | 'bouncy' | 'rich' | 'vertical' | 'vertical-jumps';

export const openMotion = async (
  page: Page,
  example: MotionExample = 'spring',
  args = ''
) => {
  const story = example === 'vertical' ? 'vertical' : 'large-jumps';
  const overrides = Object.fromEntries(
    args
      .split(';')
      .filter(Boolean)
      .map((entry) => entry.split(':'))
  );
  const settings = {
    mode: 'loop',
    axis: example.startsWith('vertical') ? 'vertical' : 'horizontal',
    itemCount: 500,
    slidesPerView: example === 'rich' ? 1 : 3,
    motion:
      example === 'bouncy'
        ? 'bouncy'
        : example === 'rich'
          ? 'duration'
          : 'spring',
    cardContent: example === 'rich' ? 'rich' : 'simple',
    ...overrides,
  };
  const parameters = Object.entries(settings)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
  await openStory(page, `regression-feature-harness--${story}`, parameters);
};

export const expectAligned = async (
  page: Page,
  cursor: number,
  axis: 'horizontal' | 'vertical' = 'horizontal',
  count = 500
) => {
  await expect(page.getByTestId('cursor')).toHaveText(String(cursor));
  const index = ((cursor % count) + count) % count;
  await expect
    .poll(() =>
      page.getByTestId('carousel').evaluate(
        (root, { index, axis }) => {
          const viewport = root.getBoundingClientRect();
          const start = axis === 'horizontal' ? viewport.left : viewport.top;
          return Math.min(
            ...Array.from(root.children)
              .filter((slot) =>
                slot.querySelector(`[data-item-index="${index}"]`)
              )
              .map((slot) => {
                const rect = slot.getBoundingClientRect();
                return Math.abs(
                  (axis === 'horizontal' ? rect.left : rect.top) - start
                );
              })
          );
        },
        { index, axis }
      )
    )
    .toBeLessThan(1);
  await expect(
    page.getByTestId('carousel').locator(':scope > div:not([inert])').first()
  ).toBeVisible();
};

// Sample actual browser geometry and content identities during motion. These
// audits detect holes or visible recycling; they are not performance timings.
export const startIntegrityMonitor = async (
  carousel: Locator,
  axis: 'horizontal' | 'vertical' = 'horizontal',
  options: { uniqueContent?: boolean; allowEmptySpace?: boolean } = {}
) => {
  await carousel.evaluate(
    (element, { axis, uniqueContent, allowEmptySpace }) => {
      const root = element as HTMLElement & {
        __motionAudit?: { frame: number; violations: string[] };
      };
      const previous = new WeakMap<
        Element,
        { index: string | null; start: number; end: number }
      >();
      const audit = { frame: 0, violations: [] as string[] };
      const actorCount = root.children.length;
      root.__motionAudit = audit;
      const sample = () => {
        if (
          root.children.length !== actorCount &&
          audit.violations.length < 20
        ) {
          audit.violations.push(
            `Pool size changed: ${actorCount} -> ${root.children.length}`
          );
        }
        const viewport = root.getBoundingClientRect();
        const start = axis === 'horizontal' ? viewport.left : viewport.top;
        const end = axis === 'horizontal' ? viewport.right : viewport.bottom;
        const intervals: [number, number][] = [];
        const visibleIndexes = new Set<string>();
        for (const slot of root.children) {
          const rect = slot.getBoundingClientRect();
          const a = axis === 'horizontal' ? rect.left : rect.top;
          const b = axis === 'horizontal' ? rect.right : rect.bottom;
          const overlap = Math.min(b, end) - Math.max(a, start);
          const card = slot.querySelector('[data-item-index]');
          const index = card?.getAttribute('data-item-index') ?? null;
          // Carrier padding covers the gap after its card has left the viewport.
          // Content may recycle there, even while that empty padding is visible.
          const content = card?.getBoundingClientRect() ?? rect;
          const contentStart =
            axis === 'horizontal' ? content.left : content.top;
          const contentEnd =
            axis === 'horizontal' ? content.right : content.bottom;
          const visible =
            Math.min(contentEnd, end) - Math.max(contentStart, start) > 2;
          const last = previous.get(slot);
          if (
            last &&
            last.index !== index &&
            // A carrier may legitimately leave the left edge and reappear at
            // the right edge between samples. Flag replacement in overlapping
            // visible screen space, rather than every recycled carrier entry.
            Math.min(last.end, contentEnd, end) -
              Math.max(last.start, contentStart, start) >
              2 &&
            audit.violations.length < 20
          ) {
            audit.violations.push(
              `Visible content changed: ${last.index} -> ${index}`
            );
          }
          previous.set(slot, {
            index,
            start: contentStart,
            end: contentEnd,
          });
          if (visible && index !== null && uniqueContent) {
            if (visibleIndexes.has(index) && audit.violations.length < 20) {
              audit.violations.push(`Duplicate visible slide: ${index}`);
            }
            visibleIndexes.add(index);
          }
          // Coverage includes edge slivers too small for content-swap checks.
          if (overlap > 0)
            intervals.push([Math.max(a, start), Math.min(b, end)]);
        }
        intervals.sort((a, b) => a[0] - b[0]);
        let covered = start;
        for (const [a, b] of intervals) {
          if (
            !allowEmptySpace &&
            a - covered > 2 &&
            audit.violations.length < 20
          ) {
            audit.violations.push(`Viewport gap: ${a - covered}px`);
          }
          covered = Math.max(covered, b);
        }
        if (
          !allowEmptySpace &&
          end - covered > 2 &&
          audit.violations.length < 20
        ) {
          audit.violations.push(`Trailing gap: ${end - covered}px`);
        }
        audit.frame = requestAnimationFrame(sample);
      };
      sample();
    },
    { axis, ...options }
  );
};

export const stopIntegrityMonitor = async (carousel: Locator) =>
  carousel.evaluate((element) => {
    const audit = (
      element as HTMLElement & {
        __motionAudit?: { frame: number; violations: string[] };
      }
    ).__motionAudit;
    if (!audit) throw new Error('Missing geometry audit');
    cancelAnimationFrame(audit.frame);
    return audit.violations;
  });

export const openPausedMotion = async (
  page: Page,
  story: MotionExample = 'spring',
  args = ''
) => {
  await page.clock.install({ time: new Date('2026-10-22T00:00:00Z') });
  await openMotion(page, story, args);
  await expectAligned(
    page,
    0,
    story.startsWith('vertical') ? 'vertical' : 'horizontal'
  );
  await page.clock.pauseAt(new Date('2026-10-22T00:01:00Z'));
  return page.getByTestId('carousel');
};

// Timed stress sequences belong to the tests, while the gallery exposes ordinary
// navigation controls. Each click commits before the next timed request.
export const navigateRapidly = async (
  page: Page,
  steps: number[],
  intervalMs = 35
) => {
  await page.getByRole('navigation', { name: 'Slide navigation' }).evaluate(
    async (root, { steps, intervalMs }) => {
      for (const step of steps) {
        const label = step > 0 ? 'Next slide' : 'Previous slide';
        const button = [...root.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === label
        );
        if (!button || button.disabled)
          throw new Error(`Cannot navigate: ${label}`);
        button.click();
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    },
    { steps, intervalMs }
  );
};

export const readOffset = (
  carousel: Locator,
  axis: 'horizontal' | 'vertical' = 'horizontal'
) =>
  carousel.evaluate((root, axis) => {
    const actor = [...root.children].find((slot) =>
      slot.querySelector('[data-item-index="0"]')
    );
    if (!actor) throw new Error('Missing reference slide');
    const rect = actor.getBoundingClientRect();
    const viewport = root.getBoundingClientRect();
    return axis === 'horizontal'
      ? (rect.left - viewport.left) / rect.width
      : (rect.top - viewport.top) / rect.height;
  }, axis);
