import React from 'react';
import { render, screen } from '@testing-library/react';
import { buildTestCarousel } from './tools/buildTestCarousel';
import { swipe } from './tools/swipe';
import './tools/patchCreateEvent';

jest.mock('../../hooks/useOnResize');

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

test('check slides switching using cursor prop', () => {
  const { Component, items } = buildTestCarousel();
  const { rerender } = render(<Component cursor={0} />);

  expect(screen.getByTestId(items[0])).toBeInTheDocument();

  rerender(<Component cursor={1} />);
  expect(screen.getByTestId(items[1])).toBeInTheDocument();

  rerender(<Component cursor={2} />);
  expect(screen.getByTestId(items[2])).toBeInTheDocument();
});

test('check slides switching on swiping (X axis)', async () => {
  const changeHandler = jest.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
    },
  });
  const { container, rerender } = render(<Component cursor={0} />);
  const [carousel] = Array.from(container.children);

  swipe(carousel, [1000], []);
  rerender(<Component cursor={1} />);
  swipe(carousel, [1000], []);

  expect(changeHandler).toHaveBeenNthCalledWith(1, 1);
  expect(changeHandler).toHaveBeenNthCalledWith(2, 2);
});

test('check slides switching on swiping (Y axis)', async () => {
  const changeHandler = jest.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      y: true,
    },
  });
  const { container, rerender } = render(<Component cursor={0} />);
  const [carousel] = Array.from(container.children);

  swipe(carousel, [0, 200], []);
  rerender(<Component cursor={1} />);
  swipe(carousel, [0, 200], []);

  expect(changeHandler).toHaveBeenNthCalledWith(1, 1);
  expect(changeHandler).toHaveBeenNthCalledWith(2, 2);
});

test('check gestures disabling', async () => {
  const changeHandler = jest.fn();
  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      gestures: false,
    },
  });
  const { container } = render(<Component cursor={0} />);
  const [carousel] = Array.from(container.children);

  swipe(carousel, [1000], []);
  expect(changeHandler).toHaveBeenCalledTimes(0);
});

test('check infinite switching', async () => {
  const { Component, items } = buildTestCarousel({
    baseProps: {
      infinite: true,
    },
  });
  const { rerender } = render(<Component cursor={items.length} />);

  expect(screen.getByTestId(items[0])).toBeInTheDocument();

  rerender(<Component cursor={items.length + 1} />);
  expect(screen.getByTestId(items[1])).toBeInTheDocument();

  rerender(<Component cursor={items.length + 2} />);
  expect(screen.getByTestId(items[2])).toBeInTheDocument();
});
