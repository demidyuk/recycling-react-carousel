import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useCarouselDrag } from './useCarouselDrag.js';
import type { CarouselDrag } from './useCarouselDrag.js';

const pointer = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  buttons: 1,
  button: 0,
};
function Harness({
  onDrag,
  onClick,
  enabled = true,
}: {
  onDrag: (drag: CarouselDrag) => void;
  onClick?: () => void;
  enabled?: boolean;
}) {
  const { bind } = useCarouselDrag({ enabled, vertical: false, onDrag });
  return (
    <div data-testid="drag" {...bind}>
      <button onClick={onClick}>Slide</button>
    </div>
  );
}
const start = () => {
  const root = screen.getByTestId('drag');
  fireEvent.pointerDown(root, { ...pointer, clientX: 100, clientY: 50 });
  return root;
};

test.each(['no-drag', 'input'])(
  'a new click on %s content is not filtered by the previous drag',
  (kind) => {
    const onDrag = vi.fn();
    const onClick = vi.fn();
    function Example() {
      const { bind } = useCarouselDrag({
        enabled: true,
        vertical: false,
        onDrag,
      });
      return (
        <div data-testid="drag" onClick={onClick} {...bind}>
          {kind === 'input' ? (
            <input data-testid="excluded" />
          ) : (
            <button data-testid="excluded" data-carousel-no-drag="">
              Action
            </button>
          )}
        </div>
      );
    }
    render(<Example />);
    const root = start();
    fireEvent.pointerMove(document, { ...pointer, clientX: 20, clientY: 50 });
    fireEvent.pointerUp(document, {
      ...pointer,
      buttons: 0,
      clientX: 20,
      clientY: 50,
    });
    fireEvent.click(root, { detail: 1 });
    expect(onClick).not.toHaveBeenCalled();

    const control = screen.getByTestId('excluded');
    fireEvent.pointerDown(control, { ...pointer, clientX: 20, clientY: 50 });
    fireEvent.pointerUp(control, {
      ...pointer,
      buttons: 0,
      clientX: 20,
      clientY: 50,
    });
    fireEvent.click(control, { detail: 1 });
    expect(onClick).toHaveBeenCalledOnce();
    expect(onDrag).toHaveBeenCalledTimes(2);
  }
);

test('a tiny movement while lifting after a pause does not become a reverse swipe', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const onDrag = vi.fn();
  render(<Harness onDrag={onDrag} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 20, clientY: 50 });
  now = 2000;
  fireEvent.pointerMove(document, { ...pointer, clientX: 21, clientY: 50 });
  fireEvent.pointerUp(document, {
    ...pointer,
    buttons: 0,
    clientX: 21,
    clientY: 50,
  });
  expect(onDrag).toHaveBeenLastCalledWith({
    down: false,
    movement: -79,
    direction: 0,
    velocity: 0,
  });
});

test('uses release coordinates when the final movement was not delivered as pointermove', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const onDrag = vi.fn();
  render(<Harness onDrag={onDrag} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 60, clientY: 50 });
  now = 200;
  fireEvent.pointerUp(document, {
    ...pointer,
    buttons: 0,
    clientX: 10,
    clientY: 50,
  });
  expect(onDrag).toHaveBeenLastCalledWith({
    down: false,
    movement: -90,
    direction: -1,
    velocity: 0,
  });
});

test.each([0, 100, 101, 2000])(
  'release direction expires after a stopped drag (%ims pause)',
  (pause) => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const onDrag = vi.fn();
    render(<Harness onDrag={onDrag} />);
    start();
    fireEvent.pointerMove(document, { ...pointer, clientX: 20, clientY: 50 });
    now = 20;
    fireEvent.pointerMove(document, { ...pointer, clientX: 28, clientY: 50 });
    now += pause;
    // Devices can keep emitting stationary events while the finger is held.
    fireEvent.pointerMove(document, { ...pointer, clientX: 28, clientY: 50 });
    fireEvent.pointerUp(document, {
      ...pointer,
      buttons: 0,
      clientX: 28,
      clientY: 50,
    });
    expect(onDrag).toHaveBeenLastCalledWith({
      down: false,
      movement: -72,
      direction: pause > 100 ? 0 : 1,
      velocity: pause === 0 ? 0.4 : 0,
    });
  }
);

