import { act } from '@testing-library/react';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import RCarousel, { useCarousel } from '../../index.js';
import type { CarouselController } from '../../index.js';

test('consumer pagination hydrates from no pages to the measured targets', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
  function Example() {
    const carousel = useCarousel();
    return (
      <>
        <RCarousel
          controller={carousel}
          slidesPerView={3}
          slidesToScroll={3}
          defaultIndex={4}
          crossAxisSize="container"
          animation={false}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index}>{index}</div>
          ))}
        </RCarousel>
        <output>
          {carousel.pageIndex === null ? 0 : carousel.pageIndex + 1}/
          {carousel.pageCount}
        </output>
        {carousel.getPageIndexes().map((page) => (
          <button key={page} {...carousel.getPageButtonProps(page)}>
            {page + 1}
          </button>
        ))}
      </>
    );
  }
  const container = document.createElement('div');
  const element = (
    <StrictMode>
      <Example />
    </StrictMode>
  );
  container.innerHTML = renderToString(element);
  expect(container.querySelector('output')).toHaveTextContent('0/0');
  document.body.appendChild(container);
  const hydrationError = vi.fn();
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, element, {
        onRecoverableError: hydrationError,
      });
    });
    expect(container.querySelector('output')).toHaveTextContent('2/3');
    expect(container.querySelectorAll('button')).toHaveLength(3);
    expect(container.querySelector('[aria-current="page"]')).toHaveTextContent(
      '2'
    );
    expect(hydrationError).not.toHaveBeenCalled();
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});

test.each(
  (['window', 'container'] as const).flatMap((breakpointsBase) =>
    (['children', 'items'] as const).map((source) => ({
      breakpointsBase,
      source,
    }))
  )
)(
  '$breakpointsBase breakpoints preserve the requested $source slide through hydration',
  async ({ breakpointsBase, source }) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    const change = vi.fn();
    let navigation: CarouselController;
    function Example() {
      navigation = useCarousel();
      const props = {
        controller: navigation,
        defaultIndex: 7,
        slidesPerView: 4,
        breakpointsBase,
        breakpoints: { 500: { slidesPerView: 1 } },
        crossAxisSize: 'container' as const,
        animation: false as const,
        onIndexChange: change,
      };
      if (source === 'items')
        return (
          <RCarousel
            {...props}
            items={[0, 1, 2, 3, 4, 5, 6, 7]}
            getItemKey={(item) => item}
            renderItem={(item) => <div>{item}</div>}
          />
        );
      return (
        <RCarousel {...props}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index}>{index}</div>
          ))}
        </RCarousel>
      );
    }
    const container = document.createElement('div');
    const element = (
      <StrictMode>
        <Example />
      </StrictMode>
    );
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    let root: Root | undefined;
    const hydrationError = vi.fn();
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: hydrationError,
        });
      });
      expect(navigation!).toMatchObject({
        index: 7,
        slidesPerView: 1,
        isReady: true,
      });
      expect(change).not.toHaveBeenCalled();
      expect(hydrationError).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  }
);

test.each(['horizontal', 'vertical'] as const)(
  'fractional centered %s layout hydrates without losing its anchor',
  async (axis) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(320);
    let navigation: CarouselController;
    function Example() {
      navigation = useCarousel();
      return (
        <RCarousel
          controller={navigation}
          axis={axis}
          slidesPerView={1.2}
          snapAlign="center"
          insetStart="10%"
          insetEnd={24}
          defaultIndex={7}
          crossAxisSize="container"
          animation={false}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index}>{index}</div>
          ))}
        </RCarousel>
      );
    }
    const element = (
      <StrictMode>
        <Example />
      </StrictMode>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    const recoverable = vi.fn();
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: recoverable,
        });
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(navigation!).toMatchObject({
        index: 7,
        slidesPerView: 1.2,
        isReady: true,
        absoluteBounds: { min: 0, max: 7 },
      });
      expect(
        container.querySelectorAll('[data-carousel-slide]:not([inert])')
      ).toHaveLength(1);
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  }
);
