import React from 'react';
import { buildTestCarousel, getTestSlides, swipe, render } from './tools';
import { useOnResize as mockedUseOnResize } from '../../hooks/useOnResize';

import './tools/patchCreateEvent';

jest.mock('../../hooks/useOnResize');
// jest.mock('../helpers/animTo');

const useOnResize = mockedUseOnResize as jest.Mock;
const getUseOnResizeMock = (sizes: any = []) => () => ({
  sizes,
  add: jest.fn(),
  remove: jest.fn(),
});

const DEFAULT_WINDOW_WIDTH = 1000;
const DEFAULT_WINDOW_HEIGHT = 200;

const resize = (
  width = DEFAULT_WINDOW_WIDTH,
  height = DEFAULT_WINDOW_HEIGHT
) => {
  window.resizeTo(width, height);
  useOnResize.mockImplementation(getUseOnResizeMock([{ width, height }]));
};

beforeAll(() => {
  window.resizeTo = function resizeTo(width, height) {
    Object.assign(this, {
      innerWidth: width,
      innerHeight: height,
      outerWidth: width,
      outerHeight: height,
    }).dispatchEvent(new this.Event('resize'));
  };
});

beforeEach(() => {
  resize();
});

test('check defaultCursor prop', () => {
  const { Component } = buildTestCarousel();
  const { asFragment } = render(<Component defaultCursor={2} />);
  expect(asFragment()).toMatchSnapshot();
});

test('check carousel without slides', () => {
  const { Component } = buildTestCarousel({ slidesCount: 0 });
  const { asFragment } = render(<Component />);
  expect(asFragment()).toMatchSnapshot();
});

test('check carousel with only one slide', () => {
  const { Component } = buildTestCarousel({ slidesCount: 1 });
  const { asFragment } = render(<Component />);
  expect(asFragment()).toMatchSnapshot();
});

describe('check slides switching using cursor prop', () => {
  const { Component } = buildTestCarousel();

  test.each([
    [0, 1],
    [1, 2],
    [2, 1],
    [1, 0],
  ])('move from cursor %i to cursor %i', (from, to) => {
    const { rerender, asFragment } = render(<Component cursor={from} />);
    const curFragment = asFragment();
    rerender(<Component cursor={to} />);
    expect(curFragment).toMatchDiffSnapshot(asFragment());
  });
});

describe('check slides switching on swiping (X axis)', () => {
  const changeHandler = jest.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
    },
  });

  test.each([
    [DEFAULT_WINDOW_WIDTH, 0, 0, 1],
    [DEFAULT_WINDOW_WIDTH, 0, 1, 2],
    [0, DEFAULT_WINDOW_WIDTH, 2, 1],
    [0, DEFAULT_WINDOW_WIDTH, 1, 0],
  ])(
    'swipe from %ipx to %ipx (cursor %i -> cursor %i) ',
    (from, to, cursorFrom, cursorTo) => {
      const { container } = render(<Component cursor={cursorFrom} />);
      const [carousel] = Array.from<any>(container.children);
      swipe(carousel, [from], [to]);
      expect(changeHandler).toHaveBeenCalledWith(cursorTo);
    }
  );
});

describe('check slides switching on swiping (Y axis)', () => {
  const changeHandler = jest.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      y: true,
    },
  });

  test.each([
    [DEFAULT_WINDOW_HEIGHT, 0, 0, 1],
    [DEFAULT_WINDOW_HEIGHT, 0, 1, 2],
    [0, DEFAULT_WINDOW_HEIGHT, 2, 1],
    [0, DEFAULT_WINDOW_HEIGHT, 1, 0],
  ])(
    'swipe from %ipx to %ipx (cursor %i -> cursor %i) ',
    (from, to, cursorFrom, cursorTo) => {
      const { container } = render(<Component cursor={cursorFrom} />);
      const [carousel] = Array.from<any>(container.children);
      swipe(carousel, [0, from], [0, to]);
      expect(changeHandler).toHaveBeenCalledWith(cursorTo);
    }
  );
});

