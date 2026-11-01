import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import React, { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { buildTestCarousel, getTestSlides, swipe } from './tools/index.js';
import { useOnResize as mockedUseOnResize } from '../hooks/useOnResize.js';
import type { RCarouselProps } from '../RCarousel.js';

vi.mock('../hooks/useOnResize.js');

const useOnResize = vi.mocked(mockedUseOnResize);
const createMeasuredLayout = (
  sizes: Array<{ width: number; height: number }>
) =>
  createCarouselLayout(
    sizes,
    new Map(sizes.slice(1).map((size, index) => [index, size]))
  );

const DEFAULT_WINDOW_WIDTH = 1000;
const DEFAULT_WINDOW_HEIGHT = 200;

const resize = (
  width = DEFAULT_WINDOW_WIDTH,
  height = DEFAULT_WINDOW_HEIGHT
) => {
  Object.assign(window, {
    innerWidth: width,
    innerHeight: height,
    outerWidth: width,
    outerHeight: height,
  });
  window.dispatchEvent(new Event('resize'));
  useOnResize.mockImplementation(() =>
    createMeasuredLayout([{ width, height }])
  );
};

const getCarousel = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;

const getActor = (slide: HTMLElement) =>
  slide.closest('[data-carousel-slide]') as HTMLElement;

beforeEach(() => {
  resize();
});

test('uses defaultAbsoluteIndex and renders the selected slide in the center actor', () => {
  const { Component } = buildTestCarousel();
  render(<Component defaultAbsoluteIndex={2} />);

  expect(getActor(screen.getByTestId('slide3')).style.transform).toContain(
    'translate3d(0%'
  );
});

test('renders without slides', () => {
  const { Component } = buildTestCarousel({ slidesCount: 0 });
  const { container } = render(<Component />);

  expect(getCarousel(container).querySelector('[data-testid]')).toBeNull();
});

test('renders a single slide', () => {
  const { Component } = buildTestCarousel({ slidesCount: 1 });
  render(<Component />);

  expect(screen.getByTestId('slide1')).toBeVisible();
});

describe('controlled absoluteIndex', () => {
  const { Component } = buildTestCarousel();

  test.each([
    [0, 1],
    [1, 2],
    [2, 1],
    [1, 0],
  ])('moves from absoluteIndex %i to absoluteIndex %i', async (from, to) => {
    const { rerender } = render(<Component absoluteIndex={from} />);
    rerender(<Component absoluteIndex={to} />);

    await waitFor(() =>
      expect(
        getActor(screen.getByTestId(`slide${to + 1}`)).style.transform
      ).toContain('translate3d(0%')
    );
  });

  test('returns to the controlled absoluteIndex when a swipe is rejected', async () => {
    const changeHandler = vi.fn();
    const { Component } = buildTestCarousel({
      baseProps: {
        absoluteIndex: 0,
        onAbsoluteIndexChange: changeHandler,
      },
    });
    const { container } = render(<Component />);

    swipe(getCarousel(container), [1000, 0], [0, 0]);

    expect(changeHandler).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ reason: 'drag' })
    );
    await waitFor(() =>
      expect(getActor(screen.getByTestId('slide1')).style.transform).toContain(
        'translate3d(0%'
      )
    );
  });
});

describe('swiping', () => {
  test.each([
    ['horizontal', 320],
    ['horizontal', 1280],
    ['vertical', 320],
    ['vertical', 1280],
  ] as const)(
    'uses a short default swipe in a %s viewport of %ipx',
    (axis, size) => {
      resize(
        axis === 'horizontal' ? size : 600,
        axis === 'vertical' ? size : 200
      );
      const onAbsoluteIndexChange = vi.fn();
      const { Component } = buildTestCarousel();
      const { container } = render(
        <Component
          axis={axis}
          absoluteIndex={0}
          onAbsoluteIndexChange={onAbsoluteIndexChange}
        />
      );
      const carousel = getCarousel(container);
      const target = (distance: number) =>
        axis === 'vertical' ? [100, 100 - distance] : [100 - distance, 100];

      swipe(carousel, [100, 100], target(20));
      expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
      swipe(carousel, [100, 100], target(40));
      expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
        1,
        expect.objectContaining({ reason: 'drag' })
      );
    }
  );

  test.each([
    ['horizontal', false, [1000, 0], [0, 0], 1],
    ['horizontal backwards', false, [0, 0], [1000, 0], 0],
    ['vertical', true, [0, 200], [0, 0], 1],
    ['vertical backwards', true, [0, 0], [0, 200], 0],
  ])('handles %s drag', (_name, y, from, to, expectedCursor) => {
    const changeHandler = vi.fn();
    const { Component } = buildTestCarousel({
      baseProps: {
        absoluteIndex: expectedCursor === 0 ? 1 : 0,
        onAbsoluteIndexChange: changeHandler,
        axis: y ? 'vertical' : 'horizontal',
      },
    });
    const { container } = render(<Component />);

    swipe(getCarousel(container), from, to);

    expect(changeHandler).toHaveBeenCalledWith(
      expectedCursor,
      expect.objectContaining({ reason: 'drag' })
    );
  });

  test('honors swipeThreshold', () => {
    const changeHandler = vi.fn();
    const { Component } = buildTestCarousel({
      baseProps: {
        onAbsoluteIndexChange: changeHandler,
        swipeThreshold: '80px',
      },
    });
    const { container } = render(<Component />);

    swipe(getCarousel(container), [100, 0], [60, 0]);
    expect(changeHandler).not.toHaveBeenCalled();
    swipe(getCarousel(container), [100, 0], [20, 0]);

    expect(changeHandler).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ reason: 'drag' })
    );
  });

  test('keeps explicit percentage thresholds relative to one item', () => {
    const onAbsoluteIndexChange = vi.fn();
    const { Component } = buildTestCarousel();
    const { container } = render(
      <Component
        absoluteIndex={0}
        slidesPerView={1}
        swipeThreshold="50%"
        onAbsoluteIndexChange={onAbsoluteIndexChange}
      />
    );
    const carousel = getCarousel(container);
    swipe(carousel, [600, 0], [560, 0]);
    expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    swipe(carousel, [600, 0], [90, 0]);
    expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
      1,
      expect.objectContaining({ reason: 'drag' })
    );
  });
});

