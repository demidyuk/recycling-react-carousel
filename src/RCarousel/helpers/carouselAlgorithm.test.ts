import { describe, expect, test } from 'vitest';
import {
  createCarouselBounds,
  createProjection,
  createSlots,
  decideSwipe,
  getDragBounds,
  projectSlide,
  rebaseProjection,
  reconcileCursor,
  requestCarouselMove,
  resistDrag,
  retargetProjection,
} from './carouselAlgorithm.js';

describe('shared spring geometry', () => {
  test.each([100, -1])(
    'populating an initially empty collection preserves the requested position %i',
    (cursor) => {
      const result = reconcileCursor(
        { cursor, requestedCursor: cursor, slideCount: 0, ready: false },
        cursor,
        3,
        true,
        { min: -Infinity, max: Infinity }
      );
      expect(result.state.cursor).toBe(cursor);
      expect(result.cursorCorrection).toBeUndefined();
    }
  );
  test.each([
    [5, 3],
    [-1, -1],
    [-4, -3],
  ])(
    'shrinking a loop collection at %i keeps its cycle and clamps a removed local index to %i',
    (cursor, expected) => {
      const result = reconcileCursor(
        { cursor, requestedCursor: cursor, slideCount: 3, ready: true },
        cursor,
        2,
        true,
        { min: -Infinity, max: Infinity }
      );
      expect(result.state.cursor).toBe(expected);
      expect(result.cursorCorrection).toEqual({
        cursor: expected,
        reason: 'slides-change',
      });
    }
  );
  test.each([1, 2, 3, 4])(
    'covers %i visible slides through positive and negative wraps',
    (visibleCount) => {
      const origin = 1_000_000;
      for (let offset = -25.5; offset <= 25.5; offset += 0.25) {
        const slots = createSlots({
          projection: createProjection(origin),
          windowCursor: Math.floor(-offset),
          visibleCount,
          slideCount: 500,
          bounds: { min: -Infinity, max: Infinity },
        });
        const positions = slots
          .map((slot) => slot.basePosition + offset)
          .sort((a, b) => a - b);
        expect(slots).toHaveLength(visibleCount * 3);
        expect(new Set(slots.map((slot) => slot.globalSlideIndex)).size).toBe(
          slots.length
        );
        expect(positions[0]).toBeLessThanOrEqual(0);
        expect(positions[positions.length - 1] + 1).toBeGreaterThanOrEqual(
          visibleCount
        );
        positions
          .slice(1)
          .forEach((value, index) => expect(value - positions[index]).toBe(1));
      }
    }
  );
  test('finite and forward-only layouts leave unavailable content empty', () => {
    for (const max of [4, Infinity]) {
      const slots = createSlots({
        projection: createProjection(4),
        windowCursor: 0,
        visibleCount: 2,
        slideCount: 5,
        bounds: { min: 0, max },
      });
      expect(
        slots
          .filter((slot) => slot.renderable)
          .every(
            (slot) =>
              slot.globalSlideIndex >= 0 &&
              (max === Infinity || slot.globalSlideIndex < 5)
          )
      ).toBe(true);
    }
  });
  test('count corrections preserve the completed cycle unless a new cursor is explicit', () => {
    const previous = {
      cursor: 100,
      requestedCursor: 100,
      slideCount: 3,
      ready: true,
    };
    const bounds = { min: 0, max: Infinity };
    expect(
      reconcileCursor(previous, 100, 4, true, bounds).cursorCorrection?.cursor
    ).toBe(133);
    expect(reconcileCursor(previous, 102, 4, true, bounds).state.cursor).toBe(
      102
    );
  });
});