describe('check infinite switching', () => {
  const { Component } = buildTestCarousel({ baseProps: { infinite: true } });

  test.each([
    [100, 101],
    [101, 102],
  ])('move from cursor %i to cursor %i', (from, to) => {
    const { rerender, asFragment } = render(<Component cursor={from} />);
    const curFragment = asFragment();
    rerender(<Component cursor={to} />);
    expect(curFragment).toMatchDiffSnapshot(asFragment());
  });
});

test('check cursor shifts after adding or removing a slide in the infinite mode', () => {
  const changeHandler = jest.fn();
  const slidesCount = 3;
  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      defaultCursor: 100,
      infinite: true,
    },
    slidesCount,
  });

  const { rerender } = render(<Component />);
  rerender(<Component>{getTestSlides(slidesCount + 1)}</Component>);

  expect(changeHandler).toHaveBeenCalledWith(133);

  rerender(<Component>{getTestSlides(slidesCount)}</Component>);
  expect(changeHandler).toHaveBeenCalledWith(100);
});

test('check swipe with swipeThreshold', () => {
  const changeHandler = jest.fn();
  const thresholdPx = 30;

  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      swipeThreshold: `${thresholdPx}px`,
    },
  });

  const { container } = render(<Component />);
  const [carousel] = Array.from<any>(container.children);
  swipe(carousel, [DEFAULT_WINDOW_WIDTH], [DEFAULT_WINDOW_WIDTH - thresholdPx]);
  expect(changeHandler).toHaveBeenCalledWith(1);
});

describe('check displayAtOnce prop', () => {
  const visibleActorsChangeHandler = jest.fn();

  const { Component } = buildTestCarousel({
    baseProps: {
      displayAtOnce: [
        { value: 1 },
        { breakpoint: 800, value: 3 },
        { breakpoint: 400, value: 2 },
      ],
      onVisibleActorsChange: visibleActorsChangeHandler,
    },
  });

  test.each([
    [1000, 3],
    [500, 2],
    [200, 1],
  ])(
    'resizing window width to %ipx should display %i slide(s) at once',
    (width, visibleSlidesCount) => {
      resize(width, DEFAULT_WINDOW_HEIGHT);
      const { asFragment } = render(<Component />);
      expect(asFragment()).toMatchSnapshot();
      expect(visibleActorsChangeHandler).toHaveBeenCalledWith(
        visibleSlidesCount
      );
    }
  );
});

test('check trimEnd prop', () => {
  const changeHandler = jest.fn();

  const { Component } = buildTestCarousel({
    baseProps: {
      displayAtOnce: 3,
      onRangeChange: changeHandler,
    },
  });
  const { rerender } = render(<Component cursor={2} />);
  expect(changeHandler).toHaveBeenCalledWith(0, 2, 3);
  rerender(<Component cursor={2} trimEnd={true} />);
  expect(changeHandler).toHaveBeenCalledWith(0, 0, 3);
});

test('check autosize prop', () => {
  useOnResize.mockImplementation(
    getUseOnResizeMock([
      { width: 250, height: 0 },
      { width: 250, height: 0 },
      { width: 250, height: 20 },
      { width: 250, height: 30 },
      { width: 250, height: 10 },
      { width: 250, height: 40 },
    ])
  );

  const { Component } = buildTestCarousel({
    baseProps: {
      displayAtOnce: 2,
      autosize: true,
    },
  });
  const { rerender, asFragment } = render(<Component cursor={0} />);
  const curFragment = asFragment();

  useOnResize.mockImplementation(
    getUseOnResizeMock([
      { width: 250, height: 30 },
      { width: 250, height: 40 },
      { width: 250, height: 10 },
      { width: 250, height: 50 },
      { width: 250, height: 20 },
      { width: 250, height: 60 },
    ])
  );

  rerender(<Component cursor={2} />);
  expect(curFragment).toMatchDiffSnapshot(asFragment());
});
