import { mockMotionClock } from '../../../test-config/motionClock.js';
import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import React, { createRef, StrictMode, useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import RCarousel, { useCarousel } from '../../index.js';
import type { CarouselController, RCarouselProps } from '../../index.js';
import { useOnResize as mockedResize } from '../hooks/useOnResize.js';
import { motionEnvironment } from '../motion/ScalarMotion.js';
import { getTestSlides, swipe } from './tools/index.js';

vi.mock('../hooks/useOnResize.js');
const resize = vi.mocked(mockedResize);
let navigation: CarouselController;

function Example({ count = 8, ...props }: RCarouselProps & { count?: number }) {
  navigation = useCarousel();
  return (
    <>
      <button {...navigation.getPrevButtonProps()}>Previous</button>
      <RCarousel controller={navigation} data-testid="carousel" {...props}>
        {props.children ?? getTestSlides(count)}
      </RCarousel>
      <button {...navigation.getNextButtonProps()}>Next</button>
      <output data-testid="position">{navigation.absoluteIndex}</output>
    </>
  );
}

beforeEach(() => {
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
});

test('binds immediate navigation, snaps long swipes in step increments, and trims finite bounds', () => {
  const navigate = vi.fn();
  render(
    <Example
      slidesPerView={3}
      slidesToScroll={2}
      animation={false}
      onNavigate={navigate}
    />
  );
  expect(navigation).toMatchObject({
    index: 0,
    absoluteIndex: 0,
    slideCount: 8,
    slidesPerView: 3,
    canPrev: false,
    canNext: true,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(navigation.absoluteIndex).toBe(2);
  swipe(screen.getByTestId('carousel'), [500, 0], [0, 0]);
  expect(navigation.absoluteIndex).toBe(4);
  act(() => navigation.next());
  expect(navigation.absoluteIndex).toBe(5);
  expect(navigation.canNext).toBe(false);
  act(() => navigation.next());
  expect(navigate).toHaveBeenLastCalledWith({
    direction: 'next',
    source: 'api',
    blocked: true,
  });
});

test.each([
  [-1, 0],
  [-1, 150],
  [1, 0],
  [1, 150],
])(
  'reversing toward the starting slide in direction %i still snaps back after a %ims pause',
  (direction, pause) => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<Example mode="loop" animation={false} />);
    const pointer = {
      pointerId: 18,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
    };
    fireEvent.pointerDown(screen.getByTestId('carousel'), {
      ...pointer,
      clientX: 500,
    });
    now = 10;
    fireEvent.pointerMove(document, {
      ...pointer,
      clientX: 500 + direction * 480,
    });
    expect(navigation.isAnimating).toBe(true);
    now = 20;
    fireEvent.pointerMove(document, {
      ...pointer,
      clientX: 500 + direction * 120,
    });
    now += pause;
    fireEvent.pointerUp(document, {
      ...pointer,
      buttons: 0,
      clientX: 500 + direction * 120,
    });
    expect(navigation.absoluteIndex).toBe(0);
  }
);

test.each([-1, 1])(
  'a short swipe in direction %i still advances one slide after a pause',
  (direction) => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<Example mode="loop" animation={false} />);
    const pointer = {
      pointerId: 18,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    };
    fireEvent.pointerDown(screen.getByTestId('carousel'), {
      ...pointer,
      clientX: 500,
    });
    now = 10;
    fireEvent.pointerMove(document, {
      ...pointer,
      clientX: 500 + direction * 120,
    });
    now = 200;
    fireEvent.pointerUp(document, {
      ...pointer,
      buttons: 0,
      clientX: 500 + direction * 120,
    });
    expect(navigation.absoluteIndex).toBe(-direction);
  }
);