test.each([undefined, 'finite', 'loop', 'forward-loop'] satisfies Array<
  RCarouselProps['mode']
>)(
  'publishes the exact range and respects both boundaries in mode %s',
  (mode) => {
    const onStateChange = vi.fn();
    const onAbsoluteIndexChange = vi.fn();
    const { Component } = buildTestCarousel({
      slidesCount: 3,
      baseProps: { mode, onStateChange, onAbsoluteIndexChange },
    });
    const { container, rerender } = render(<Component absoluteIndex={0} />);
    const loops = mode === 'loop' || mode === 'forward-loop';
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isReady: true,
        slideCount: 3,
        absoluteBounds: {
          min: mode === 'loop' ? -Infinity : 0,
          max: loops ? Infinity : 2,
        },
      })
    );

    swipe(getCarousel(container), [0, 0], [1000, 0]);
    if (mode === 'loop') {
      expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
        -1,
        expect.objectContaining({ reason: 'drag' })
      );
    } else {
      expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    }
    onAbsoluteIndexChange.mockClear();

    rerender(<Component absoluteIndex={2} />);
    swipe(getCarousel(container), [1000, 0], [0, 0]);
    if (loops) {
      expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
        3,
        expect.objectContaining({ reason: 'drag' })
      );
    } else {
      expect(onAbsoluteIndexChange).not.toHaveBeenCalled();
    }
    onAbsoluteIndexChange.mockClear();

    rerender(<Component absoluteIndex={1} />);
    swipe(getCarousel(container), [0, 0], [1000, 0]);
    expect(onAbsoluteIndexChange).toHaveBeenCalledExactlyOnceWith(
      0,
      expect.objectContaining({ reason: 'drag' })
    );
  }
);

describe('forward-loop mode', () => {
  test('supports large global cursors', () => {
    const { Component } = buildTestCarousel({
      baseProps: { mode: 'forward-loop' },
    });
    const { rerender } = render(<Component absoluteIndex={100} />);

    rerender(<Component absoluteIndex={101} />);

    expect(screen.getAllByTestId('slide3').length).toBeGreaterThan(0);
  });

  test('shifts the absoluteIndex when slides are added and removed', () => {
    const changeHandler = vi.fn();
    const slidesCount = 3;
    const { Component } = buildTestCarousel({
      baseProps: {
        onAbsoluteIndexChange: changeHandler,
        defaultAbsoluteIndex: 100,
        mode: 'forward-loop',
      },
      slidesCount,
    });
    const { rerender } = render(<Component />);

    rerender(<Component>{getTestSlides(slidesCount + 1)}</Component>);
    expect(changeHandler).toHaveBeenCalledWith(
      133,
      expect.objectContaining({ reason: 'slides-change' })
    );

    rerender(<Component>{getTestSlides(slidesCount)}</Component>);
    expect(changeHandler).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ reason: 'slides-change' })
    );
  });

  test('lets an explicit absoluteIndex win when slides change simultaneously', () => {
    const changeHandler = vi.fn();
    const { Component } = buildTestCarousel({
      baseProps: {
        mode: 'forward-loop',
        onAbsoluteIndexChange: changeHandler,
      },
      slidesCount: 3,
    });
    const { rerender } = render(<Component absoluteIndex={100} />);

    rerender(<Component absoluteIndex={101}>{getTestSlides(4)}</Component>);

    expect(changeHandler).not.toHaveBeenCalled();
    expect(getActor(screen.getByTestId('slide2')).style.transform).toContain(
      'translate3d(0%'
    );
  });

  test('withholds provisional range notifications while unmeasured', () => {
    const rangeHandler = vi.fn();
    const changeHandler = vi.fn();
    const { Component } = buildTestCarousel({
      baseProps: {
        slidesPerView: 1,
        mode: 'forward-loop',
        onAbsoluteIndexChange: changeHandler,
        onStateChange: rangeHandler,
      },
    });

    resize(0);
    const { container } = render(<Component />);
    swipe(getCarousel(container), [100, 0], [0, 0]);

    expect(rangeHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({ isReady: false, absoluteBounds: null })
    );
    expect(changeHandler).not.toHaveBeenCalled();
  });
});

