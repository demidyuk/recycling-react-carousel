import { expect, test } from 'vitest';
import { resolveCarouselLayout } from './layout.js';
import {
  createCarouselBounds,
  createProjection,
  createSlots,
  rebaseProjection,
  projectSlide,
  retargetProjection,
} from './carouselAlgorithm.js';

test('fractional capacity sizes cards inside insets and centers the anchor', () => {
  const layout = resolveCarouselLayout(
    {
      slidesPerView: 2.5,
      gap: 20,
      snapAlign: 'center',
      insetStart: 40,
      insetEnd: '10%',
    },
    600
  );
  expect(layout.size).toBe(188);
  expect(layout.pitch).toBe(208);
  expect(layout.anchor).toBe(196);
  expect(layout.poolCapacity).toBe(3);
  expect(layout.start).toBeCloseTo(-196 / 208);
  expect(layout.end).toBeCloseTo(404 / 208);
});

test('auto remains whole-count sizing inside the inner alignment area', () => {
  expect(
    resolveCarouselLayout(
      {
        slidesPerView: 'auto',
        maxSlideSize: '50%',
        insetStart: 50,
        insetEnd: 50,
      },
      600
    )
  ).toMatchObject({ count: 2, size: 250 });
});

test.each([0, 100])(
  'unusable inner geometry is unready at viewport %i',
  (viewport) => {
    expect(
      resolveCarouselLayout({ slidesPerView: 1.2, insetStart: 100 }, viewport)
        .ready
    ).toBe(false);
  }
);

test('trimmed fractional bounds expose an integer terminal anchor', () => {
  expect(
    createCarouselBounds({
      slideCount: 8,
      visibleCount: 2.5,
      ready: true,
      mode: 'finite',
      trimEnd: true,
    })
  ).toEqual({ min: 0, max: 6 });
  expect(
    createCarouselBounds({
      slideCount: 8,
      visibleCount: 3.0000000000000004,
      ready: true,
      mode: 'finite',
      trimEnd: true,
    }).max
  ).toBe(5);
});

test('a fractional terminal snap is chosen by its physical distance', async () => {
  const { decideSwipe } = await import('./carouselAlgorithm.js');
  expect(
    decideSwipe({
      down: false,
      movement: -130,
      direction: -1,
      itemSize: 100,
      threshold: 30,
      visibleCount: 3,
      position: 1.3,
      snapBounds: { min: -4, max: 1.5 },
    })
  ).toEqual({ type: 'requestMove', step: 2 });
});

test('compressed jumps keep outgoing content outside the fractional terminal viewport', () => {
  const layout = resolveCarouselLayout({ slidesPerView: 2.5, gap: 20 }, 600);
  const target = retargetProjection(
    createProjection(0),
    6,
    0,
    layout.poolCapacity,
    layout.start,
    layout.end,
    layout.size / layout.pitch,
    0.5
  );
  const physicalTarget = target.position - 0.5;
  for (
    let position =
      Math.floor(physicalTarget + layout.start - layout.size / layout.pitch) +
      1;
    position < Math.ceil(physicalTarget + layout.end);
    position++
  ) {
    expect(projectSlide(target, position)).toBe(
      target.cursor + position - target.position
    );
  }
});

const layouts = [
  { slidesPerView: 1.2, snapAlign: 'start' as const, gap: 16 },
  {
    slidesPerView: 2.5,
    snapAlign: 'center' as const,
    gap: 16,
    insetStart: 24,
    insetEnd: 24,
  },
  {
    slidesPerView: 3.8,
    snapAlign: 'start' as const,
    gap: 0,
    insetStart: 40,
    insetEnd: 80,
  },
  {
    slidesPerView: 1,
    snapAlign: 'center' as const,
    gap: 300,
    insetStart: 24,
    insetEnd: 24,
  },
];

test.each(
  layouts.flatMap((options) =>
    (['finite', 'loop', 'forward-loop'] as const).map((mode) => ({
      options,
      mode,
    }))
  )
)(
  'preserves visible content and carrier identity for $mode with $options',
  ({ options, mode }) => {
    const layout = resolveCarouselLayout(options, 600);
    const bounds = createCarouselBounds({
      slideCount: 100,
      visibleCount: layout.count,
      ready: true,
      mode,
      trimEnd: !layout.centered,
    });
    const limit =
      !layout.centered && Number.isFinite(bounds.max)
        ? 100 - layout.count
        : bounds.max;
    const span = layout.size / layout.pitch;
    let projection = createProjection(0),
      position = 0;
    const visibleSlots = (
      current: typeof projection,
      physicalPosition: number
    ) =>
      createSlots({
        projection: current,
        windowCursor: Math.floor(physicalPosition + layout.start),
        visibleCount: layout.poolCapacity,
        slideCount: 100,
        bounds,
      }).filter(
        (slot) =>
          slot.renderable &&
          slot.basePosition + span > physicalPosition + layout.start + 1e-8 &&
          slot.basePosition < physicalPosition + layout.end - 1e-8
      );
    for (const requested of [99_999, -1_000, 12, 0, 99_998]) {
      const target = Math.max(bounds.min, Math.min(bounds.max, requested));
      const offset = Math.max(0, target - limit);
      const before = visibleSlots(projection, position);
      const next = retargetProjection(
        projection,
        target,
        position,
        layout.poolCapacity,
        layout.start,
        layout.end,
        span,
        offset
      );
      for (const slot of before)
        expect(projectSlide(next, slot.basePosition)).toBe(
          slot.globalSlideIndex
        );
      const destination = next.position - offset;
      for (let frame = 0; frame <= 10; frame++) {
        const slots = visibleSlots(
          next,
          position + ((destination - position) * frame) / 10
        );
        expect(new Set(slots.map((slot) => slot.globalSlideIndex)).size).toBe(
          slots.length
        );
      }
      projection = next;
      position += (destination - position) * 0.4;
    }
    const offset = Math.max(0, projection.cursor - limit);
    const settled = visibleSlots(projection, projection.position - offset);
    const rebased = rebaseProjection(projection, layout.poolCapacity);
    const rebasedSlots = new Map(
      visibleSlots(rebased, -offset).map((slot) => [slot.slotIndex, slot])
    );
    for (const slot of settled) {
      const after = rebasedSlots.get(slot.slotIndex)!;
      expect(after.globalSlideIndex).toBe(slot.globalSlideIndex);
      expect(after.basePosition + offset).toBeCloseTo(
        slot.basePosition - projection.position + offset
      );
    }
  }
);