test.each([
  [1, 2.2, 2],
  [1, 2.8, 3],
  [2, 4.2, 4],
  [2, 5.2, 6],
  [2, 20, 17],
])(
  'a long drag with step %i over %s slides selects %i',
  (step, distance, expected) => {
    render(
      <Example
        count={20}
        slidesPerView={3}
        slidesToScroll={step}
        gap={16}
        animation={false}
      />
    );
    const carousel = screen.getByTestId('carousel');
    const pointer = {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
    };
    fireEvent.pointerDown(carousel, { ...pointer, clientX: 1000 });
    fireEvent.pointerMove(document, {
      ...pointer,
      clientX: 1000 - distance * (616 / 3),
    });
    expect(navigation.absoluteIndex).toBe(0);
    fireEvent.pointerUp(document, {
      ...pointer,
      buttons: 0,
      clientX: 1000 - distance * (616 / 3),
    });
    expect(navigation.absoluteIndex).toBe(expected);
  }
);

test('accumulates synchronous commands and uses direct moveBy semantics', () => {
  render(<Example animation={false} />);
  act(() => {
    navigation.next();
    navigation.next();
    navigation.moveBy(2);
  });
  expect(navigation.absoluteIndex).toBe(4);
  act(() => navigation.moveBy(0));
  expect(navigation.absoluteIndex).toBe(4);
});

test('drag attempts during a compressed finite jump do not emit navigation', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  let frame: FrameRequestCallback;
  vi.spyOn(motionEnvironment, 'requestFrame').mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  vi.spyOn(motionEnvironment, 'cancelFrame').mockImplementation(() => {});
  const now = vi.spyOn(motionEnvironment, 'now').mockReturnValue(0);
  const navigate = vi.fn();
  render(
    <Example
      defaultIndex={5}
      slidesPerView={3}
      animation={{ type: 'duration', duration: 1000 }}
      onNavigate={navigate}
    />
  );
  act(() => navigation.goTo(0));
  now.mockReturnValue(64);
  act(() => frame(64));
  navigate.mockClear();
  swipe(screen.getByTestId('carousel'), [100, 0], [220, 0]);
  expect(navigation.absoluteIndex).toBe(0);
  expect(navigate).not.toHaveBeenCalled();
});

test.each(['defaultIndex', 'defaultAbsoluteIndex'] as const)(
  '%s is read only on mount',
  (name) => {
    const { rerender } = render(
      <RCarousel {...{ [name]: 2 }} animation={false}>
        {getTestSlides(5)}
      </RCarousel>
    );
    rerender(
      <RCarousel {...{ [name]: 4 }} animation={false}>
        {getTestSlides(5)}
      </RCarousel>
    );
    expect(
      screen.getByTestId('slide3').closest('[data-carousel-slide]')
    ).toHaveStyle({ transform: 'translate3d(0%, 0%, 0)' });
  }
);

test('selects nearest loop occurrences and prefers forward ties', () => {
  render(
    <Example
      count={6}
      mode="loop"
      defaultAbsoluteIndex={-1}
      animation={false}
    />
  );
  act(() => navigation.goTo(1));
  expect(navigation.absoluteIndex).toBe(1);
  act(() => navigation.goTo(4));
  expect(navigation.absoluteIndex).toBe(4);
  act(() => navigation.goToAbsolute(-1_000_000));
  expect(navigation).toMatchObject({ absoluteIndex: -1_000_000, index: 2 });
});

test('controlled local indexes accept requests across loop boundaries without echoing props', () => {
  const change = vi.fn();
  function Controlled({ external }: { external?: number }) {
    const [index, setIndex] = useState(2);
    return (
      <Example
        count={3}
        mode="loop"
        index={external ?? index}
        animation={false}
        onIndexChange={(next, details) => {
          change(next, details);
          setIndex(next);
        }}
      />
    );
  }
  const { rerender } = render(<Controlled />);
  act(() => navigation.next());
  expect(navigation).toMatchObject({ index: 0, absoluteIndex: 3 });
  expect(change).toHaveBeenCalledExactlyOnceWith(0, {
    index: 0,
    absoluteIndex: 3,
    reason: 'api',
  });
  rerender(<Controlled external={1} />);
  expect(navigation).toMatchObject({ index: 1, absoluteIndex: 4 });
  expect(change).toHaveBeenCalledTimes(1);
});

