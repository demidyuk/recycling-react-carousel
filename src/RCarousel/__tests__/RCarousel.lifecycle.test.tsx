import { mockMotionClock } from '../../../test-config/motionClock.js';
import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import React, { startTransition, Suspense, useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { motionEnvironment } from '../motion/ScalarMotion.js';
import { beforeEach, expect, test, vi } from 'vitest';
import { RCarousel } from '../RCarousel.js';
import type { RCarouselProps } from '../RCarousel.js';
import { useOnResize as mockedUseOnResize } from '../hooks/useOnResize.js';
import { getTestSlides, swipe } from './tools/index.js';

vi.mock('../hooks/useOnResize.js');

const useOnResize = vi.mocked(mockedUseOnResize);
const pointer = {
  pointerId: 1,
  pointerType: 'touch',
  isPrimary: true,
  buttons: 1,
};
const slides = getTestSlides(5);
const Carousel = (props: RCarouselProps) => (
  <RCarousel data-testid="carousel" {...props}>
    {props.children ?? slides}
  </RCarousel>
);
const actor = (name: string) =>
  screen.getByTestId(name).closest('[data-carousel-slide]') as HTMLElement;
const startDrag = () => {
  const carousel = screen.getByTestId('carousel');
  fireEvent.pointerDown(carousel, { ...pointer, clientX: 1000, clientY: 200 });
  fireEvent.pointerMove(carousel, { ...pointer, clientX: 900, clientY: 180 });
  return carousel;
};
const endDrag = (carousel: HTMLElement) => {
  fireEvent.pointerUp(carousel, {
    ...pointer,
    buttons: 0,
    clientX: 900,
    clientY: 180,
  });
};

beforeEach(() => {
  useOnResize.mockReturnValue(
    createCarouselLayout([{ width: 1000, height: 200 }])
  );
});

test('settling a large jump preserves the incoming component and its state', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  let now: number;
  let nextIdentity = 0;
  function StatefulSlide({ index }: { index: number }) {
    const [identity] = useState(() => ++nextIdentity);
    return (
      <input
        data-testid={`stateful-${index}`}
        data-identity={identity}
        defaultValue={`Item ${index}`}
      />
    );
  }
  const children = Array.from({ length: 5 }, (_, index) => (
    <StatefulSlide key={index} index={index} />
  ));
  const onAbsoluteIndexChange = vi.fn();
  const props = {
    mode: 'loop' as const,
    slidesPerView: 1,
    animation: { type: 'duration' as const, duration: 100 },
    onAbsoluteIndexChange,
    children,
  };
  const { rerender } = render(<Carousel {...props} absoluteIndex={0} />);
  rerender(<Carousel {...props} absoluteIndex={1_000_001} />);
  for (now = 16; now <= 96; now += 16) clock.advanceTo(now);
  const incoming = screen.getByTestId('stateful-1');
  const identity = incoming.dataset.identity;
  const carrier = incoming.closest('[data-carousel-slide]') as HTMLElement;
  fireEvent.change(incoming, { target: { value: 'Preserved state' } });
  clock.advanceTo(now);
  await waitFor(() => expect(carrier).not.toHaveAttribute('inert'));
  expect(screen.getByTestId('stateful-1')).toBe(incoming);
  expect(incoming.dataset.identity).toBe(identity);
  expect(incoming).toHaveValue('Preserved state');
  expect(carrier.style.transform).toBe('translate3d(0%, 0%, 0)');
  expect(screen.getByTestId('carousel').children).toHaveLength(3);
  expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
});

test('a suspended absoluteIndex render cannot change the committed swipe origin', () => {
  const onAbsoluteIndexChange = vi.fn();
  const suspended = new Promise<never>(() => {});
  let setCursor: React.Dispatch<React.SetStateAction<number>> = () => {};
  function Pending({ absoluteIndex }: { absoluteIndex: number }) {
    if (absoluteIndex === 1) throw suspended;
    return null;
  }
  function App() {
    const [absoluteIndex, set] = useState(0);
    setCursor = set;
    return (
      <Suspense fallback={<div>Loading</div>}>
        <Carousel
          absoluteIndex={absoluteIndex}
          onAbsoluteIndexChange={onAbsoluteIndexChange}
        />
        <Pending absoluteIndex={absoluteIndex} />
      </Suspense>
    );
  }

  render(<App />);
  act(() => startTransition(() => setCursor(1)));
  expect(actor('slide1').style.transform).toContain('translate3d(0%');

  swipe(screen.getByTestId('carousel'), [1000, 0], [0, 0]);
  expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
    1,
    expect.objectContaining({ reason: 'drag' })
  );
});

