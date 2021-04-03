import React from 'react';
import { render as tlRender } from '@testing-library/react';
import { buildTestCarousel } from './tools/buildTestCarousel';
import { swipe } from './tools/swipe';
import { finishAnim } from './tools/springConfig';
import './tools/patchCreateEvent';

jest.mock('../../hooks/useOnResize');
// jest.mock('../helpers/animTo');

function render(...args: any[]) {
  const { rerender: originalRerender, ...rest } = finishAnim(() =>
    //@ts-ignore
    tlRender(...args)
  );
  return {
    rerender(...args: any[]) {
      return finishAnim(() => originalRerender(...args));
    },
    ...rest,
  };
}

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
  const cursorValues = [0, 1, 2, 1, 0];
  const { Component } = buildTestCarousel();
  const { rerender, asFragment } = render(
    <Component cursor={cursorValues[0]} />
  );
  cursorValues.slice(1).forEach((cursor) => {
    const curFragment = asFragment();
    rerender(<Component cursor={cursor} />);
    expect(curFragment).toMatchDiffSnapshot(asFragment());
  });
});

test('check slides switching on swiping (X axis)', () => {
  const swipes = [
    [1000, 0, 1],
    [1000, 0, 2],
    [0, 1000, 1],
    [0, 1000, 0],
  ];

  const changeHandler = jest.fn();

  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
    },
  });

  const { container } = render(<Component />);
  const [carousel] = Array.from<any>(container.children);

  swipes.forEach(([from, to, cursor]) => {
    swipe(carousel, [from], [to]);
    expect(changeHandler).toHaveBeenCalledWith(cursor);
  });
});

test('check slides switching on swiping (Y axis)', () => {
  const swipes = [
    [200, 0, 1],
    [200, 0, 2],
    [0, 200, 1],
    [0, 200, 0],
  ];

  const changeHandler = jest.fn();

  const { Component } = buildTestCarousel({
    baseProps: {
      onCursorChange: changeHandler,
      y: true,
    },
  });

  const { container } = render(<Component />);
  const [carousel] = Array.from<any>(container.children);

  swipes.forEach(([from, to, cursor]) => {
    swipe(carousel, [0, from], [0, to]);
    expect(changeHandler).toHaveBeenCalledWith(cursor);
  });
});

test('check infinite switching', () => {
  const cursorValues = [100, 101, 102];
  const { Component } = buildTestCarousel({
    baseProps: { infinite: true },
  });
  const { rerender, asFragment } = render(
    <Component cursor={cursorValues[0]} />
  );

  cursorValues.slice(1).forEach((cursor) => {
    const curFragment = asFragment();
    rerender(<Component cursor={cursor} />);
    expect(curFragment).toMatchDiffSnapshot(asFragment());
  });
});

test('check defaultCursor prop', () => {
  const { Component } = buildTestCarousel();
  const { asFragment } = render(<Component defaultCursor={2} />);
  expect(asFragment()).toMatchSnapshot();
});