test.each(['index', 'absoluteIndex'] as const)(
  'a rejected controlled %s request returns to the authoritative position',
  (prop) => {
    const change = vi.fn();
    render(
      <Example {...{ [prop]: 0 }} animation={false} onIndexChange={change} />
    );
    swipe(screen.getByTestId('carousel'), [300, 0], [200, 0]);
    expect(navigation.absoluteIndex).toBe(0);
    expect(change).toHaveBeenCalledExactlyOnceWith(1, {
      index: 1,
      absoluteIndex: 1,
      reason: 'drag',
    });
  }
);

test('uses container breakpoints, merges overrides, and offers window-based breakpoints', () => {
  const breakpoints = {
    400: { slidesPerView: 2, slidesToScroll: 2, gap: 24 },
    800: { slidesPerView: 3 },
  };
  const { rerender } = render(
    <Example breakpoints={breakpoints} animation={false} />
  );
  expect(navigation.slidesPerView).toBe(2);
  expect(screen.getByTestId('carousel').firstElementChild).toHaveStyle({
    paddingRight: '24px',
  });
  act(() => navigation.next());
  expect(navigation.absoluteIndex).toBe(2);
  rerender(
    <Example
      breakpoints={breakpoints}
      breakpointsBase="window"
      animation={false}
    />
  );
  expect(navigation.slidesPerView).toBe(3);
  expect(screen.getByTestId('carousel').firstElementChild).toHaveStyle({
    paddingRight: '24px',
  });
  act(() => navigation.next());
  expect(navigation.absoluteIndex).toBe(4);
});

test('auto sizing computes a uniform count and defaults to one slide before measurement', () => {
  render(<Example slidesPerView="auto" maxSlideSize={250} animation={false} />);
  expect(navigation.slidesPerView).toBe(3);
});

test('auto sizing includes gaps when computing the smallest count', () => {
  render(
    <Example
      slidesPerView="auto"
      maxSlideSize={190}
      gap={16}
      animation={false}
    />
  );
  expect(navigation.slidesPerView).toBe(3);
  expect(screen.getByTestId('carousel')).not.toHaveAttribute('gap');
});

test('percentage swipe thresholds refer to content size, excluding the gap', () => {
  render(
    <Example
      slidesPerView={3}
      gap={30}
      swipeThreshold="50%"
      animation={false}
    />
  );
  // 180px of content and a 30px gap: a 95px drag clears the 90px threshold.
  swipe(screen.getByTestId('carousel'), [300, 0], [205, 0]);
  expect(navigation.index).toBe(1);
});

test('waits for room for slide content when gaps consume the viewport', () => {
  const { rerender } = render(
    <Example slidesPerView={3} gap={300} animation={false} />
  );
  expect(navigation.isReady).toBe(false);
  act(() => navigation.next());
  expect(navigation.index).toBe(0);
  rerender(<Example slidesPerView={3} gap={0} animation={false} />);
  expect(navigation.isReady).toBe(true);
  act(() => navigation.next());
  expect(navigation.index).toBe(1);
});

test('resize and child-count corrections request the resolved position exactly once', () => {
  const change = vi.fn();
  const breakpoints = { 800: { slidesPerView: 3 } };
  const { rerender } = render(
    <Example
      defaultIndex={7}
      breakpoints={breakpoints}
      animation={false}
      onIndexChange={change}
    />
  );
  expect(navigation.index).toBe(7);
  resize.mockReturnValue(createCarouselLayout([{ width: 1000, height: 200 }]));
  rerender(
    <Example
      defaultIndex={7}
      breakpoints={breakpoints}
      animation={false}
      onIndexChange={change}
    />
  );
  expect(navigation.index).toBe(5);
  expect(change).toHaveBeenCalledExactlyOnceWith(5, {
    index: 5,
    absoluteIndex: 5,
    reason: 'resize',
  });
  change.mockClear();
  rerender(
    <Example
      count={4}
      defaultIndex={7}
      breakpoints={breakpoints}
      animation={false}
      onIndexChange={change}
    />
  );
  expect(navigation.index).toBe(1);
  expect(change).toHaveBeenCalledExactlyOnceWith(1, {
    index: 1,
    absoluteIndex: 1,
    reason: 'slides-change',
  });
});

