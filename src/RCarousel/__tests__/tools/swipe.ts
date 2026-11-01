import { fireEvent } from '@testing-library/react';

export function swipe(
  element: Element,
  [fromX = 0, fromY = 0]: number[],
  [toX = 0, toY = 0]: number[]
) {
  const pointer = {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 1,
  };

  fireEvent.pointerDown(element, {
    ...pointer,
    clientX: fromX,
    clientY: fromY,
  });
  fireEvent.pointerMove(element, {
    ...pointer,
    clientX: toX,
    clientY: toY,
  });
  fireEvent.pointerUp(element, {
    ...pointer,
    buttons: 0,
    clientX: toX,
    clientY: toY,
  });
}
