import { expect, type Locator, type Page } from '@playwright/test';

type SizingWindow = typeof window & {
  __releaseSizingObservers: () => void;
  __pendingSizingObservers: () => number;
};

export const delaySizingObservers = (page: Page) =>
  page.addInitScript(() => {
    const NativeObserver = window.ResizeObserver;
    let held = true;
    const pending = new Map<ResizeObserver, () => void>();
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          if (held) pending.set(observer, () => callback(entries, observer));
          else callback(entries, observer);
        });
      }
      disconnect() {
        pending.delete(this);
        super.disconnect();
      }
    };
    const state = window as SizingWindow;
    state.__pendingSizingObservers = () => pending.size;
    state.__releaseSizingObservers = () => {
      held = false;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    };
  });

export const openSizing = async (page: Page, args = '') => {
  await page.goto(
    `/iframe.html?id=regression-sizing--content&viewMode=story&args=${encodeURIComponent(args)}`
  );
  const carousel = page.getByTestId('carousel');
  await expect(carousel.locator(':scope > div:not([inert])')).not.toHaveCount(
    0
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as SizingWindow).__pendingSizingObservers())
    )
    .toBeGreaterThan(0);
  return carousel;
};

interface SizingAudit {
  frame: number;
  samples: number;
  badSizes: number[];
  overshot: boolean;
  recycled: boolean;
}
type AuditedElement = HTMLElement & { __sizingAudit?: SizingAudit };

export const startSizingMonitor = (
  carousel: Locator,
  axis: 'horizontal' | 'vertical'
) =>
  carousel.evaluate((element, axis) => {
    const root = element as AuditedElement;
    const cross = axis === 'horizontal' ? 'height' : 'width';
    const primary = axis === 'horizontal' ? 'left' : 'top';
    const expected = root.getBoundingClientRect()[cross];
    const carrier = root
      .querySelector('[data-item-index="4"]')
      ?.closest('[data-carousel-slide]');
    const audit: SizingAudit = {
      frame: 0,
      samples: 0,
      badSizes: [],
      overshot: false,
      recycled: false,
    };
    root.__sizingAudit = audit;
    const sample = () => {
      const bounds = root.getBoundingClientRect();
      const size = bounds[cross];
      audit.samples += 1;
      if (Math.abs(size - expected) > 1 && !audit.badSizes.includes(size))
        audit.badSizes.push(size);
      const seventh = root
        .querySelector('[data-item-index="6"]')
        ?.closest('[data-carousel-slide]');
      if (
        seventh &&
        seventh.getBoundingClientRect()[primary] < bounds[primary] - 0.25
      )
        audit.overshot = true;
      if (carrier?.querySelector('[data-item-index="7"]'))
        audit.recycled = true;
      audit.frame = requestAnimationFrame(sample);
    };
    sample();
  }, axis);

export const stopSizingMonitor = (carousel: Locator) =>
  carousel.evaluate((element) => {
    const audit = (element as AuditedElement).__sizingAudit;
    if (!audit) throw new Error('Missing sizing audit');
    cancelAnimationFrame(audit.frame);
    return {
      samples: audit.samples,
      badSizes: audit.badSizes,
      overshot: audit.overshot,
      recycled: audit.recycled,
    };
  });

export const releaseSizingObservers = (page: Page) =>
  page.evaluate(() => (window as SizingWindow).__releaseSizingObservers());