test('small pointer events still accumulate into an intentional reversal after a pause', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const onDrag = vi.fn();
  render(<Harness onDrag={onDrag} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 20, clientY: 50 });
  now = 2000;
  for (const clientX of [21, 22, 23]) {
    fireEvent.pointerMove(document, { ...pointer, clientX, clientY: 50 });
    now += 10;
  }
  fireEvent.pointerUp(document, {
    ...pointer,
    buttons: 0,
    clientX: 23,
    clientY: 50,
  });
  expect(onDrag).toHaveBeenLastCalledWith({
    down: false,
    movement: -77,
    direction: 1,
    velocity: 0.1,
  });
});

test('taps and keyboard clicks activate content; swipes outside the element filter their click', () => {
  const onDrag = vi.fn();
  const onClick = vi.fn();
  render(<Harness onDrag={onDrag} onClick={onClick} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 99, clientY: 50 });
  fireEvent.pointerUp(document, {
    ...pointer,
    buttons: 0,
    clientX: 99,
    clientY: 50,
  });
  fireEvent.click(screen.getByRole('button'), { detail: 1 });
  expect(onClick).toHaveBeenCalledOnce();
  expect(onDrag).not.toHaveBeenCalled();
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: -100, clientY: 50 });
  fireEvent.pointerUp(document, {
    ...pointer,
    buttons: 0,
    clientX: -100,
    clientY: 50,
  });
  expect(onDrag).toHaveBeenLastCalledWith(
    expect.objectContaining({
      down: false,
      movement: -200,
      direction: -1,
      velocity: expect.any(Number),
    })
  );
  fireEvent.click(screen.getByRole('button'), { detail: 1 });
  expect(onClick).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button'), { detail: 0 });
  expect(onClick).toHaveBeenCalledTimes(2);
});

test('cross-axis movement leaves native page scrolling alone', () => {
  const onDrag = vi.fn();
  render(<Harness onDrag={onDrag} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 99, clientY: 100 });
  fireEvent.pointerMove(document, { ...pointer, clientX: -100, clientY: 100 });
  fireEvent.pointerUp(document, {
    ...pointer,
    buttons: 0,
    clientX: -100,
    clientY: 100,
  });
  expect(onDrag).not.toHaveBeenCalled();
});

test('implicit capture transfer from a child preserves the active touch gesture', () => {
  const onDrag = vi.fn();
  render(<Harness onDrag={onDrag} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 50, clientY: 50 });
  fireEvent(
    screen.getByRole('button'),
    new PointerEvent('lostpointercapture', { ...pointer, bubbles: true })
  );
  fireEvent.pointerMove(document, { ...pointer, clientX: 0, clientY: 50 });
  expect(onDrag).toHaveBeenLastCalledWith({
    down: true,
    movement: -100,
    direction: -1,
  });
});

test('fresh clicks work after gestures are disabled during a swipe', () => {
  const onDrag = vi.fn();
  const onClick = vi.fn();
  const { rerender } = render(<Harness onDrag={onDrag} onClick={onClick} />);
  start();
  fireEvent.pointerMove(document, { ...pointer, clientX: 50, clientY: 50 });
  rerender(<Harness onDrag={onDrag} onClick={onClick} enabled={false} />);
  fireEvent.pointerDown(screen.getByRole('button'), { ...pointer });
  fireEvent.click(screen.getByRole('button'), { detail: 1 });
  expect(onClick).toHaveBeenCalledOnce();
});

test.each(['pointercancel', 'lostpointercapture', 'blur'])(
  '%s cancels once and removes document listeners',
  (event) => {
    const onDrag = vi.fn();
    const { unmount } = render(<Harness onDrag={onDrag} />);
    const root = start();
    fireEvent.pointerMove(document, { ...pointer, clientX: 50, clientY: 50 });
    if (event === 'blur') fireEvent.blur(window);
    else
      fireEvent(root, new PointerEvent(event, { ...pointer, bubbles: true }));
    expect(onDrag).toHaveBeenLastCalledWith({
      down: false,
      movement: -50,
      direction: -1,
      canceled: true,
    });
    expect(onDrag).toHaveBeenCalledTimes(2);
    unmount();
    fireEvent.pointerMove(document, { ...pointer, clientX: 0, clientY: 50 });
    expect(onDrag).toHaveBeenCalledTimes(2);
  }
);
