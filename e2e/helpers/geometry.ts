import { expect, type Locator, type Page } from '@playwright/test';

export const drag = async (
  page: Page,
  carousel: Locator,
  from: [number, number],
  to: [number, number]
) => {
  const box = await carousel.boundingBox();
  if (!box) {
    throw new Error('Carousel has no browser layout box');
  }

  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 });
  await page.mouse.up();
};

export const expectCardCentered = async (
  carousel: Locator,
  cardHeading: Locator,
  axis: 'x' | 'y'
) => {
  await expect
    .poll(async () => {
      const carouselBox = await carousel.boundingBox();
      const cardBox = await cardHeading.boundingBox();
      if (!carouselBox || !cardBox) return Number.POSITIVE_INFINITY;

      const carouselCenter =
        axis === 'x'
          ? carouselBox.x + carouselBox.width / 2
          : carouselBox.y + carouselBox.height / 2;
      const cardCenter =
        axis === 'x'
          ? cardBox.x + cardBox.width / 2
          : cardBox.y + cardBox.height / 2;

      return Math.abs(carouselCenter - cardCenter);
    })
    .toBeLessThan(4);
};

export const expectAtHorizontalCenter = async (
  cardHeading: Locator,
  expectedCenter: number
) => {
  await expect
    .poll(async () => {
      const box = await cardHeading.boundingBox();
      return box
        ? Math.abs(box.x + box.width / 2 - expectedCenter)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(4);
};

export const expectAtFirstHorizontalSlot = async (
  carousel: Locator,
  cardHeading: Locator,
  visibleCount: number
) => {
  await expect
    .poll(async () => {
      const carouselBox = await carousel.boundingBox();
      const cardBox = await cardHeading.boundingBox();
      if (!carouselBox || !cardBox) return Number.POSITIVE_INFINITY;

      const firstSlotCenter =
        carouselBox.x + carouselBox.width / visibleCount / 2;
      const cardCenter = cardBox.x + cardBox.width / 2;

      return Math.abs(firstSlotCenter - cardCenter);
    })
    .toBeLessThan(4);
};

type TeleportViolation =
  | {
      actor: number;
      delta: number;
      previousX: number;
      type: 'position';
      x: number;
    }
  | {
      actor: number;
      currentContent: string;
      previousContent: string;
      type: 'content-swap';
    }
  | {
      amount: number;
      type: 'gap';
    };

export const startHorizontalTeleportMonitor = async (carousel: Locator) => {
  await carousel.evaluate((element) => {
    const root = element as HTMLElement;
    const actorIds = new WeakMap<Element, number>();
    const previousPositions = new WeakMap<
      Element,
      { content: string; timestamp: number; visible: boolean; x: number }
    >();
    const violations: TeleportViolation[] = [];
    let nextActorId = 0;

    const sample = (timestamp = performance.now()) => {
      const viewport = root.getBoundingClientRect();

      for (const actor of root.children) {
        const actorRect = actor.getBoundingClientRect();
        const visible =
          actorRect.right > viewport.left && actorRect.left < viewport.right;
        const content = actor.textContent ?? '';
        const previous = previousPositions.get(actor);

        if (!actorIds.has(actor)) {
          actorIds.set(actor, nextActorId++);
        }

        if (previous && previous.visible && visible) {
          const delta = Math.abs(actorRect.left - previous.x);

          if (
            timestamp - previous.timestamp < 50 &&
            delta > actorRect.width * 1.5
          ) {
            violations.push({
              actor: actorIds.get(actor) as number,
              delta,
              previousX: previous.x,
              type: 'position',
              x: actorRect.left,
            });
          }

          const visibleOverlap =
            Math.min(
              previous.x + actorRect.width,
              actorRect.right,
              viewport.right
            ) - Math.max(previous.x, actorRect.left, viewport.left);
          // Leaving one edge and entering the opposite edge is legitimate.
          // Replacing content in overlapping visible screen space is not.
          if (previous.content !== content && visibleOverlap > 2) {
            violations.push({
              actor: actorIds.get(actor) as number,
              currentContent: content,
              previousContent: previous.content,
              type: 'content-swap',
            });
          }
        }

        previousPositions.set(actor, {
          content,
          timestamp,
          visible,
          x: actorRect.left,
        });
      }

      const spans = Array.from(root.children)
        .map((actor) => actor.getBoundingClientRect())
        .map((rect) => [
          Math.max(rect.left, viewport.left),
          Math.min(rect.right, viewport.right),
        ])
        .filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0]);
      let covered = viewport.left;
      for (const [start, end] of spans) {
        if (start - covered > 2 && violations.length < 20)
          violations.push({ type: 'gap', amount: start - covered });
        covered = Math.max(covered, end);
      }
      if (viewport.right - covered > 2 && violations.length < 20)
        violations.push({ type: 'gap', amount: viewport.right - covered });

      const monitor = root as HTMLElement & {
        __horizontalTeleportMonitor?: {
          animationFrame: number;
          violations: TeleportViolation[];
        };
      };
      monitor.__horizontalTeleportMonitor = {
        animationFrame: requestAnimationFrame(sample),
        violations,
      };
    };

    sample();
  });
};

