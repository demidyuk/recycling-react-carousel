import { mockMotionClock } from '../../../test-config/motionClock.js';
import { createCarouselLayout } from '../../../test-config/carouselLayout.js';
import React, {
  createRef,
  startTransition,
  StrictMode,
  Suspense,
  useState,
} from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import RCarousel, { useCarousel } from '../../index.js';
import type { CarouselController, RCarouselItemsProps } from '../../index.js';
import { useOnResize as mockedResize } from '../hooks/useOnResize.js';
import { motionEnvironment } from '../motion/ScalarMotion.js';

vi.mock('../hooks/useOnResize.js');
const resize = vi.mocked(mockedResize);
type Item = { id: string; label: string };
const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    label: `Item ${index}`,
  }));
const initialItems = makeItems(8);
const itemKey = (item: Item) => item.id;
const renderItem = (item: Item, index: number) => (
  <div data-testid={`item-${item.id}`} data-index={index}>
    {item.label}
  </div>
);
let navigation: CarouselController;

function Example({
  items = initialItems,
  renderItem: renderContent = renderItem,
  getItemKey = itemKey,
  ...props
}: Partial<RCarouselItemsProps<Item>>) {
  navigation = useCarousel();
  return (
    <RCarousel
      data-testid="carousel"
      controller={navigation}
      crossAxisSize="container"
      animation={false}
      {...props}
      items={items}
      renderItem={renderContent}
      getItemKey={getItemKey}
    />
  );
}

beforeEach(() => {
  resize.mockReturnValue(createCarouselLayout([{ width: 600, height: 200 }]));
});

test('only reads and creates the bounded pool from a large collection, including on large jumps', () => {
  const source = makeItems(100_000);
  const accessed = new Set<number>();
  const items = new Proxy(source, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property))
        accessed.add(Number(property));
      if (property === 'map' || property === Symbol.iterator)
        throw new Error('Collection traversal');
      return Reflect.get(target, property, receiver);
    },
  });
  const create = vi.fn(renderItem);
  const key = vi.fn(itemKey);
  const normalize = vi.spyOn(React.Children, 'toArray');
  render(
    <StrictMode>
      <Example
        items={items}
        renderItem={create}
        getItemKey={key}
        mode="loop"
        slidesPerView={3}
      />
    </StrictMode>
  );
  expect(accessed.size).toBeGreaterThan(0);
  expect(accessed.size).toBeLessThanOrEqual(9);
  expect(create.mock.calls.length).toBeLessThan(180);
  expect(
    create.mock.calls.every(([item, index]) => source[index] === item)
  ).toBe(true);
  expect(key.mock.calls.every(([item]) => accessed.has(Number(item.id)))).toBe(
    true
  );
  expect(normalize).not.toHaveBeenCalled();
  expect(screen.getByTestId('carousel').children).toHaveLength(9);

  const original = new Set(accessed);
  accessed.clear();
  create.mockClear();
  act(() => navigation.goToAbsolute(50_123));
  expect(navigation.absoluteIndex).toBe(50_123);
  expect(screen.getByTestId('item-50123')).toBeVisible();
  expect(accessed.size).toBeLessThanOrEqual(18);
  expect(
    [...accessed].every(
      (index) => original.has(index) || Math.abs(index - 50_123) <= 6
    )
  ).toBe(true);
  expect(create.mock.calls.length).toBeGreaterThan(0);
  expect(create.mock.calls.length).toBeLessThan(180);
  expect(normalize).not.toHaveBeenCalled();
  expect(screen.getByTestId('carousel').children).toHaveLength(9);
});

test.each([
  ['finite', 7, 5, 5],
  ['loop', -2, -2, 6],
  ['forward-loop', 10, 10, 2],
] as const)(
  '%s uses item counts and local renderer indexes at absolute position %i',
  (mode, position, absoluteIndex, index) => {
    render(
      <Example mode={mode} defaultAbsoluteIndex={position} slidesPerView={3} />
    );
    expect(navigation).toMatchObject({
      slideCount: 8,
      slidesPerView: 3,
      absoluteIndex,
      index,
    });
    expect(screen.getByTestId(`item-${index}`)).toHaveAttribute(
      'data-index',
      String(index)
    );
    act(() => navigation.goTo(1));
    expect(navigation.index).toBe(1);
  }
);

test('controlled local positions remain authoritative and acknowledge accepted navigation', () => {
  const change = vi.fn();
  const { rerender } = render(<Example index={2} onIndexChange={change} />);
  act(() => navigation.next());
  expect(change).toHaveBeenLastCalledWith(3, {
    index: 3,
    absoluteIndex: 3,
    reason: 'api',
  });
  expect(navigation.index).toBe(2);
  rerender(<Example index={3} onIndexChange={change} />);
  expect(navigation.index).toBe(3);
  expect(change).toHaveBeenCalledTimes(1);
});

