import { useLayoutEffect } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { motionEnvironment } from '../motion/ScalarMotion.js';
import type { MotionConfig, ScalarMotion } from '../motion/ScalarMotion.js';
import { expect, test, vi } from 'vitest';
import { useCarouselController } from './useCarouselController.js';
import type { CarouselBounds, CursorChange } from '../helpers/index.js';

const endlessBounds = { min: -Infinity, max: Infinity };
const noop = () => {};
let spring: ScalarMotion;
function Harness({
  cursor,
  motionConfig = {},
  drag = false,
  visibleCount = 1,
  onDragNavigate = noop,
  onCursorRequest = noop,
  bounds = endlessBounds,
}: {
  cursor: number;
  motionConfig?: MotionConfig;
  drag?: boolean;
  visibleCount?: number;
  onDragNavigate?: (direction: 'next' | 'prev', destination: number) => void;
  onCursorRequest?: (change: CursorChange) => void;
  bounds?: CarouselBounds;
}) {
  const motion = useCarouselController({
    cursor,
    slideCount: 500,
    visibleCount,
    drag,
    ready: true,
    bounds,
    itemSize: 100,
    contentSpan: 1,
    swipeThreshold: 50,
    y: false,
    motionConfig,
    onDragNavigate,
    onCursorRequest,
  });
  useLayoutEffect(() => {
    spring = motion.animatedOffset;
  });
  return (
    <div
      data-testid="carousel"
      data-cursor={motion.cursor}
      data-moving={motion.isMoving}
      {...motion.bind}
    >
      {motion.slots.map((slot) => (
        <div
          key={slot.slotIndex}
          data-testid="slot"
          data-base={slot.basePosition}
        >
          {slot.globalSlideIndex}
        </div>
      ))}
    </div>
  );
}

test('rapid targets reuse one spring and a fixed set of carriers', () => {
  const { rerender } = render(<Harness cursor={0} />);
  const originalSpring = spring;
  const originalActors = screen.getAllByTestId('slot');
  for (let cursor = 1; cursor <= 30; cursor += 1) {
    rerender(<Harness cursor={cursor} />);
    expect(spring).toBe(originalSpring);
    expect(screen.getAllByTestId('slot')).toEqual(originalActors);
  }
});

test('changing motionConfig leaves active motion untouched and applies on the next target', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const { rerender } = render(
    <Harness cursor={0} motionConfig={{ tension: 120 }} />
  );
  rerender(<Harness cursor={1} motionConfig={{ tension: 120 }} />);
  expect(spring.config.tension).toBe(120);
  rerender(<Harness cursor={1} motionConfig={{ tension: 240 }} />);
  expect(spring.config.tension).toBe(120);
  rerender(<Harness cursor={2} motionConfig={{ tension: 240 }} />);
  expect(spring.config.tension).toBe(240);
  act(() => spring.stop());
});

test.each([1_000_000, -1_000_000])(
  'large jump to %i animates one viewport and rebases without losing carriers',
  async (cursor) => {
    vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
    const motionConfig = { duration: 1000 };
    const { rerender } = render(
      <Harness cursor={0} visibleCount={3} motionConfig={motionConfig} />
    );
    const originalActors = screen.getAllByTestId('slot');
    rerender(
      <Harness cursor={cursor} visibleCount={3} motionConfig={motionConfig} />
    );
    expect(spring.get()).toBe(0);
    expect(spring.goal).toBe(-Math.sign(cursor) * 3);
    expect(screen.getByTestId('carousel')).toHaveAttribute(
      'data-cursor',
      String(cursor)
    );
    expect(
      originalActors
        .filter(
          (slot) =>
            Number(slot.dataset.base) >= 0 && Number(slot.dataset.base) < 3
        )
        .map((slot) => slot.textContent)
    ).toEqual(['0', '1', '2']);
    act(() => spring.advance(499));
    const destination = screen
      .getAllByTestId('slot')
      .find((slot) => slot.textContent === String(cursor))!;
    act(() => spring.advance(1));
    await waitFor(() => expect(spring.goal).toBe(0));
    expect(spring.get()).toBe(0);
    expect(destination.textContent).toBe(String(cursor));
    expect(destination.dataset.base).toBe('0');
    expect(screen.getAllByTestId('slot')).toEqual(originalActors);
    expect(screen.getByTestId('carousel')).toHaveAttribute(
      'data-moving',
      'false'
    );
    rerender(
      <Harness
        cursor={cursor + 1}
        visibleCount={3}
        motionConfig={motionConfig}
      />
    );
    expect(spring.goal).toBe(-1);
    act(() => spring.stop());
  }
);