test.each([
  [5, 3],
  [-1, -1],
  [-4, -3],
])(
  'removing the selected loop slide at %i stays in its cycle at %i and notifies once',
  (initial, expected) => {
    const localChange = vi.fn();
    const absoluteChange = vi.fn();
    const props = {
      defaultAbsoluteIndex: initial,
      mode: 'loop' as const,
      animation: false as const,
      onIndexChange: localChange,
      onAbsoluteIndexChange: absoluteChange,
    };
    const { rerender } = render(<Example count={3} {...props} />);
    rerender(<Example count={2} {...props} />);
    expect(navigation).toMatchObject({ index: 1, absoluteIndex: expected });
    const details = {
      index: 1,
      absoluteIndex: expected,
      reason: 'slides-change',
    };
    expect(localChange).toHaveBeenCalledExactlyOnceWith(1, details);
    expect(absoluteChange).toHaveBeenCalledExactlyOnceWith(expected, details);
  }
);

test('full-cycle moves preserve the local index and notify only the absolute handler', () => {
  const localChange = vi.fn();
  const absoluteChange = vi.fn();
  render(
    <Example
      count={3}
      mode="loop"
      index={0}
      animation={false}
      onIndexChange={localChange}
      onAbsoluteIndexChange={absoluteChange}
    />
  );
  act(() => navigation.moveBy(3));
  expect(navigation).toMatchObject({ index: 0, absoluteIndex: 3 });
  expect(localChange).not.toHaveBeenCalled();
  expect(absoluteChange).toHaveBeenCalledExactlyOnceWith(3, {
    index: 0,
    absoluteIndex: 3,
    reason: 'api',
  });
});

test('forward-loop and insufficient-slide bounds remain explicit', () => {
  const { rerender } = render(
    <Example
      count={3}
      mode="forward-loop"
      defaultAbsoluteIndex={100}
      animation={false}
    />
  );
  act(() => navigation.goTo(0));
  expect(navigation.absoluteIndex).toBe(99);
  act(() => navigation.goToAbsolute(-100));
  expect(navigation.absoluteIndex).toBe(0);
  expect(navigation.canPrev).toBe(false);
  rerender(
    <Example
      count={3}
      mode="forward-loop"
      slidesPerView={4}
      animation={false}
    />
  );
  expect(navigation).toMatchObject({
    absoluteIndex: 0,
    canNext: false,
    absoluteBounds: { min: 0, max: 0 },
  });
});

test('changing a root id and rebinding controllers keeps getters connected', () => {
  const { rerender, unmount } = render(
    <Example id="before" animation={false} />
  );
  const previous = navigation;
  rerender(<Example id="after" animation={false} />);
  expect(navigation.getNextButtonProps()['aria-controls']).toBe('after');
  expect(navigation.canNext).toBe(true);
  unmount();
  render(<Example id="replacement" animation={false} />);
  expect(previous.isReady).toBe(false);
  expect(navigation.getNextButtonProps()['aria-controls']).toBe('replacement');
});

test('hidden initialization preserves absolute positions and disables commands until measured', () => {
  resize.mockReturnValue(createCarouselLayout([{ width: 0, height: 200 }]));
  const { rerender } = render(
    <Example mode="forward-loop" defaultAbsoluteIndex={100} animation={false} />
  );
  expect(navigation).toMatchObject({
    absoluteIndex: 100,
    isReady: false,
    canNext: false,
  });
  act(() => navigation.next());
  expect(navigation.absoluteIndex).toBe(100);
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
  rerender(
    <Example mode="forward-loop" defaultAbsoluteIndex={100} animation={false} />
  );
  expect(navigation).toMatchObject({
    absoluteIndex: 100,
    isReady: true,
    canNext: true,
  });
});