test('shrinking finite items trims the position and reports a slides-change correction', () => {
  const change = vi.fn();
  const { rerender } = render(
    <Example defaultIndex={6} slidesPerView={2} onIndexChange={change} />
  );
  expect(navigation.index).toBe(6);
  rerender(
    <Example
      items={initialItems.slice(0, 4)}
      slidesPerView={2}
      onIndexChange={change}
    />
  );
  expect(navigation).toMatchObject({ index: 2, slideCount: 4, canNext: false });
  expect(change).toHaveBeenLastCalledWith(2, {
    index: 2,
    absoluteIndex: 2,
    reason: 'slides-change',
  });
});

test('shrinking repeating items retains the repetition cycle', () => {
  const change = vi.fn();
  const { rerender } = render(
    <Example
      mode="loop"
      defaultAbsoluteIndex={18}
      onAbsoluteIndexChange={change}
    />
  );
  rerender(
    <Example
      mode="loop"
      items={initialItems.slice(0, 2)}
      onAbsoluteIndexChange={change}
    />
  );
  expect(navigation).toMatchObject({
    index: 1,
    absoluteIndex: 5,
    slideCount: 2,
  });
  expect(change).toHaveBeenLastCalledWith(5, {
    index: 1,
    absoluteIndex: 5,
    reason: 'slides-change',
  });
});

test('empty items invoke neither callback and support later population', () => {
  const create = vi.fn(renderItem);
  const key = vi.fn(itemKey);
  const { rerender } = render(
    <Example items={[]} renderItem={create} getItemKey={key} />
  );
  expect(navigation).toMatchObject({
    slideCount: 0,
    canNext: false,
    canPrev: false,
  });
  act(() => navigation.next());
  expect(create).not.toHaveBeenCalled();
  expect(key).not.toHaveBeenCalled();
  rerender(
    <Example items={initialItems} renderItem={create} getItemKey={key} />
  );
  expect(navigation.slideCount).toBe(8);
  expect(screen.getByTestId('item-0')).toBeVisible();
});

test('null render results still count as slides', () => {
  render(<Example items={initialItems.slice(0, 3)} renderItem={() => null} />);
  act(() => navigation.goTo(2));
  expect(navigation).toMatchObject({ index: 2, slideCount: 3, canNext: false });
  expect(screen.getByTestId('carousel').children).toHaveLength(3);
});

test('primitive and undefined entries reach the renderer without filtering', () => {
  const create = vi.fn((item: number | undefined, index: number) => (
    <span>{`${index}:${item}`}</span>
  ));
  render(
    <RCarousel
      items={[undefined, 0]}
      getItemKey={(_, index) => index}
      renderItem={create}
      animation={false}
    />
  );
  expect(screen.getByText('0:undefined')).toBeInTheDocument();
  expect(screen.getByText('1:0')).toBeInTheDocument();
  expect(create).toHaveBeenCalledWith(undefined, 0);
  expect(create).toHaveBeenCalledWith(0, 1);
});

function StatefulItem({ item }: { item: Item }) {
  const [value, setValue] = useState(item.label);
  return (
    <label>
      {item.label}
      <input
        data-testid={`input-${item.id}`}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
    </label>
  );
}
const renderStatefulItem = (item: Item) => <StatefulItem item={item} />;

test('stable keys preserve retained state and changed keys reset recycled content', () => {
  const { rerender } = render(<Example renderItem={renderStatefulItem} />);
  const input = screen.getByTestId('input-0');
  fireEvent.change(input, { target: { value: 'Edited' } });
  const updated = [
    { id: '0', label: 'Updated label' },
    ...initialItems.slice(1),
  ];
  rerender(
    <Example
      items={updated}
      renderItem={(item) => <StatefulItem item={item} />}
    />
  );
  expect(screen.getByTestId('input-0')).toBe(input);
  expect(input).toHaveValue('Edited');
  expect(screen.getByText('Updated label')).toBeInTheDocument();

  rerender(
    <Example
      items={[
        { id: 'replacement', label: 'Replacement' },
        ...initialItems.slice(1),
      ]}
      renderItem={renderStatefulItem}
    />
  );
  expect(screen.queryByTestId('input-0')).not.toBeInTheDocument();
  expect(screen.getByTestId('input-replacement')).toHaveValue('Replacement');
});

test('updated renderer and key callbacks take effect without changing the items reference', () => {
  const { rerender } = render(<Example renderItem={renderStatefulItem} />);
  fireEvent.change(screen.getByTestId('input-0'), {
    target: { value: 'Edited' },
  });
  const key = vi.fn((item: Item) => `new-${item.id}`);
  rerender(<Example getItemKey={key} renderItem={renderStatefulItem} />);
  expect(screen.getByTestId('input-0')).toHaveValue('Item 0');
  rerender(
    <Example
      getItemKey={key}
      renderItem={(item, index) => (
        <section data-index={index}>
          <StatefulItem item={item} />
        </section>
      )}
    />
  );
  expect(screen.getByTestId('input-0')).toHaveValue('Item 0');
  expect(screen.getByTestId('input-0').closest('section')).toHaveAttribute(
    'data-index',
    '0'
  );
  expect(key).toHaveBeenCalledWith(initialItems[0], 0);
});