describe('compressed jump projection', () => {
  const bounds = { min: -Infinity, max: Infinity };
  test('a swipe selecting part of a mixed outgoing screen never duplicates visible content', () => {
    const first = retargetProjection(createProjection(0), 17, 0, 3);
    const reversed = retargetProjection(first, 16, 0.6, 3);
    const selected = retargetProjection(reversed, 1, 1.14, 3);
    for (let frame = 0; frame <= 100; frame++) {
      const position = 1.14 + ((selected.position - 1.14) * frame) / 100;
      const visible = createSlots({
        projection: selected,
        windowCursor: Math.floor(position),
        visibleCount: 3,
        slideCount: 20,
        bounds: { min: 0, max: 17 },
      }).filter(
        (slot) =>
          slot.renderable &&
          slot.basePosition + 1 > position &&
          slot.basePosition < position + 3
      );
      expect(new Set(visible.map((slot) => slot.globalSlideIndex)).size).toBe(
        visible.length
      );
    }
  });
  test.each([1, 3, 4])(
    'reuses the outgoing destination during a reversal with V=%i',
    (visibleCount) => {
      for (const direction of [-1, 1]) {
        for (const fraction of [0, 0.1, 0.5, 0.9]) {
          const outgoing = retargetProjection(
            createProjection(100),
            100 + direction * 100,
            0,
            visibleCount
          );
          const visiblePosition = direction * visibleCount * fraction;
          const reversed = retargetProjection(
            outgoing,
            100,
            visiblePosition,
            visibleCount
          );
          expect(reversed.position).toBe(0);
          for (let step = 0; step <= 10; step += 1) {
            const position = visiblePosition * (1 - step / 10);
            const visible = createSlots({
              projection: reversed,
              windowCursor: Math.floor(position),
              visibleCount,
              slideCount: 500,
              bounds,
            }).filter(
              (slot) =>
                slot.basePosition + 1 > position &&
                slot.basePosition < position + visibleCount
            );
            expect(
              new Set(visible.map((slot) => slot.globalSlideIndex)).size
            ).toBe(visible.length);
          }
        }
      }
    }
  );

  test.each([1, 3, 4])(
    'preserves visible content and slot identities for V=%i',
    (visibleCount) => {
      let projection = createProjection(0);
      for (const [cursor, p] of [
        [1_000_000, 0],
        [-1_000_000, 0.4],
        [-999_999, -0.7],
        [0, -2.3],
      ]) {
        const before = createSlots({
          projection,
          windowCursor: Math.floor(p),
          visibleCount,
          slideCount: 500,
          bounds,
        });
        const next = retargetProjection(projection, cursor, p, visibleCount);
        const after = createSlots({
          projection: next,
          windowCursor: Math.floor(p),
          visibleCount,
          slideCount: 500,
          bounds,
        });
        for (const slot of before.filter(
          (slot) =>
            slot.basePosition + 1 > p && slot.basePosition < p + visibleCount
        )) {
          expect(after[slot.slotIndex]).toEqual({
            ...slot,
            position: slot.basePosition - next.position,
          });
          // Position is relative to the new destination; content and grid stay fixed.
        }
        if (Math.abs(next.position - p) < visibleCount) {
          expect(
            before.some(
              (slot) =>
                slot.basePosition + 1 > p &&
                slot.basePosition < p + visibleCount &&
                slot.globalSlideIndex >= cursor &&
                slot.globalSlideIndex < cursor + visibleCount
            )
          ).toBe(true);
        }
        expect(Math.abs(next.position - p)).toBeLessThan(visibleCount + 1);
        expect(next.retained.size).toBeLessThanOrEqual(visibleCount + 1);
        for (let index = 0; index < visibleCount; index += 1) {
          expect(projectSlide(next, next.position + index)).toBe(
            cursor + index
          );
        }
        projection = next;
      }
    }
  );

  test.each([1_000_000, -1_000_000])(
    'rebases %i without changing the destination carriers',
    (cursor) => {
      const visibleCount = 3;
      const projection = retargetProjection(
        createProjection(0),
        cursor,
        0.3,
        visibleCount
      );
      const rebased = rebaseProjection(projection, visibleCount);
      const before = createSlots({
        projection,
        windowCursor: projection.position,
        visibleCount,
        slideCount: 500,
        bounds,
      });
      const after = createSlots({
        projection: rebased,
        windowCursor: 0,
        visibleCount,
        slideCount: 500,
        bounds,
      });
      for (const slot of before.filter(
        (slot) => slot.position >= 0 && slot.position < visibleCount
      )) {
        expect(after[slot.slotIndex]).toEqual({
          ...slot,
          basePosition: slot.position,
        });
      }
      expect(rebased.position).toBe(0);
      expect(rebased.retained.size).toBe(0);
      const ordinary = retargetProjection(rebased, cursor + 1, 0, visibleCount);
      expect(ordinary.position).toBe(1);
      expect(ordinary.retained.size).toBe(0);
    }
  );

  test('reuses the partially visible destination on a small request during a projected jump', () => {
    const first = retargetProjection(createProjection(0), 1_000_000, 0, 3);
    const next = retargetProjection(first, 1_000_001, 1.5, 3);
    expect(next.position).toBe(4);
    expect([...next.retained.values()]).toEqual([1, 2, 1_000_000, 1_000_001]);
    expect(projectSlide(next, 4)).toBe(1_000_001);
    expect(projectSlide(next, 5)).toBe(1_000_002);
    expect(projectSlide(next, 6)).toBe(1_000_003);
    expect(retargetProjection(next, next.cursor, 2, 3)).toBe(next);
  });
});

test('creates bounded cursor requests without mutating the current cursor', () => {
  const state = { cursor: 2 };
  const bounds = { min: 0, max: 2 };
  expect(requestCarouselMove(state, 1, bounds)).toBeUndefined();
  expect(requestCarouselMove(state, -1, bounds)).toEqual({
    cursor: 1,
    reason: 'drag',
  });
  expect(state.cursor).toBe(2);
});