test('preserves an initial global absoluteIndex through hidden and measured layouts', async () => {
  const { Component } = buildTestCarousel();
  let currentCursor = 0;
  function Controlled() {
    const [position, setPosition] = React.useState(100);
    currentCursor = position;
    return (
      <Component
        mode="forward-loop"
        absoluteIndex={position}
        onAbsoluteIndexChange={setPosition}
      />
    );
  }
  resize(0);
  const { rerender } = render(<Controlled />);
  expect(currentCursor).toBe(100);
  resize();
  rerender(<Controlled />);
  await waitFor(() => expect(currentCursor).toBe(100));
  expect(getActor(screen.getByTestId('slide2')).style.transform).toContain(
    'translate3d(0%'
  );
  resize(0);
  rerender(<Controlled />);
  expect(currentCursor).toBe(100);
  resize();
  rerender(<Controlled />);
  expect(currentCursor).toBe(100);
});

test('emits the same SHIFT target again after an intervening explicit change', () => {
  const onAbsoluteIndexChange = vi.fn();
  const { Component } = buildTestCarousel();
  const { rerender } = render(
    <Component
      absoluteIndex={100}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    />
  );
  rerender(
    <Component
      absoluteIndex={100}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(4)}
    </Component>
  );
  rerender(
    <Component
      absoluteIndex={133}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(4)}
    </Component>
  );
  rerender(
    <Component
      absoluteIndex={100}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(3)}
    </Component>
  );
  rerender(
    <Component
      absoluteIndex={100}
      mode="forward-loop"
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    >
      {getTestSlides(4)}
    </Component>
  );
  expect(onAbsoluteIndexChange.mock.calls).toEqual([
    [133, expect.objectContaining({ reason: 'slides-change' })],
    [133, expect.objectContaining({ reason: 'slides-change' })],
  ]);
});

test('renders numeric zero as a slide', () => {
  const { Component } = buildTestCarousel();
  render(<Component>{[0, 1, 2]}</Component>);
  expect(screen.getByText('0')).toBeVisible();
});

test('makes buffered slide content inert and returns hidden focus to the container', () => {
  const { Component } = buildTestCarousel();
  const slides = [0, 1, 2, 3].map((index) => (
    <button key={index}>Item {index}</button>
  ));
  const { container, rerender } = render(
    <Component absoluteIndex={1}>{slides}</Component>
  );
  const active = screen.getByRole('button', { name: 'Item 1' });
  const hidden = screen.getByText('Item 0');
  expect(getActor(hidden)).toHaveAttribute('inert');
  expect(getActor(hidden)).toHaveAttribute('aria-hidden', 'true');
  expect(getActor(active)).not.toHaveAttribute('inert');
  active.focus();
  rerender(<Component absoluteIndex={2}>{slides}</Component>);
  expect(getCarousel(container)).toHaveFocus();
});

test('restores focus to the container when focused content is replaced', () => {
  const { Component } = buildTestCarousel();
  const { container, rerender } = render(
    <Component>
      <button key="old">Old</button>
    </Component>
  );
  screen.getByRole('button', { name: 'Old' }).focus();
  rerender(
    <Component>
      <button key="new">New</button>
    </Component>
  );
  expect(getCarousel(container)).toHaveFocus();
});

test('does not reclaim focus after the user blurs a slide before replacement', () => {
  const { Component } = buildTestCarousel();
  const { container, rerender } = render(
    <Component>
      <button key="old">Old</button>
    </Component>
  );
  const old = screen.getByRole('button', { name: 'Old' });
  old.focus();
  old.blur();
  expect(document.body).toHaveFocus();
  rerender(
    <Component>
      <button key="new">New</button>
    </Component>
  );
  expect(document.body).toHaveFocus();
  expect(getCarousel(container)).not.toHaveFocus();
});