test('fractional interruptions preserve visible contents, velocity and the pending frame', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const requestFrame = vi.spyOn(motionEnvironment, 'requestFrame');
  const { rerender } = render(<Harness cursor={0} visibleCount={3} />);
  rerender(<Harness cursor={1_000_000} visibleCount={3} />);
  act(() => spring.advance(64));
  const p = -spring.get();
  expect(p % 1).not.toBe(0);
  const velocity = spring.velocity;
  const visible = screen
    .getAllByTestId('slot')
    .filter(
      (slot) =>
        Number(slot.dataset.base) + 1 > p && Number(slot.dataset.base) < p + 3
    );
  const contents = visible.map((slot) => slot.textContent);
  requestFrame.mockClear();
  rerender(<Harness cursor={-1_000_000} visibleCount={3} />);
  expect(spring.get()).toBe(-p);
  expect(spring.velocity).toBe(velocity);
  expect(spring.goal).toBe(-(Math.floor(p) - 3));
  expect(visible.map((slot) => slot.textContent)).toEqual(contents);
  // Even a one-item update during this projection needs a fresh adjacent screen.
  rerender(<Harness cursor={-999_999} visibleCount={3} />);
  expect(spring.goal).toBe(-(Math.ceil(p) + 3));
  expect(spring.velocity).toBe(velocity);
  expect(visible.map((slot) => slot.textContent)).toEqual(contents);
  expect(requestFrame).not.toHaveBeenCalled();
  act(() => spring.stop());
});

test('a press begun before a compressed jump stays canceled after settlement', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const onCursorRequest = vi.fn();
  const props = {
    motionConfig: { duration: 100 },
    visibleCount: 3,
    drag: true,
    onCursorRequest,
  };
  const { rerender } = render(<Harness cursor={0} {...props} />);
  const carousel = screen.getByTestId('carousel');
  const pointer = {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
  };
  fireEvent.pointerDown(carousel, { ...pointer, clientX: 50 });
  rerender(<Harness cursor={1_000_000} {...props} />);
  fireEvent.pointerMove(document, { ...pointer, clientX: 120 });
  expect(spring.get()).toBe(0);
  expect(spring.goal).toBe(-3);
  act(() => spring.advance(100));
  await waitFor(() => expect(spring.goal).toBe(0));
  fireEvent.pointerMove(document, { ...pointer, clientX: 150 });
  fireEvent.pointerUp(document, { ...pointer, buttons: 0, clientX: 150 });
  expect(onCursorRequest).not.toHaveBeenCalled();
  fireEvent.pointerDown(carousel, { ...pointer, clientX: 50 });
  fireEvent.pointerMove(document, { ...pointer, clientX: 120 });
  fireEvent.pointerUp(document, { ...pointer, buttons: 0, clientX: 120 });
  expect(onCursorRequest).toHaveBeenCalledExactlyOnceWith({
    cursor: 999_999,
    reason: 'drag',
  });
  act(() => spring.stop());
});

test.each([
  { tension: 170, friction: 1, mass: 100 },
  { tension: 170, friction: 0, mass: 1 },
  { duration: 10_000, easing: (progress: number) => Math.sin(progress * 20) },
  { duration: 120 },
])(
  'compressed jumps settle monotonically within 500 ms and restore custom motion (%j)',
  async (motionConfig) => {
    vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
    for (const direction of [-1, 1]) {
      const cursor = direction * 1_000_000;
      const { rerender, unmount } = render(
        <Harness cursor={0} visibleCount={3} motionConfig={motionConfig} />
      );
      rerender(
        <Harness cursor={cursor} visibleCount={3} motionConfig={motionConfig} />
      );
      let previous = 0;
      for (let time = 0; time < 500; time += 20) {
        act(() => spring.advance(20));
        const reached = -direction * spring.get();
        expect(reached).toBeGreaterThanOrEqual(previous);
        expect(reached).toBeLessThanOrEqual(3);
        previous = reached;
      }
      expect(previous).toBe(3);
      await waitFor(() => expect(spring.goal).toBe(0));
      expect(screen.getByTestId('carousel')).toHaveAttribute(
        'data-moving',
        'false'
      );
      rerender(
        <Harness
          cursor={cursor + 1}
          visibleCount={3}
          motionConfig={motionConfig}
        />
      );
      expect(spring.config).toMatchObject(motionConfig);
      expect(spring.config.duration).toBe(motionConfig.duration);
      act(() => spring.stop());
      unmount();
    }
  }
);