test.each([100, -1])(
  'an unmeasured empty collection preserves default position %i when slides and layout arrive',
  (initial) => {
    const sizes = [{ width: 0, height: 200 }];
    resize.mockReturnValue({
      sizes,
      sizesByKey: new Map(),
      add: vi.fn(),
      remove: vi.fn(),
      update: vi.fn(),
      refresh: vi.fn(),
    });
    const change = vi.fn();
    const props = {
      defaultAbsoluteIndex: initial,
      mode: 'loop' as const,
      animation: false as const,
      onAbsoluteIndexChange: change,
    };
    const { rerender } = render(<Example count={0} {...props} />);
    expect(navigation).toMatchObject({
      absoluteIndex: initial,
      isReady: false,
    });
    sizes[0].width = 600;
    rerender(<Example count={3} {...props} />);
    expect(navigation).toMatchObject({ absoluteIndex: initial, isReady: true });
    expect(change).not.toHaveBeenCalled();
  }
);

test('empty collections disable navigation and detaching a controller clears readiness', () => {
  const { unmount } = render(<Example count={0} />);
  expect(navigation.canNext).toBe(false);
  act(() => navigation.goTo(1));
  const controller = navigation;
  unmount();
  expect(controller.isReady).toBe(false);
  expect(() => controller.next()).not.toThrow();
});

test('button prop getters prevent form submission and compose cancellable handlers', () => {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  function Form() {
    navigation = useCarousel();
    return (
      <form onSubmit={submit}>
        <RCarousel id="products" controller={navigation} animation={false}>
          {getTestSlides(4)}
        </RCarousel>
        <button {...navigation.getNextButtonProps()}>Next</button>
        <button
          {...navigation.getNextButtonProps({
            onClick: (event) => event.preventDefault(),
          })}
        >
          Cancelled
        </button>
      </form>
    );
  }
  render(<Form />);
  expect(screen.getByRole('button', { name: 'Next' })).toHaveAttribute(
    'aria-controls',
    'products'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(navigation.index).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
  expect(navigation.index).toBe(1);
  expect(submit).not.toHaveBeenCalled();
});

test('forwards a root ref, labels slides, and honors gesture cancellation and editable targets', () => {
  const ref = createRef<HTMLDivElement>();
  const change = vi.fn();
  const { rerender } = render(
    <RCarousel
      ref={ref}
      aria-label="Products"
      animation={false}
      onIndexChange={change}
      onPointerDown={(event) => event.preventDefault()}
    >
      {getTestSlides(3)}
    </RCarousel>
  );
  expect(ref.current).toHaveAttribute('aria-roledescription', 'carousel');
  expect(screen.getByRole('group', { name: '1 of 3' })).toHaveAttribute(
    'aria-roledescription',
    'slide'
  );
  swipe(ref.current!, [300, 0], [200, 0]);
  expect(change).not.toHaveBeenCalled();
  rerender(
    <RCarousel ref={ref} animation={false} onIndexChange={change}>
      <input aria-label="Editable" />
      <div data-carousel-no-drag="">No drag</div>
      <div>Last</div>
    </RCarousel>
  );
  swipe(screen.getByRole('textbox'), [300, 0], [200, 0]);
  swipe(screen.getByText('No drag'), [300, 0], [200, 0]);
  expect(change).not.toHaveBeenCalled();
});

test('notifies state once per logical snapshot and settles immediate transitions once under StrictMode', () => {
  const state = vi.fn();
  const settle = vi.fn();
  render(
    <StrictMode>
      <Example animation={false} onStateChange={state} onSettle={settle} />
    </StrictMode>
  );
  const readyCalls = state.mock.calls.filter(
    ([snapshot]) => snapshot.isReady && !snapshot.isAnimating
  );
  expect(readyCalls).toHaveLength(1);
  expect(settle).not.toHaveBeenCalled();
  act(() => navigation.next());
  expect(settle).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ index: 1, absoluteIndex: 1, isAnimating: false })
  );
});