test('a child-count correction cancels the old drag before another swipe', async () => {
  const requests: number[] = [];
  function App({ count }: { count: number }) {
    const [position, setPosition] = useState(100);
    return (
      <Carousel
        absoluteIndex={position}
        mode="forward-loop"
        onAbsoluteIndexChange={(absoluteIndex) => {
          requests.push(absoluteIndex);
          setPosition(absoluteIndex);
        }}
      >
        {getTestSlides(count)}
      </Carousel>
    );
  }
  const { rerender } = render(<App count={3} />);
  const carousel = startDrag();
  rerender(<App count={4} />);
  fireEvent.pointerMove(carousel, { ...pointer, clientX: 400, clientY: 180 });
  fireEvent.pointerUp(carousel, {
    ...pointer,
    buttons: 0,
    clientX: 400,
    clientY: 180,
  });
  expect(requests).toEqual([133]);

  swipe(carousel, [1000, 0], [0, 0]);
  expect(requests).toEqual([133, 134]);
});

test.each([
  ['disabled drag', { drag: false }],
  ['axis change', { axis: 'vertical' }],
  ['collection mode', { mode: 'loop' }],
  ['visible count', { slidesPerView: 2 }],
] satisfies Array<[string, RCarouselProps]>)(
  'cancels an active drag on %s and accepts controlled navigation',
  async (_name, changedProps) => {
    const onAbsoluteIndexChange = vi.fn();
    const { rerender } = render(
      <Carousel
        absoluteIndex={0}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      />
    );
    const carousel = startDrag();
    rerender(
      <Carousel
        absoluteIndex={0}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
        {...changedProps}
      />
    );
    endDrag(carousel);
    expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    rerender(
      <Carousel
        absoluteIndex={1}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
        {...changedProps}
      />
    );
    await waitFor(() =>
      expect(actor('slide2').style.transform).toBe('translate3d(0%, 0%, 0)')
    );
  }
);

test('a viewport change during drag does not turn the next move into a relocation', () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const requestFrame = vi.spyOn(motionEnvironment, 'requestFrame');
  const animation = { type: 'duration' as const, duration: 10_000 };
  const { rerender } = render(
    <Carousel absoluteIndex={0} slidesPerView={1} animation={animation} />
  );
  const carousel = startDrag();
  rerender(
    <Carousel absoluteIndex={0} slidesPerView={2} animation={animation} />
  );
  endDrag(carousel);
  requestFrame.mockClear();
  rerender(
    <Carousel absoluteIndex={1} slidesPerView={2} animation={animation} />
  );

  expect(requestFrame).toHaveBeenCalledOnce();
  expect(actor('slide2').style.transform).toBe('translate3d(100%, 0%, 0)');
  expect(actor('slide2')).not.toHaveAttribute('inert');
});

test.each([
  ['threshold', { swipeThreshold: '25px' }, {}, 1],
  [
    'swipe step',
    { slidesPerView: 1, slidesToScroll: 2 },
    { slidesPerView: 1, slidesToScroll: 1, swipeThreshold: '25px' },
    2,
  ],
] satisfies Array<[string, RCarouselProps, RCarouselProps, number]>)(
  'commits %s without cancelling the active gesture',
  (_name, changedProps, initialProps, expectedCursor) => {
    const onAbsoluteIndexChange = vi.fn();
    const { rerender } = render(
      <Carousel
        absoluteIndex={0}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
        {...initialProps}
      />
    );
    const carousel = startDrag();
    rerender(
      <Carousel
        absoluteIndex={0}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
        {...initialProps}
        {...changedProps}
      />
    );
    endDrag(carousel);
    expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
      expectedCursor,
      expect.objectContaining({ reason: 'drag' })
    );
  }
);

