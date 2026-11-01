import React, { StrictMode, useEffect, useLayoutEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import RCarousel, { useCarousel } from '../../index.js';
import type { CarouselController, RCarouselProps } from '../../index.js';
import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import { useOnResize as mockedResize } from '../hooks/useOnResize.js';
import { getTestSlides } from './tools/index.js';

vi.mock('../hooks/useOnResize.js');
const resize = vi.mocked(mockedResize);
let navigation: CarouselController;

function Example({ count = 8, ...props }: RCarouselProps & { count?: number }) {
  navigation = useCarousel();
  return (
    <>
      <RCarousel
        controller={navigation}
        slidesPerView={3}
        slidesToScroll={3}
        animation={false}
        {...props}
      >
        {getTestSlides(count)}
      </RCarousel>
      <output data-testid="page">
        {navigation.pageIndex === null ? 0 : navigation.pageIndex + 1}/
        {navigation.pageCount}
      </output>
      {navigation.getPageIndexes().map((pageIndex) => (
        <button key={pageIndex} {...navigation.getPageButtonProps(pageIndex)}>
          {pageIndex + 1}
        </button>
      ))}
    </>
  );
}

beforeEach(() => {
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
});

test.each([
  { count: 8, step: 3, trimEnd: true, targets: [0, 3, 5] },
  { count: 8, step: 3, trimEnd: false, targets: [0, 3, 6, 7] },
  { count: 9, step: 3, trimEnd: true, targets: [0, 3, 6] },
  { count: 8, step: 20, trimEnd: true, targets: [0, 5] },
  { count: 3, step: 3, trimEnd: true, targets: [0] },
  { count: 2, step: 3, trimEnd: true, targets: [0] },
  { count: 2, step: 3, trimEnd: false, targets: [0, 1] },
  { count: 8, step: 1, trimEnd: true, targets: [0, 1, 2, 3, 4, 5] },
])(
  'finite pages for $count slides, step $step, trimEnd=$trimEnd',
  ({ count, step, trimEnd, targets }) => {
    render(<Example count={count} slidesToScroll={step} trimEnd={trimEnd} />);
    expect(navigation.pageCount).toBe(targets.length);
    expect(
      navigation.getPageIndexes().map(navigation.getPageSlideIndex)
    ).toEqual(targets);
    act(() => navigation.goToPage(targets.length - 1));
    expect(navigation.index).toBe(targets[targets.length - 1]);
    expect(navigation.pageIndex).toBe(targets.length - 1);
  }
);

test.each(['horizontal', 'vertical'] as const)(
  '%s selection follows the containing page after direct navigation',
  (axis) => {
    render(<Example axis={axis} />);
    for (const [slide, page] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 1],
      [4, 1],
      [5, 2],
    ]) {
      act(() => navigation.goTo(slide));
      expect(navigation.pageIndex).toBe(page);
      expect(screen.getByTestId('page')).toHaveTextContent(`${page + 1}/3`);
    }
    // Explicit page navigation can return to its target from inside the page.
    act(() => navigation.goTo(4));
    act(() => navigation.goToPage(1));
    expect(navigation.index).toBe(3);
  }
);

