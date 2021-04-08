import React from 'react';
import { buildTestCarousel, getTestSlides, swipe, render } from './tools';

import './tools/patchCreateEvent';

jest.mock('../../hooks/useOnResize');
// jest.mock('../helpers/animTo');

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
  window.resizeTo(1000, 200);
});

test('check defaultCursor prop', () => {
  const { Component } = buildTestCarousel();
  const { asFragment } = render(<Component defaultCursor={2} />);
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
    [1000, 0, 0, 1],
    [1000, 0, 1, 2],
    [0, 1000, 2, 1],
    [0, 1000, 1, 0],
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
    [200, 0, 0, 1],
    [200, 0, 1, 2],
    [0, 200, 2, 1],
    [0, 200, 1, 0],
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

  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      swipeThreshold: '30px',
    },
  });

  const { container } = render(<Component />);
  const [carousel] = Array.from<any>(container.children);
  swipe(carousel, [1000], [970]);
  expect(changeHandler).toHaveBeenCalledWith(1);
});
