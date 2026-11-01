import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import RCarousel, {
  useCarousel,
  type CarouselController,
  type CarouselMotion,
  type RCarouselProps,
} from '../../index.js';
import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import { mockMotionClock } from '../../../test-config/motionClock.js';
import { useOnResize as mockedResize } from '../hooks/useOnResize.js';
import { motionEnvironment } from '../motion/ScalarMotion.js';

vi.mock('../hooks/useOnResize.js');
const resize = vi.mocked(mockedResize);
let controller: CarouselController;
let renders = 0;
function Example({
  mounted = true,
  ...args
}: RCarouselProps & { mounted?: boolean }) {
  controller = useCarousel();
  renders++;
  return mounted ? (
    <RCarousel controller={controller} {...args}>
      {args.children ??
        Array.from({ length: 20 }, (_, index) => (
          <div key={index} data-item={index}>
            {index}
          </div>
        ))}
    </RCarousel>
  ) : null;
}

beforeEach(() => {
  renders = 0;
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
});

test('motion subscriptions immediately describe measured content, including buffered loop occurrences', () => {
  render(
    <Example mode="loop" defaultAbsoluteIndex={-2} slidesPerView={3} gap={12} />
  );
  const receive = vi.fn<(motion: CarouselMotion) => void>();
  const unsubscribe = controller.subscribeMotion(receive);
  expect(receive).toHaveBeenCalledOnce();
  const motion = receive.mock.lastCall![0];
  expect(motion).toMatchObject({
    position: -2,
    axis: 'horizontal',
    slideSize: 192,
    slidePitch: 204,
    anchor: 96,
  });
  expect(motion.slides).toHaveLength(9);
  for (const slide of motion.slides) {
    expect(slide.element).not.toHaveAttribute('data-carousel-slide');
    expect(slide.element.querySelector('[data-item]')).toHaveAttribute(
      'data-item',
      String(slide.index)
    );
    expect(slide.absoluteIndex - slide.distance).toBe(-2);
  }
  unsubscribe();
});

test('frames bypass React rendering and unsubscribe stops delivery', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  render(<Example animation={{ type: 'duration', duration: 1000 }} />);
  const receive = vi.fn<(motion: CarouselMotion) => void>();
  const unsubscribe = controller.subscribeMotion(receive);
  act(() => controller.next());
  clock.advanceTo(16);
  const before = renders;
  const frames = receive.mock.calls.length;
  for (let time = 32; time <= 160; time += 16) clock.advanceTo(time);
  expect(renders).toBe(before);
  expect(receive.mock.calls.length).toBeGreaterThan(frames + 5);
  expect(receive.mock.lastCall![0].position).toBeCloseTo(0.16);
  unsubscribe();
  const count = receive.mock.calls.length;
  clock.advanceTo(176);
  expect(receive).toHaveBeenCalledTimes(count);
});

test('subscriptions can be registered before attachment and survive StrictMode detach/rebind', () => {
  const { rerender, unmount } = render(
    <StrictMode>
      <Example mounted={false} animation={false} />
    </StrictMode>
  );
  const receive = vi.fn<(motion: CarouselMotion) => void>();
  const unsubscribe = controller.subscribeMotion(receive);
  expect(receive).not.toHaveBeenCalled();
  rerender(
    <StrictMode>
      <Example animation={false} />
    </StrictMode>
  );
  expect(receive).toHaveBeenCalled();
  act(() => controller.goTo(3));
  expect(receive.mock.lastCall![0].position).toBe(3);
  rerender(
    <StrictMode>
      <Example mounted={false} animation={false} />
    </StrictMode>
  );
  const count = receive.mock.calls.length;
  act(() => controller.next());
  expect(receive).toHaveBeenCalledTimes(count);
  const late = vi.fn();
  const unsubscribeLate = controller.subscribeMotion(late);
  expect(late).not.toHaveBeenCalled();
  unsubscribeLate();
  rerender(
    <StrictMode>
      <Example defaultIndex={5} animation={false} />
    </StrictMode>
  );
  expect(receive.mock.lastCall![0].position).toBe(5);
  unmount();
  const after = vi.fn();
  controller.subscribeMotion(after)();
  expect(after).not.toHaveBeenCalled();
  unsubscribe();
});