test('composes consumer pointer handlers with carousel drag', () => {
  const onPointerDown = vi.fn();
  const onAbsoluteIndexChange = vi.fn();
  const { Component } = buildTestCarousel();
  const { container } = render(
    <Component
      onPointerDown={onPointerDown}
      onAbsoluteIndexChange={onAbsoluteIndexChange}
    />
  );
  swipe(getCarousel(container), [1000, 0], [0, 0]);
  expect(onPointerDown).toHaveBeenCalledOnce();
  expect(onAbsoluteIndexChange).toHaveBeenCalledWith(
    1,
    expect.objectContaining({ reason: 'drag' })
  );
});

test('prevents native image dragging only when dragging is enabled', () => {
  const onDragStartCapture = vi.fn();
  const { Component } = buildTestCarousel();
  const image = <img alt="Example" src="example.png" />;
  const { rerender } = render(
    <Component onDragStartCapture={onDragStartCapture}>{image}</Component>
  );
  expect(fireEvent.dragStart(screen.getByAltText('Example'))).toBe(false);
  expect(onDragStartCapture).toHaveBeenCalledOnce();
  rerender(<Component drag={false}>{image}</Component>);
  expect(fireEvent.dragStart(screen.getByAltText('Example'))).toBe(true);
});

test('does not renormalize a stable children collection on absoluteIndex updates', () => {
  const normalize = vi.spyOn(React.Children, 'toArray');
  const { Component } = buildTestCarousel({ slidesCount: 1000 });
  const { rerender } = render(<Component absoluteIndex={0} />);
  const initialCalls = normalize.mock.calls.length;
  rerender(<Component absoluteIndex={1} />);
  expect(normalize).toHaveBeenCalledTimes(initialCalls);
  normalize.mockRestore();
});

test('applies responsive slidesPerView rules', () => {
  const visibleActorsChangeHandler = vi.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      slidesPerView: 1,
      breakpoints: { 800: { slidesPerView: 3 }, 400: { slidesPerView: 2 } },
      onStateChange: visibleActorsChangeHandler,
    },
  });

  resize(500);
  const { rerender } = render(<Component />);
  expect(visibleActorsChangeHandler).toHaveBeenLastCalledWith(
    expect.objectContaining({ slidesPerView: 2 })
  );

  resize(1000);
  rerender(<Component />);
  expect(visibleActorsChangeHandler).toHaveBeenLastCalledWith(
    expect.objectContaining({ slidesPerView: 3 })
  );
});

test('trims empty positions from the end range', () => {
  const rangeHandler = vi.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      slidesPerView: 3,
      onStateChange: rangeHandler,
    },
  });
  const { rerender } = render(<Component absoluteIndex={2} trimEnd={false} />);
  expect(rangeHandler).toHaveBeenLastCalledWith(
    expect.objectContaining({
      absoluteBounds: { min: 0, max: 2 },
      slideCount: 3,
    })
  );

  rerender(<Component absoluteIndex={2} trimEnd />);
  expect(rangeHandler).toHaveBeenLastCalledWith(
    expect.objectContaining({
      absoluteBounds: { min: 0, max: 0 },
      slideCount: 3,
    })
  );
});

test.each(['horizontal', 'vertical'] as const)(
  'autosizes only visible content on the %s axis',
  (axis) => {
    const size = (primary: number, cross: number) =>
      axis === 'horizontal'
        ? { width: primary, height: cross }
        : { width: cross, height: primary };
    const measure = (visible: number, hidden: number) =>
      useOnResize.mockImplementation(() =>
        createMeasuredLayout([
          size(250, 700),
          size(125, 20),
          size(125, visible),
          size(125, hidden),
        ])
      );
    measure(40, 400);
    const { Component } = buildTestCarousel({
      baseProps: { slidesPerView: 2, crossAxisSize: 'content' },
    });
    const { container, rerender } = render(<Component axis={axis} />);
    const crossSide = axis === 'horizontal' ? 'height' : 'width';
    expect(getCarousel(container)).toHaveStyle({ [crossSide]: '40px' });
    measure(40, 900);
    rerender(<Component axis={axis} />);
    expect(getCarousel(container)).toHaveStyle({ [crossSide]: '40px' });
    measure(60, 900);
    rerender(<Component axis={axis} />);
    expect(getCarousel(container)).toHaveStyle({ [crossSide]: '60px' });
    measure(10, 900);
    rerender(<Component axis={axis} />);
    expect(getCarousel(container)).toHaveStyle({ [crossSide]: '20px' });
  }
);

test('does not duplicate logical snapshots in StrictMode', () => {
  const state = vi.fn();
  const { Component } = buildTestCarousel({
    baseProps: { onStateChange: state },
  });
  render(
    <StrictMode>
      <Component />
    </StrictMode>
  );
  expect(
    state.mock.calls.filter(([snapshot]) => snapshot.isReady)
  ).toHaveLength(1);
});