test('interrupted destinations do not settle and duration configuration reaches the final target', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  let now = 0;
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(motionEnvironment, 'now').mockImplementation(() => now);
  vi.spyOn(motionEnvironment, 'requestFrame').mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  vi.spyOn(motionEnvironment, 'cancelFrame').mockImplementation(() => {});
  const settle = vi.fn();
  render(
    <Example
      animation={{ type: 'duration', duration: 100 }}
      onSettle={settle}
    />
  );
  act(() => navigation.goTo(2));
  act(() => {
    now = 40;
    frame(now);
  });
  act(() => navigation.goTo(5));
  act(() => {
    now = 140;
    frame(now);
  });
  // The engine rebases on the next browser frame.
  for (now = 156; now <= 252; now += 16) act(() => frame(now));
  await waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
  expect(settle).toHaveBeenLastCalledWith(
    expect.objectContaining({ absoluteIndex: 5 })
  );
});

test.each<RCarouselProps>([
  { index: 1, absoluteIndex: 2 },
  { slidesPerView: 2, maxSlideSize: 200 },
  { slidesToScroll: 0 },
  { dragMode: 'elastic' as RCarouselProps['dragMode'] },
  { wheel: 'horizontal' as unknown as boolean },
  { gap: -1 },
  { gap: Infinity },
  { gap: NaN },
  { gap: '16px' as unknown as number },
  { breakpoints: { 400: { gap: -1 } } },
  { swipeThreshold: '10rem' as RCarouselProps['swipeThreshold'] },
])('rejects conflicting or invalid configuration: %j', (props) => {
  expect(() =>
    render(<RCarousel {...props}>{getTestSlides(4)}</RCarousel>)
  ).toThrow();
});

test('fractional trimming preserves integer navigation, terminal geometry, and pagination', () => {
  render(<Example slidesPerView={2.5} gap={20} animation={false} />);
  act(() => navigation.goTo(7));
  expect(navigation).toMatchObject({
    index: 6,
    absoluteIndex: 6,
    absoluteBounds: { min: 0, max: 6 },
    slidesPerView: 2.5,
    canNext: false,
  });
  expect(navigation.getPageSlideIndex(navigation.pageCount - 1)).toBe(6);
  const actor = screen
    .getByTestId('slide7')
    .closest('[data-carousel-slide]') as HTMLElement;
  expect(actor.style.transform).toBe('translate3d(50%, 0%, 0)');
  swipe(screen.getByTestId('carousel'), [100, 0], [220, 0]);
  expect(navigation.index).toBe(5);
  expect(Number.isInteger(navigation.absoluteIndex)).toBe(true);
});

test.each(['horizontal', 'vertical'] as const)(
  '%s centered endpoints allow visible previews and keep buffers inert',
  (axis) => {
    render(
      <Example
        axis={axis}
        slidesPerView={1.2}
        snapAlign="center"
        insetStart={20}
        insetEnd={20}
        animation={false}
      />
    );
    act(() => navigation.goTo(7));
    expect(navigation.absoluteBounds).toEqual({ min: 0, max: 7 });
    expect(navigation.index).toBe(7);
    const root = screen.getByTestId('carousel');
    expect(
      root.querySelectorAll('[data-carousel-slide]:not([inert])')
    ).toHaveLength(2);
    expect(
      screen.getByTestId('slide8').closest('[data-carousel-slide]')
    ).not.toHaveAttribute('inert');
    expect(
      screen.getByTestId('slide7').closest('[data-carousel-slide]')
    ).not.toHaveAttribute('inert');
    expect(
      screen.getByTestId('slide6').closest('[data-carousel-slide]')
    ).toHaveAttribute('inert');
  }
);

test('breakpoints override alignment and insets without changing local position', () => {
  render(
    <Example
      defaultIndex={3}
      slidesPerView={1}
      breakpoints={{
        400: {
          slidesPerView: 2.5,
          snapAlign: 'center',
          insetStart: '10%',
          insetEnd: 0,
        },
      }}
      animation={false}
    />
  );
  expect(navigation.index).toBe(3);
  expect(navigation.slidesPerView).toBe(2.5);
  const actor = screen
    .getByTestId('slide4')
    .closest('[data-carousel-slide]') as HTMLElement;
  expect(actor.style.left).toBe('222px');
});