test('layout commits report axis, center insets, resize and empty content without waiting for movement', async () => {
  const { rerender } = render(
    <Example
      axis="vertical"
      slidesPerView={3}
      snapAlign="center"
      insetStart={20}
    />
  );
  const receive = vi.fn<(motion: CarouselMotion) => void>();
  const unsubscribe = controller.subscribeMotion(receive);
  expect(receive.mock.lastCall![0]).toMatchObject({
    axis: 'vertical',
    anchor: 110,
  });
  resize.mockReturnValue(createCarouselLayout([{ width: 800, height: 300 }]));
  await act(async () => {
    rerender(
      <Example
        axis="vertical"
        slidesPerView={3}
        snapAlign="center"
        insetStart={20}
      />
    );
  });
  expect(receive.mock.lastCall![0]).toMatchObject({ anchor: 160 });
  await act(async () => {
    rerender(<Example children={[]} />);
  });
  expect(receive.mock.lastCall![0].slides).toEqual([]);
  unsubscribe();
});

test.each([false, true])(
  'initial motion commands execute after readiness (StrictMode: %s)',
  (strict) => {
    const wrapper = strict ? StrictMode : undefined;
    const { rerender } = render(<Example mounted={false} animation={false} />, {
      wrapper,
    });
    const frames: { ready: boolean; position: number }[] = [];
    const unsubscribe = controller.subscribeMotion((motion) => {
      frames.push({ ready: controller.isReady, position: motion.position });
      if (frames.length === 1) controller.goTo(6);
    });
    rerender(<Example defaultIndex={5} animation={false} />);
    expect(frames[0]).toEqual({ ready: true, position: 5 });
    expect(frames.every((frame) => frame.ready)).toBe(true);
    expect(controller.index).toBe(6);
    expect(frames[frames.length - 1]?.position).toBe(6);
    unsubscribe();
  }
);

test('motion commands execute after a previously unmeasured viewport becomes ready', () => {
  resize.mockReturnValue(createCarouselLayout([{ width: 0, height: 0 }]));
  const { rerender } = render(<Example defaultIndex={5} animation={false} />);
  const ready: boolean[] = [];
  const unsubscribe = controller.subscribeMotion(() => {
    ready.push(controller.isReady);
    if (ready.length === 1) controller.goTo(6);
  });
  expect(ready).toEqual([]);
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
  rerender(<Example defaultIndex={5} animation={false} />);
  expect(ready.length).toBeGreaterThan(0);
  expect(ready.every((value) => value)).toBe(true);
  expect(controller.index).toBe(6);
  unsubscribe();
});

test('navigation during a committed motion update sees the latest controller target', () => {
  render(<Example animation={false} />);
  const unsubscribe = controller.subscribeMotion((motion) => {
    if (motion.position === 1) controller.next();
  });
  act(() => controller.next());
  expect(controller.index).toBe(2);
  unsubscribe();
});

test('a caught edge recovery preserves pointer movement when items append', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  let time = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => time);
  const props: RCarouselProps = {
    defaultIndex: 5,
    dragMode: 'free-snap',
    crossAxisSize: 'container',
    style: { height: 200 },
  };
  const slides = (count: number) =>
    Array.from({ length: count }, (_, index) => <div key={index}>{index}</div>);
  const { rerender } = render(
    <Example {...props} data-testid="carousel">
      {slides(6)}
    </Example>
  );
  let position = 5;
  const unsubscribe = controller.subscribeMotion((frame) => {
    position = frame.position;
  });
  const root = screen.getByTestId('carousel');
  const pointer = {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientY: 80,
  };
  fireEvent.pointerDown(root, { ...pointer, clientX: 500 });
  time = 16;
  fireEvent.pointerMove(document, { ...pointer, clientX: 200 });
  time = 200;
  fireEvent.pointerUp(document, { ...pointer, buttons: 0, clientX: 200 });
  clock.advanceTo(16);
  expect(position).toBeGreaterThan(5);
  fireEvent.pointerDown(root, { ...pointer, clientX: 400 });
  const caught = position;
  rerender(
    <Example {...props} data-testid="carousel">
      {slides(7)}
    </Example>
  );
  expect(position).toBeCloseTo(caught, 6);
  time = 216;
  fireEvent.pointerMove(document, { ...pointer, clientX: 390 });
  expect(position).toBeCloseTo(caught + 10 / 600, 6);
  unsubscribe();
});

