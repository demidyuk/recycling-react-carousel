import { fireEvent } from '@testing-library/react';

let _curEventTimeStamp = 1;

function inc() {
  return _curEventTimeStamp++;
}

export function swipe(element: Element, ...points: number[][]) {
  fireEvent.pointerDown(element, { _curEventTimeStamp: inc() });
  points.forEach(([clientX = 0, clientY = 0]) => {
    fireEvent.pointerMove(element, {
      clientX,
      clientY,
      _curEventTimeStamp: inc(),
    });
  });
  fireEvent.pointerUp(element, { _curEventTimeStamp: inc() });
}