test('page windows stay bounded, centered, and inside the collection', () => {
  render(<Example count={1000} slidesPerView={1} slidesToScroll={1} />);
  expect(navigation.getPageIndexes()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  act(() => navigation.goToPage(500));
  expect(navigation.getPageIndexes()).toEqual([
    497, 498, 499, 500, 501, 502, 503,
  ]);
  expect(navigation.getPageIndexes(4)).toEqual([499, 500, 501, 502]);
  expect(navigation.getPageIndexes(1)).toEqual([500]);
  expect(navigation.getPageIndexes(2000)).toHaveLength(1000);
  act(() => navigation.goToPage(999));
  expect(navigation.getPageIndexes()).toEqual([
    993, 994, 995, 996, 997, 998, 999,
  ]);
});

test.each(['loop', 'forward-loop'] as const)(
  '%s pages describe one collection and use nearest reachable occurrences',
  (mode) => {
    render(<Example mode={mode} />);
    expect(
      navigation.getPageIndexes().map(navigation.getPageSlideIndex)
    ).toEqual([0, 3, 6]);
    act(() => navigation.goToPage(2));
    expect(navigation.absoluteIndex).toBe(mode === 'loop' ? -2 : 6);
    expect(navigation.pageIndex).toBe(2);
    act(() => navigation.goToAbsolute(100));
    expect(navigation.pageIndex).toBe(1);
    act(() => navigation.goToPage(0));
    expect(navigation.absoluteIndex).toBe(104);
    act(() => navigation.goToAbsolute(1_000_007));
    expect(navigation.pageIndex).toBe(2);
    if (mode === 'loop') {
      act(() => navigation.goToAbsolute(-1_000_001));
      expect(navigation.index).toBe(7);
      expect(navigation.pageIndex).toBe(2);
    }
  }
);

test.each(['loop', 'forward-loop'] as const)(
  '%s uses finite pagination when there are insufficient slides to repeat',
  (mode) => {
    const { rerender } = render(<Example count={2} mode={mode} />);
    expect(navigation.pageCount).toBe(1);
    rerender(<Example count={2} mode={mode} trimEnd={false} />);
    expect(
      navigation.getPageIndexes().map(navigation.getPageSlideIndex)
    ).toEqual([0, 1]);
    act(() => navigation.goToPage(1));
    expect(navigation.index).toBe(1);
  }
);

test('repeating pages remain local when the step exceeds the collection', () => {
  render(<Example mode="loop" slidesToScroll={20} defaultAbsoluteIndex={99} />);
  expect(navigation.pageCount).toBe(1);
  expect(navigation.pageIndex).toBe(0);
  expect(navigation.getPageSlideIndex(0)).toBe(0);
});

test('pagination is unavailable before measurement, for empty data, and after detachment', () => {
  resize.mockReturnValue(createCarouselLayout([{ width: 0, height: 0 }]));
  const { rerender, unmount } = render(<Example />);
  expect(navigation.pageCount).toBe(0);
  expect(navigation.pageIndex).toBeNull();
  expect(navigation.getPageIndexes()).toEqual([]);
  expect(navigation.getPageSlideIndex(0)).toBeNull();
  expect(navigation.getPageButtonProps(0).disabled).toBe(true);
  act(() => navigation.goToPage(2));
  expect(navigation.index).toBe(0);
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
  rerender(<Example count={0} />);
  expect(navigation.pageCount).toBe(0);
  expect(navigation.pageIndex).toBeNull();
  rerender(<Example />);
  act(() => navigation.goToPage(2));
  expect(navigation.pageIndex).toBe(2);
  const detached = navigation;
  unmount();
  expect(detached.pageCount).toBe(0);
  expect(detached.pageIndex).toBeNull();
  expect(detached.getPageIndexes()).toEqual([]);
  expect(detached.getPageSlideIndex(0)).toBeNull();
  expect(detached.getPageButtonProps(0).disabled).toBe(true);
  expect(() => detached.goToPage(0)).not.toThrow();
});

test('a step-only container breakpoint refreshes consumers without changing the public snapshot', () => {
  const change = vi.fn();
  const breakpoints = { 800: { slidesToScroll: 3 } };
  const element = (
    <Example
      slidesToScroll={1}
      breakpoints={breakpoints}
      onStateChange={change}
    />
  );
  const { rerender } = render(element);
  act(() => navigation.goTo(4));
  expect(screen.getByTestId('page')).toHaveTextContent('5/6');
  const notifications = change.mock.calls.length;
  resize.mockReturnValue(createCarouselLayout([{ width: 900, height: 200 }]));
  rerender(
    <Example
      slidesToScroll={1}
      breakpoints={breakpoints}
      onStateChange={change}
    />
  );
  expect(screen.getByTestId('page')).toHaveTextContent('2/3');
  expect(navigation.getPageIndexes().map(navigation.getPageSlideIndex)).toEqual(
    [0, 3, 5]
  );
  expect(change).toHaveBeenCalledTimes(notifications);
  act(() => navigation.goToPage(2));
  expect(navigation.index).toBe(5);
});

test.each(
  [
    { effect: 'passive', useNavigate: useEffect },
    { effect: 'layout', useNavigate: useLayoutEffect },
  ].flatMap((effect) =>
    (['prop', 'breakpoint'] as const).flatMap((configuration) =>
      [
        {
          change: 'increasing',
          initial: 1,
          next: 3,
          page: 2,
          target: 5,
          count: 3,
        },
        {
          change: 'decreasing',
          initial: 3,
          next: 1,
          page: 4,
          target: 4,
          count: 6,
        },
      ].map((steps) => ({ ...effect, configuration, ...steps }))
    )
  )
)(
  '$effect effects navigate after $change the $configuration movement step',
  ({ useNavigate, configuration, initial, next, page, target, count }) => {
    const observed = vi.fn();
    function Parent({ step }: { step: number }) {
      const carousel = useCarousel();
      navigation = carousel;
      useNavigate(() => {
        if (step === next) {
          observed({
            pageCount: carousel.pageCount,
            target: carousel.getPageSlideIndex(page),
          });
          carousel.goToPage(page);
        }
      }, [carousel, step]);
      return (
        <RCarousel
          controller={carousel}
          slidesPerView={3}
          slidesToScroll={configuration === 'prop' ? step : initial}
          breakpoints={
            configuration === 'breakpoint'
              ? { 800: { slidesToScroll: next } }
              : undefined
          }
          animation={false}
        >
          {getTestSlides(8)}
        </RCarousel>
      );
    }
    const { rerender } = render(
      <StrictMode>
        <Parent step={initial} />
      </StrictMode>
    );
    expect(navigation.isReady).toBe(true);
    expect(navigation.pageCount).toBe(initial === 1 ? 6 : 3);
    resize.mockReturnValue(createCarouselLayout([{ width: 900, height: 200 }]));
    rerender(
      <StrictMode>
        <Parent step={next} />
      </StrictMode>
    );
    expect(observed).toHaveBeenCalledExactlyOnceWith({
      pageCount: count,
      target,
    });
    expect(navigation.index).toBe(target);
    expect(navigation.pageIndex).toBe(page);
  }
);

test('resizing and collection changes reconcile the final page', () => {
  const breakpoints = { 800: { slidesPerView: 4 } };
  const { rerender } = render(<Example breakpoints={breakpoints} />);
  act(() => navigation.goToPage(2));
  resize.mockReturnValue(createCarouselLayout([{ width: 900, height: 200 }]));
  rerender(<Example breakpoints={breakpoints} />);
  expect(navigation.index).toBe(4);
  expect(navigation.pageIndex).toBe(2);
  expect(navigation.getPageSlideIndex(2)).toBe(4);
  rerender(<Example count={4} />);
  expect(navigation.pageCount).toBe(2);
  expect(navigation.pageIndex).toBe(1);
  expect(navigation.getPageSlideIndex(1)).toBe(1);
});

test.each(['index', 'absoluteIndex'] as const)(
  'controlled %s remains authoritative for rejected and external page changes',
  (prop) => {
    const change = vi.fn();
    const { rerender } = render(
      <Example {...{ [prop]: 0 }} onIndexChange={change} />
    );
    act(() => navigation.goToPage(2));
    expect(change).toHaveBeenCalledExactlyOnceWith(5, {
      index: 5,
      absoluteIndex: 5,
      reason: 'api',
    });
    expect(navigation.pageIndex).toBe(0);
    expect(screen.getByTestId('page')).toHaveTextContent('1/3');
    rerender(<Example {...{ [prop]: 5 }} onIndexChange={change} />);
    expect(navigation.pageIndex).toBe(2);
    expect(change).toHaveBeenCalledTimes(1);
  }
);

test('controlled page requests can be accepted through existing change callbacks', () => {
  function Controlled() {
    const [index, setIndex] = useState(0);
    return <Example index={index} onIndexChange={setIndex} />;
  }
  render(<Controlled />);
  fireEvent.click(screen.getByRole('button', { name: 'Go to page 3 of 3' }));
  expect(navigation.index).toBe(5);
  expect(screen.getByTestId('page')).toHaveTextContent('3/3');
});

test('button props preserve focus, compose handlers, and prevent form submission under StrictMode', () => {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  const change = vi.fn();
  const click = vi.fn();
  function Form({ id = 'products' }: { id?: string }) {
    navigation = useCarousel();
    return (
      <form onSubmit={submit}>
        <RCarousel
          id={id}
          controller={navigation}
          slidesPerView={3}
          slidesToScroll={3}
          animation={false}
          onIndexChange={change}
        >
          {getTestSlides(8)}
        </RCarousel>
        {navigation.getPageIndexes().map((pageIndex) => (
          <button
            key={pageIndex}
            {...navigation.getPageButtonProps(pageIndex, {
              type: 'submit',
              onClick: click,
            })}
          />
        ))}
        <button
          {...navigation.getPageButtonProps(1, {
            'aria-label': 'Cancelled',
            onClick: (event) => event.preventDefault(),
          })}
        />
        <button
          {...navigation.getPageButtonProps(1, {
            'aria-label': 'Disabled',
            disabled: true,
          })}
        />
        <button {...navigation.getPageButtonProps(99)} />
      </form>
    );
  }
  const { rerender } = render(
    <StrictMode>
      <Form />
    </StrictMode>
  );
  const selected = screen.getByRole('button', { name: 'Go to page 1 of 3' });
  expect(selected).toHaveAttribute('aria-current', 'page');
  expect(selected).toHaveAttribute('aria-disabled', 'true');
  expect(selected).toBeEnabled();
  selected.focus();
  fireEvent.click(selected);
  expect(change).not.toHaveBeenCalled();
  expect(click).toHaveBeenCalledTimes(1);
  expect(selected).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
  fireEvent.click(screen.getByRole('button', { name: 'Disabled' }));
  expect(change).not.toHaveBeenCalled();
  const next = screen.getByRole('button', { name: 'Go to page 2 of 3' });
  next.focus();
  fireEvent.click(next);
  expect(navigation.index).toBe(3);
  expect(change).toHaveBeenCalledTimes(1);
  expect(next).toHaveFocus();
  expect(next).toHaveAttribute('aria-current', 'page');
  expect(selected).not.toHaveAttribute('aria-current');
  expect(submit).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Go to page 100 of 3' })
  ).toBeDisabled();
  rerender(
    <StrictMode>
      <Form id="renamed" />
    </StrictMode>
  );
  expect(next).toHaveAttribute('aria-controls', 'renamed');
});