export const stopHorizontalTeleportMonitor = async (carousel: Locator) =>
  carousel.evaluate((element) => {
    const monitor = (
      element as HTMLElement & {
        __horizontalTeleportMonitor?: {
          animationFrame: number;
          violations: TeleportViolation[];
        };
      }
    ).__horizontalTeleportMonitor;

    if (!monitor) return [];
    cancelAnimationFrame(monitor.animationFrame);
    return monitor.violations;
  });

type VerticalIntegrityViolation = {
  actors: [number, number] | [number];
  amount: number;
  elapsed: number;
  type: 'content-swap' | 'overlap' | 'teleport';
};

export const startVerticalIntegrityMonitor = async (carousel: Locator) => {
  await carousel.evaluate((element) => {
    const root = element as HTMLElement;
    const actorIds = new WeakMap<Element, number>();
    const previousPositions = new WeakMap<
      Element,
      { content: string; timestamp: number; top: number; visible: boolean }
    >();
    const violations: VerticalIntegrityViolation[] = [];
    let nextActorId = 0;
    let startedAt: number | undefined;
    const monitor = {
      animationFrame: 0,
      violations,
    };

    const sample = (timestamp: number) => {
      if (startedAt === undefined) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      const viewport = root.getBoundingClientRect();
      const actors = [...root.children].map((actor) => {
        const rect = actor.getBoundingClientRect();
        let actorId = actorIds.get(actor);
        if (actorId === undefined) {
          actorId = nextActorId++;
          actorIds.set(actor, actorId);
        }

        const visibleIntersection =
          Math.min(rect.bottom, viewport.bottom) -
          Math.max(rect.top, viewport.top);
        const visible = visibleIntersection > 2;
        const previous = previousPositions.get(actor);
        const content = actor.textContent ?? '';
        if (
          previous &&
          timestamp - previous.timestamp < 100 &&
          previous.visible &&
          visible &&
          Math.abs(rect.top - previous.top) > rect.height * 2.5 &&
          violations.length < 20
        ) {
          violations.push({
            actors: [actorId],
            amount: Math.abs(rect.top - previous.top),
            elapsed,
            type: 'teleport',
          });
        }
        if (
          previous &&
          Math.min(previous.top + rect.height, rect.bottom, viewport.bottom) -
            Math.max(previous.top, rect.top, viewport.top) >
            2 &&
          previous.content !== content &&
          violations.length < 20
        ) {
          violations.push({
            actors: [actorId],
            amount: 0,
            elapsed,
            type: 'content-swap',
          });
        }
        previousPositions.set(actor, {
          content,
          timestamp,
          top: rect.top,
          visible,
        });

        return { actorId, rect };
      });

      for (let leftIndex = 0; leftIndex < actors.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < actors.length;
          rightIndex += 1
        ) {
          const left = actors[leftIndex];
          const right = actors[rightIndex];
          const overlap =
            Math.min(left.rect.bottom, right.rect.bottom, viewport.bottom) -
            Math.max(left.rect.top, right.rect.top, viewport.top);

          if (overlap > 2 && violations.length < 20) {
            violations.push({
              actors: [left.actorId, right.actorId],
              amount: overlap,
              elapsed,
              type: 'overlap',
            });
          }
        }
      }

      monitor.animationFrame = requestAnimationFrame(sample);
    };

    monitor.animationFrame = requestAnimationFrame(sample);
    (
      root as HTMLElement & {
        __verticalIntegrityMonitor?: typeof monitor;
      }
    ).__verticalIntegrityMonitor = monitor;
  });
};

export const stopVerticalIntegrityMonitor = async (carousel: Locator) =>
  carousel.evaluate((element) => {
    const monitor = (
      element as HTMLElement & {
        __verticalIntegrityMonitor?: {
          animationFrame: number;
          violations: VerticalIntegrityViolation[];
        };
      }
    ).__verticalIntegrityMonitor;

    if (!monitor) return [];
    cancelAnimationFrame(monitor.animationFrame);
    return monitor.violations;
  });

export const clickRapidly = async (
  page: Page,
  testId: string,
  count: number,
  intervalMs = 50
) => {
  await page.getByTestId(testId).evaluate(
    async (element, { clickCount, interval }) => {
      for (let clickIndex = 0; clickIndex < clickCount; clickIndex += 1) {
        (element as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    },
    { clickCount: count, interval: intervalMs }
  );
};
