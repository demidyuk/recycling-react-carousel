// @vitest-environment node

import React from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { RCarousel } from '../RCarousel.js';
import { useCarousel } from '../../hooks/useCarousel.js';

test('renders without browser globals, with one slide by default', () => {
  const slides = [<div key="first">first</div>, <div key="second">second</div>];
  expect(renderToString(<RCarousel>{slides}</RCarousel>)).toContain('first');
  expect(
    renderToString(<RCarousel slidesPerView={1}>{slides}</RCarousel>)
  ).toContain('first');
});

test('consumer pagination renders an unavailable state without browser globals', () => {
  function Example() {
    const carousel = useCarousel();
    expect(carousel.pageCount).toBe(0);
    expect(carousel.pageIndex).toBeNull();
    expect(carousel.getPageIndexes()).toEqual([]);
    expect(carousel.getPageSlideIndex(0)).toBeNull();
    carousel.goToPage(0);
    return (
      <>
        <RCarousel controller={carousel}>
          <div>First</div>
          <div>Second</div>
        </RCarousel>
        <button {...carousel.getPageButtonProps(0)}>First page</button>
      </>
    );
  }
  expect(renderToString(<Example />)).toContain('disabled=""');
});

test('lazily renders items without browser globals at the requested initial position', () => {
  const accessed = new Set<number>();
  const items = new Proxy(
    Array.from({ length: 100_000 }, (_, index) => index),
    {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property))
          accessed.add(Number(property));
        return Reflect.get(target, property, receiver);
      },
    }
  );
  const renderItem = vi.fn((item: number) => <div>Item {item}</div>);
  const html = renderToString(
    <RCarousel
      items={items}
      renderItem={renderItem}
      getItemKey={(item) => item}
      defaultIndex={99_999}
    />
  );
  expect(html).toContain('99999');
  expect(accessed.size).toBeGreaterThan(0);
  expect(accessed.size).toBeLessThanOrEqual(3);
  expect(renderItem).toHaveBeenCalledWith(99_999, 99_999);
});