test('out-of-range and stale page buttons do not navigate after collection changes', () => {
  const change = vi.fn();
  const { rerender } = render(<Example onIndexChange={change} />);
  const staleProps = navigation.getPageButtonProps(2);
  for (const pageIndex of [-1, 3, Number.MAX_SAFE_INTEGER]) {
    expect(navigation.getPageSlideIndex(pageIndex)).toBeNull();
    expect(navigation.getPageButtonProps(pageIndex).disabled).toBe(true);
    act(() => navigation.goToPage(pageIndex));
  }
  rerender(<Example count={1} onIndexChange={change} />);
  const stale = document.createElement('button');
  act(() =>
    staleProps.onClick?.({
      currentTarget: stale,
      defaultPrevented: false,
    } as React.MouseEvent<HTMLButtonElement>)
  );
  expect(navigation.index).toBe(0);
  expect(change).not.toHaveBeenCalled();
});

test.each([0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'page methods reject invalid integer %s',
  (value) => {
    render(<Example />);
    expect(() => navigation.getPageSlideIndex(value)).toThrow('pageIndex');
    expect(() => navigation.goToPage(value)).toThrow('pageIndex');
    expect(() => navigation.getPageButtonProps(value)).toThrow('pageIndex');
    expect(() => navigation.getPageIndexes(value)).toThrow('limit');
  }
);

test.each([0, -1])('page windows reject nonpositive limit %s', (limit) => {
  render(<Example />);
  expect(() => navigation.getPageIndexes(limit)).toThrow('limit');
});

test('large lazy collections do not read items to calculate pagination', () => {
  const accessed = new Set<number>();
  const items = new Proxy(new Array<number>(1_000_000), {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) {
        accessed.add(Number(property));
        return Number(property);
      }
      return Reflect.get(target, property, receiver);
    },
  });
  function Lazy() {
    navigation = useCarousel();
    return (
      <RCarousel
        controller={navigation}
        items={items}
        getItemKey={(item) => item}
        renderItem={(item) => <div>{item}</div>}
        animation={false}
      />
    );
  }
  const { container } = render(<Lazy />);
  expect(navigation.pageCount).toBe(1_000_000);
  const before = accessed.size;
  expect(navigation.getPageIndexes()).toHaveLength(7);
  expect(navigation.getPageSlideIndex(999_999)).toBe(999_999);
  expect(accessed.size).toBe(before);
  act(() => navigation.goToPage(999_999));
  expect(navigation.pageIndex).toBe(999_999);
  expect(navigation.getPageIndexes()).toHaveLength(7);
  expect(accessed.size).toBeLessThan(20);
  expect(container.firstElementChild?.children).toHaveLength(3);
});