test.each([100, -100])(
  'settles a finite out-of-range absoluteIndex %s without draining an unreachable target',
  (absoluteIndex) => {
    const { rerender } = render(<Carousel absoluteIndex={absoluteIndex} />);
    expect(actor(absoluteIndex < 0 ? 'slide1' : 'slide5').style.transform).toBe(
      'translate3d(0%, 0%, 0)'
    );
    rerender(
      <Carousel absoluteIndex={absoluteIndex} slidesPerView={2} trimEnd />
    );
    expect(actor(absoluteIndex < 0 ? 'slide1' : 'slide4').style.transform).toBe(
      'translate3d(0%, 0%, 0)'
    );
  }
);

test('the first fresh swipe works after disabling and re-enabling an active gesture', async () => {
  const onAbsoluteIndexChange = vi.fn();
  const { rerender } = render(
    <Carousel absoluteIndex={0} onAbsoluteIndexChange={onAbsoluteIndexChange} />
  );
  const carousel = startDrag();
  rerender(
    <Carousel
      absoluteIndex={0}
      drag={false}
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    />
  );
  endDrag(carousel);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  rerender(
    <Carousel absoluteIndex={0} onAbsoluteIndexChange={onAbsoluteIndexChange} />
  );
  swipe(carousel, [1000, 0], [0, 0]);
  expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
    1,
    expect.objectContaining({ reason: 'drag' })
  );
});

test.each([true, false])(
  'preserves cycle corrections across hidden count changes (initially measured: %s)',
  (initiallyMeasured) => {
    const setWidth = (width: number) =>
      useOnResize.mockReturnValue(
        createCarouselLayout([{ width, height: 200 }])
      );
    const onAbsoluteIndexChange = vi.fn();
    setWidth(initiallyMeasured ? 1000 : 0);
    const { rerender } = render(
      <Carousel
        absoluteIndex={100}
        mode="forward-loop"
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      >
        {getTestSlides(3)}
      </Carousel>
    );
    setWidth(0);
    rerender(
      <Carousel
        absoluteIndex={100}
        mode="forward-loop"
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      >
        {getTestSlides(3)}
      </Carousel>
    );
    rerender(
      <Carousel
        absoluteIndex={100}
        mode="forward-loop"
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      >
        {getTestSlides(4)}
      </Carousel>
    );
    expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    setWidth(1000);
    rerender(
      <Carousel
        absoluteIndex={100}
        mode="forward-loop"
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      >
        {getTestSlides(4)}
      </Carousel>
    );
    expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
      133,
      expect.objectContaining({ reason: 'slides-change' })
    );
  }
);

test('an explicit absoluteIndex while hidden wins over a collection correction', () => {
  const onAbsoluteIndexChange = vi.fn();
  const { rerender } = render(
    <Carousel
      absoluteIndex={100}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(3)}
    </Carousel>
  );
  useOnResize.mockReturnValue(
    createCarouselLayout([{ width: 0, height: 200 }])
  );
  rerender(
    <Carousel
      absoluteIndex={102}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(4)}
    </Carousel>
  );
  useOnResize.mockReturnValue(
    createCarouselLayout([{ width: 1000, height: 200 }])
  );
  rerender(
    <Carousel
      absoluteIndex={102}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(4)}
    </Carousel>
  );
  expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
  expect(actor('slide3').style.transform).toBe('translate3d(0%, 0%, 0)');
});

test('a rejected drag returns an interrupted spring to its committed absoluteIndex', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const animation = { type: 'duration' as const, duration: 500 };
  const { rerender } = render(
    <Carousel absoluteIndex={0} animation={animation} />
  );
  rerender(<Carousel absoluteIndex={1} animation={animation} />);
  expect(actor('slide2')).toHaveAttribute('inert');
  expect(actor('slide2').style.transform).toBe('translate3d(100%, 0%, 0)');
  const carousel = startDrag();
  await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
  endDrag(carousel);
  await waitFor(
    () =>
      expect(actor('slide2').style.transform).toBe('translate3d(0%, 0%, 0)'),
    { timeout: 2000 }
  );
});