test('a motion callback can detach the carousel before later listeners run', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  const { rerender } = render(
    <Example animation={{ type: 'duration', duration: 1000 }} />
  );
  let detach = true;
  const unsubscribeFirst = controller.subscribeMotion((frame) => {
    if (detach && frame.position > 0.05) {
      detach = false;
      flushSync(() => rerender(<Example mounted={false} />));
    }
  });
  const receive = vi.fn((frame: CarouselMotion) => {
    expect(controller.isReady).toBe(true);
    expect(frame.slides.every((slide) => slide.element.isConnected)).toBe(true);
  });
  const unsubscribeSecond = controller.subscribeMotion(receive);
  act(() => controller.next());
  clock.advanceTo(16);
  clock.advanceTo(32);
  const before = receive.mock.calls.length;
  clock.advanceTo(64);
  expect(controller.isReady).toBe(false);
  expect(receive).toHaveBeenCalledTimes(before);
  rerender(<Example defaultIndex={3} animation={false} />);
  expect(receive.mock.lastCall![0].position).toBe(3);
  unsubscribeFirst();
  unsubscribeSecond();
});

test.each(['subscribe', 'rerender', 'reconfigure'] as const)(
  'a listener can %s while other listeners still receive the current frame',
  (action) => {
    vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
    const clock = mockMotionClock();
    const animation = { type: 'duration' as const, duration: 1000 };
    const { rerender } = render(<Example animation={animation} />);
    const added = vi.fn();
    let unsubscribeAdded: (() => void) | undefined;
    let pending = true;
    const unsubscribeFirst = controller.subscribeMotion((frame) => {
      if (!pending || frame.position <= 0.05) return;
      pending = false;
      if (action === 'subscribe')
        unsubscribeAdded = controller.subscribeMotion(added);
      else
        flushSync(() =>
          rerender(
            <Example
              animation={animation}
              slidesPerView={action === 'reconfigure' ? 2 : 1}
            />
          )
        );
    });
    const receive = vi.fn();
    const unsubscribeSecond = controller.subscribeMotion(receive);
    act(() => controller.next());
    clock.advanceTo(16);
    clock.advanceTo(32);
    const before = receive.mock.calls.length;
    clock.advanceTo(64);
    expect(pending).toBe(false);
    expect(receive).toHaveBeenCalledTimes(before + 1);
    expect(receive.mock.lastCall![0].position).toBeCloseTo(
      action === 'reconfigure' ? 1 : 0.064
    );
    if (action === 'subscribe') {
      expect(added).toHaveBeenCalledOnce();
      expect(added.mock.lastCall![0].position).toBeCloseTo(0.064);
    }
    unsubscribeFirst();
    unsubscribeSecond();
    unsubscribeAdded?.();
  }
);

test('a consumer can store frames in React without a render feedback loop', () => {
  function Consumer() {
    const navigation = useCarousel();
    controller = navigation;
    const [frame, setFrame] = useState<CarouselMotion | null>(null);
    useEffect(() => navigation.subscribeMotion(setFrame), [navigation]);
    return (
      <>
        <RCarousel controller={navigation} animation={false}>
          <div>First</div>
          <div>Second</div>
        </RCarousel>
        <output data-testid="rendered-frame">{frame?.position}</output>
      </>
    );
  }
  render(
    <StrictMode>
      <Consumer />
    </StrictMode>
  );
  expect(screen.getByTestId('rendered-frame')).toHaveTextContent('0');
  act(() => controller.next());
  expect(screen.getByTestId('rendered-frame')).toHaveTextContent('1');
});