test('a suspended data update cannot replace the committed source during navigation', () => {
  const suspended = new Promise<never>(() => {});
  const replacement = initialItems.map((item) => ({
    ...item,
    id: `new-${item.id}`,
    label: `New ${item.label}`,
  }));
  let setPending: React.Dispatch<React.SetStateAction<boolean>> = () => {};
  function Pending({ pending }: { pending: boolean }) {
    if (pending) throw suspended;
    return null;
  }
  function App() {
    const [pending, set] = useState(false);
    setPending = set;
    return (
      <Suspense fallback={<div>Loading</div>}>
        <Example items={pending ? replacement : initialItems} />
        <Pending pending={pending} />
      </Suspense>
    );
  }
  render(<App />);
  act(() => startTransition(() => setPending(true)));
  expect(screen.getByTestId('item-0')).toBeVisible();
  expect(screen.queryByTestId('item-new-0')).not.toBeInTheDocument();
  act(() => navigation.next());
  expect(navigation.index).toBe(1);
  expect(screen.getByTestId('item-1')).toBeVisible();
  expect(screen.queryByTestId('item-new-1')).not.toBeInTheDocument();
});

test('reordering items keeps the selected index and replaces its keyed content', () => {
  const { rerender } = render(
    <Example defaultIndex={1} renderItem={renderStatefulItem} />
  );
  fireEvent.change(screen.getByTestId('input-1'), {
    target: { value: 'Edited item 1' },
  });
  rerender(
    <Example
      items={[initialItems[1], initialItems[0], ...initialItems.slice(2)]}
      renderItem={renderStatefulItem}
    />
  );
  expect(navigation.index).toBe(1);
  const active = screen
    .getByTestId('carousel')
    .querySelector(':scope > div:not([inert]) input');
  expect(active).toHaveAttribute('data-testid', 'input-0');
  expect(active).toHaveValue('Item 0');
});

test('repeated occurrences have independent component state', () => {
  render(
    <Example
      items={initialItems.slice(0, 1)}
      mode="loop"
      renderItem={renderStatefulItem}
    />
  );
  const inputs = screen.getAllByTestId('input-0');
  expect(inputs).toHaveLength(3);
  const active = screen
    .getByTestId('carousel')
    .querySelector(':scope > div:not([inert]) input')!;
  fireEvent.change(active, { target: { value: 'Only this occurrence' } });
  expect(active).toHaveValue('Only this occurrence');
  for (const input of inputs.filter((input) => input !== active))
    expect(input).toHaveValue('Item 0');
});

test('items mode forwards its root ref without leaking data props to the DOM', () => {
  const ref = createRef<HTMLDivElement>();
  render(
    <RCarousel
      ref={ref}
      items={initialItems}
      renderItem={renderItem}
      getItemKey={itemKey}
      data-testid="carousel"
    />
  );
  expect(ref.current).toBe(screen.getByTestId('carousel'));
  for (const name of ['items', 'renderItem', 'getItemKey'])
    expect(ref.current).not.toHaveAttribute(name);
});

test('settling an animated large jump preserves incoming item state', async () => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  const clock = mockMotionClock();
  let now: number;
  const props = {
    mode: 'loop' as const,
    items: initialItems,
    renderItem: renderStatefulItem,
    animation: { type: 'duration' as const, duration: 100 },
  };
  const { rerender } = render(<Example {...props} absoluteIndex={0} />);
  rerender(<Example {...props} absoluteIndex={1_000_001} />);
  for (now = 16; now <= 96; now += 16) clock.advanceTo(now);
  const incoming = screen.getByTestId('input-1');
  const carrier = incoming.closest('[data-carousel-slide]')!;
  fireEvent.change(incoming, { target: { value: 'Preserved' } });
  clock.advanceTo(now);
  await waitFor(() => expect(carrier).not.toHaveAttribute('inert'));
  expect(screen.getByTestId('input-1')).toBe(incoming);
  expect(incoming).toHaveValue('Preserved');
  expect(screen.getByTestId('carousel').children).toHaveLength(3);
});

test.each([
  [{ items: initialItems }, 'items requires renderItem'],
  [{ items: initialItems, renderItem }, 'items requires getItemKey'],
  [{ items: initialItems, getItemKey: itemKey }, 'items requires renderItem'],
  [{ renderItem }, 'renderItem and getItemKey require items'],
  [{ getItemKey: itemKey }, 'renderItem and getItemKey require items'],
  [{ items: null, renderItem, getItemKey: itemKey }, 'items must be an array'],
  [
    { items: initialItems, renderItem, getItemKey: itemKey, children: <div /> },
    'items and children are mutually exclusive',
  ],
] as const)('rejects invalid items configuration %j', (props, message) => {
  const UntypedCarousel = RCarousel as React.ComponentType<
    Record<string, unknown>
  >;
  expect(() => render(<UntypedCarousel {...props} />)).toThrow(message);
});