test.each<RCarouselProps>([
  { slidesPerView: 0.5 },
  { slidesPerView: NaN },
  { slidesPerView: Infinity },
  { insetStart: -1 },
  { insetEnd: '-1%' },
  { insetStart: '2rem' as never },
  { snapAlign: 'end' as never },
  { breakpoints: { 100: { insetEnd: -1 } } },
])('rejects invalid fractional layout configuration: %j', (props) => {
  expect(() => render(<Example {...props} />)).toThrow();
});

test.each([1.2, 2.5, 3.8])(
  'capacity %s reports short blocked swipes at its fractional end',
  (slidesPerView) => {
    const navigate = vi.fn();
    render(
      <Example
        slidesPerView={slidesPerView}
        animation={false}
        onNavigate={navigate}
      />
    );
    act(() => navigation.goTo(7));
    const last = navigation.index;
    navigate.mockClear();
    swipe(screen.getByTestId('carousel'), [300, 0], [240, 0]);
    expect(navigation.index).toBe(last);
    expect(navigate).toHaveBeenCalledExactlyOnceWith({
      direction: 'next',
      source: 'drag',
      blocked: true,
    });
  }
);

test.each([2.5, 3.8])(
  'capacity %s catches the nearest physical terminal snap before reversing',
  (slidesPerView) => {
    vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const clock = mockMotionClock();
    const last = Math.ceil(8 - slidesPerView);
    render(
      <Example
        slidesPerView={slidesPerView}
        defaultIndex={last - 1}
        animation={{ type: 'duration', duration: 1000 }}
      />
    );
    act(() => navigation.next());
    for (let time = 60; time <= 900; time += 60) clock.advanceTo(time);
    swipe(screen.getByTestId('carousel'), [300, 0], [340, 0]);
    expect(navigation.index).toBe(last - 1);
  }
);

test.each<RCarouselProps & { count?: number }>([
  { slidesPerView: 3, gap: 300 },
  { slidesPerView: 1.2, gap: 16, insetStart: 400, insetEnd: 400 },
  { count: 0, gap: 16 },
])('ignores gestures without a usable layout or slides: %j', (props) => {
  const change = vi.fn();
  const navigate = vi.fn();
  render(
    <Example
      {...props}
      animation={false}
      onIndexChange={change}
      onNavigate={navigate}
    />
  );
  swipe(screen.getByTestId('carousel'), [500, 0], [0, 0]);
  expect(navigation.index).toBe(0);
  expect(navigation.isAnimating).toBe(false);
  expect(change).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

test('losing readiness cancels an active gesture and restoration requires a fresh press', () => {
  const change = vi.fn();
  const { rerender } = render(
    <Example
      gap={16}
      slidesPerView={1.2}
      animation={false}
      onIndexChange={change}
    />
  );
  const root = screen.getByTestId('carousel');
  const pointer = {
    pointerId: 3,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
  };
  fireEvent.pointerDown(root, { ...pointer, clientX: 500 });
  fireEvent.pointerMove(document, { ...pointer, clientX: 450 });
  expect(navigation.isAnimating).toBe(true);
  rerender(
    <Example
      gap={16}
      slidesPerView={1.2}
      insetStart={400}
      insetEnd={400}
      animation={false}
      onIndexChange={change}
    />
  );
  expect(navigation.isReady).toBe(false);
  expect(navigation.isAnimating).toBe(false);
  rerender(
    <Example
      gap={16}
      slidesPerView={1.2}
      animation={false}
      onIndexChange={change}
    />
  );
  fireEvent.pointerMove(document, { ...pointer, clientX: 0 });
  fireEvent.pointerUp(document, { ...pointer, clientX: 0 });
  expect(change).not.toHaveBeenCalled();
  swipe(root, [500, 0], [300, 0]);
  expect(navigation.index).toBe(1);
});