describe('carousel bounds', () => {
  test('supports finite, forward-loop, loop, and trimmed ranges', () => {
    const base = {
      slideCount: 5,
      visibleCount: 2,
      ready: true,
      trimEnd: false,
    };

    expect(
      createCarouselBounds({
        ...base,
        mode: 'finite',
      })
    ).toEqual({ min: 0, max: 4 });
    expect(
      createCarouselBounds({
        ...base,
        mode: 'forward-loop',
      })
    ).toEqual({ min: 0, max: Infinity });
    expect(
      createCarouselBounds({
        ...base,
        mode: 'loop',
      })
    ).toEqual({ min: -Infinity, max: Infinity });
    expect(
      createCarouselBounds({
        ...base,
        trimEnd: true,
        mode: 'finite',
      })
    ).toEqual({ min: 0, max: 3 });
  });

  test('does not expose endless bounds before layout is measurable', () => {
    expect(
      createCarouselBounds({
        slideCount: 3,
        visibleCount: 1,
        ready: false,
        mode: 'forward-loop',
        trimEnd: false,
      })
    ).toEqual({ min: 0, max: 2 });
  });

  test('uses an empty render range when there are no slides', () => {
    expect(
      createCarouselBounds({
        slideCount: 0,
        visibleCount: 0,
        ready: false,
        mode: 'loop',
        trimEnd: false,
      })
    ).toEqual({ min: 0, max: 0 });
  });
});

describe('swipe decisions', () => {
  test('ignores movement until layout has a usable item size', () => {
    expect(
      decideSwipe({
        down: true,
        movement: -100,
        direction: -1,
        itemSize: 0,
        threshold: 50,
        visibleCount: 1,
      })
    ).toEqual({ type: 'ignore' });
  });

  test('returns drag, snap-back, and cursor request decisions', () => {
    const input = {
      movement: -30,
      direction: -1,
      itemSize: 100,
      threshold: 50,
      visibleCount: 2,
    };

    expect(decideSwipe({ ...input, down: true })).toEqual({
      type: 'drag',
      offset: -0.3,
    });
    expect(decideSwipe({ ...input, down: false })).toEqual({
      type: 'snapBack',
    });
    expect(
      decideSwipe({
        ...input,
        down: false,
        movement: -50,
      })
    ).toEqual({ type: 'requestMove', step: 1 });
  });

  test('honors direction reversal and configured slides-to-scroll', () => {
    const base = {
      down: false,
      movement: -80,
      itemSize: 100,
      threshold: 50,
      visibleCount: 3,
    };

    expect(
      decideSwipe({ ...base, movement: -30, threshold: 20, direction: 1 })
    ).toEqual({
      type: 'requestMove',
      step: 0,
    });
    expect(
      decideSwipe({
        ...base,
        direction: -1,
        slidesToScroll: 3,
      })
    ).toEqual({ type: 'requestMove', step: 3 });
  });

  test.each([
    [-220, 1, 0, 2],
    [-280, 1, 0, 3],
    [220, 1, 0, -2],
    [280, 1, 0, -3],
    [-420, 2, 0, 4],
    [-520, 2, 0, 6],
    [-240, 1, -1, 3],
    [-260, 1, 1, 2],
    [-240, 1, 0, 2],
    [-35, 3, 0, 3],
  ])(
    'snaps displacement %i with step %i and velocity %i to %i',
    (movement, slidesToScroll, velocity, step) => {
      const input = {
        movement,
        slidesToScroll,
        velocity,
        direction: Math.sign(velocity || movement),
        itemSize: 100,
        threshold: 30,
        visibleCount: 1,
      };
      expect(decideSwipe({ ...input, down: true })).toEqual({
        type: 'drag',
        offset: movement / 100,
      });
      expect(decideSwipe({ ...input, down: false })).toEqual({
        type: 'requestMove',
        step,
      });
    }
  );

  test('snaps the reached position when catching an unfinished transition', () => {
    expect(
      decideSwipe({
        down: false,
        movement: -220,
        position: 2.6,
        itemSize: 100,
        threshold: 30,
        direction: 0,
        visibleCount: 1,
      })
    ).toEqual({ type: 'requestMove', step: 3 });
  });
});

test('edge resistance is bounded, reversible, and uses cursor-relative drag limits', () => {
  const bounds = { min: 0, max: 5 };
  expect(resistDrag(2.8, bounds)).toBe(2.8);
  expect(resistDrag(-0.1, bounds)).toBeCloseTo(-1 / 12);
  expect(resistDrag(-1000, bounds)).toBeGreaterThan(-0.5);
  expect(resistDrag(1000, bounds)).toBeLessThan(5.5);
  expect(getDragBounds(createProjection(3), bounds)).toEqual({
    min: -3,
    max: 2,
  });
});