test.each([
  ['visible count', { slidesPerView: 2 }, false],
  ['axis', { axis: 'vertical' }, false],
  ['gesture enablement', { drag: false }, false],
  ['collection mode', { mode: 'loop' }, true],
] satisfies Array<[string, RCarouselProps, boolean]>)(
  'a suspended %s update cannot alter committed gesture handling',
  (_name, configuration, backwards) => {
    const onAbsoluteIndexChange = vi.fn();
    const onNavigate = vi.fn();
    const suspended = new Promise<never>(() => {});
    let setConfiguration: React.Dispatch<
      React.SetStateAction<RCarouselProps | null>
    > = () => {};
    function Pending({ pending }: { pending: boolean }) {
      if (pending) throw suspended;
      return null;
    }
    function App() {
      const [props, set] = useState<RCarouselProps | null>(null);
      setConfiguration = set;
      return (
        <Suspense fallback={<div>Loading</div>}>
          <Carousel
            absoluteIndex={0}
            {...props}
            onAbsoluteIndexChange={onAbsoluteIndexChange}
            onNavigate={onNavigate}
          />
          <Pending pending={props !== null} />
        </Suspense>
      );
    }
    render(<App />);
    act(() => startTransition(() => setConfiguration(configuration)));
    swipe(
      screen.getByTestId('carousel'),
      backwards ? [100, 0] : [1000, 0],
      backwards ? [1000, 0] : [100, 0]
    );
    if (backwards) {
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith({
        direction: 'prev',
        source: 'drag',
        blocked: true,
      });
      expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    } else {
      expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'drag' })
      );
    }
  }
);

test.each(['visible count', 'width'])(
  'a %s change cancels a pointer sequence before drag activation',
  (change) => {
    const onAbsoluteIndexChange = vi.fn();
    const { rerender } = render(
      <Carousel
        absoluteIndex={0}
        slidesPerView={1}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      />
    );
    const carousel = screen.getByTestId('carousel');
    fireEvent.pointerDown(carousel, { ...pointer, clientX: 1000, clientY: 0 });
    if (change === 'width') {
      useOnResize.mockReturnValue(
        createCarouselLayout([{ width: 500, height: 200 }])
      );
    }
    rerender(
      <Carousel
        absoluteIndex={0}
        slidesPerView={change === 'width' ? 1 : 2}
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      />
    );
    fireEvent.pointerMove(carousel, { ...pointer, clientX: 400, clientY: 0 });
    fireEvent.pointerUp(carousel, {
      ...pointer,
      buttons: 0,
      clientX: 400,
      clientY: 0,
    });
    expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    expect(actor('slide1').style.transform).toBe('translate3d(0%, 0%, 0)');
  }
);

test('Suspense reattachment settles the committed target and restores interaction', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const animation = { type: 'duration' as const, duration: 1000 };
  const suspended = new Promise<never>(() => {});
  function Pending({ pending }: { pending: boolean }) {
    if (pending) throw suspended;
    return null;
  }
  function App({
    absoluteIndex,
    pending,
  }: {
    absoluteIndex: number;
    pending: boolean;
  }) {
    return (
      <Suspense fallback={<div data-testid="fallback">Loading</div>}>
        <Carousel absoluteIndex={absoluteIndex} animation={animation} />
        <Pending pending={pending} />
      </Suspense>
    );
  }
  const { rerender } = render(<App absoluteIndex={0} pending={false} />);
  rerender(<App absoluteIndex={1} pending={false} />);
  expect(actor('slide2')).toHaveAttribute('inert');
  expect(actor('slide2').style.transform).toBe('translate3d(100%, 0%, 0)');
  rerender(<App absoluteIndex={1} pending />);
  expect(screen.getByTestId('fallback')).toBeInTheDocument();
  rerender(<App absoluteIndex={1} pending={false} />);
  await waitFor(() => expect(actor('slide2')).not.toHaveAttribute('inert'));
  expect(actor('slide2').style.transform).toBe('translate3d(0%, 0%, 0)');
  expect(actor('slide2')).not.toHaveAttribute('aria-hidden');
});