test.each([true, false])(
  'large jumps settle immediately for reduced motion or duration zero (%s)',
  (reducedMotion) => {
    vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(reducedMotion);
    const motionConfig = { duration: reducedMotion ? 1000 : 0 };
    const { rerender } = render(
      <Harness cursor={0} motionConfig={motionConfig} />
    );
    rerender(<Harness cursor={1_000_000} motionConfig={motionConfig} />);
    expect(spring.get()).toBe(0);
    expect(spring.goal).toBe(0);
    expect(screen.getByTestId('carousel')).toHaveAttribute(
      'data-moving',
      'false'
    );
    expect(
      screen.getAllByTestId('slot').find((slot) => slot.dataset.base === '0')
    ).toHaveTextContent('1000000');
  }
);

test('grabbing an unfinished transition anchors dragging to its visible position', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const motionConfig = { duration: 1000 };
  const { rerender } = render(
    <Harness cursor={0} motionConfig={motionConfig} drag />
  );
  rerender(<Harness cursor={1} motionConfig={motionConfig} drag />);
  act(() => spring.advance(400));
  expect(spring.get()).toBeCloseTo(-0.4);
  const carousel = screen.getByTestId('carousel');
  const pointer = {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
  };
  fireEvent.pointerDown(carousel, { ...pointer, clientX: 50, clientY: 0 });
  fireEvent.pointerMove(carousel, { ...pointer, clientX: 60, clientY: 0 });
  expect(spring.get()).toBeCloseTo(-0.3);
  expect(spring.goal).toBeCloseTo(-0.3);
  fireEvent.pointerMove(carousel, { ...pointer, clientX: 40, clientY: 0 });
  expect(spring.get()).toBeCloseTo(-0.5);
  expect(spring.goal).toBeCloseTo(-0.5);
  fireEvent.pointerUp(carousel, {
    ...pointer,
    buttons: 0,
    clientX: 40,
    clientY: 0,
  });
  act(() => spring.stop());
});

test('compressed jumps ignore pointer input until settlement, then accept a fresh drag', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const onDragNavigate = vi.fn();
  const onCursorRequest = vi.fn();
  const props = {
    drag: true,
    visibleCount: 3,
    motionConfig: { duration: 1000 },
    onDragNavigate,
    onCursorRequest,
  };
  const { rerender } = render(<Harness cursor={0} {...props} />);
  rerender(<Harness cursor={-1_000_000} {...props} />);
  act(() => spring.advance(100));
  const position = spring.get();
  expect(position).toBeGreaterThan(0);
  expect(position).toBeLessThan(3);
  const carousel = screen.getByTestId('carousel');
  const pointer = {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
  };
  fireEvent.pointerDown(carousel, { ...pointer, clientX: 50 });
  fireEvent.pointerMove(document, { ...pointer, clientX: 120 });
  expect(spring.get()).toBe(position);
  expect(spring.goal).toBe(3);
  act(() => spring.advance(400));
  await waitFor(() => expect(spring.goal).toBe(0));
  // A press ignored during the jump must not turn into a drag after it settles.
  fireEvent.pointerMove(document, { ...pointer, clientX: 150 });
  expect(spring.get()).toBe(0);
  expect(onCursorRequest).not.toHaveBeenCalled();
  expect(onDragNavigate).not.toHaveBeenCalled();
  fireEvent.pointerUp(document, { ...pointer, buttons: 0, clientX: 150 });
  fireEvent.pointerDown(carousel, { ...pointer, clientX: 50 });
  fireEvent.pointerMove(document, { ...pointer, clientX: 120 });
  expect(spring.get()).toBeCloseTo(0.7);
  fireEvent.pointerUp(document, { ...pointer, buttons: 0, clientX: 120 });
  expect(onCursorRequest).toHaveBeenCalledWith({
    cursor: -1_000_001,
    reason: 'drag',
  });
  expect(onDragNavigate).toHaveBeenCalledExactlyOnceWith(
    'prev',
    -1_000_001,
    'drag'
  );
  act(() => spring.stop());
});

test('a twice-retargeted finite jump keeps pointer input disabled', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const props = {
    drag: true,
    visibleCount: 3,
    bounds: { min: 0, max: 17 },
    motionConfig: { duration: 1000 },
  };
  const { rerender } = render(<Harness cursor={0} {...props} />);
  rerender(<Harness cursor={17} {...props} />);
  act(() => spring.advance(200));
  const position = spring.get();
  expect(position).toBeGreaterThan(-3);
  expect(position).toBeLessThan(0);
  rerender(<Harness cursor={16} {...props} />);
  const pointer = {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
  };
  fireEvent.pointerDown(screen.getByTestId('carousel'), {
    ...pointer,
    clientX: 1000,
  });
  fireEvent.pointerMove(document, { ...pointer, clientX: 990 });
  expect(spring.get()).toBe(position);
  act(() => spring.stop());
});
