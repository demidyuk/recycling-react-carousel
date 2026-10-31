import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { motionEnvironment } from '../src/RCarousel/motion/ScalarMotion.js';

/** Advance only scheduled motion frames, respecting cancellation and retargeting. */
export function mockMotionClock() {
  let now = 0;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(motionEnvironment, 'now').mockImplementation(() => now);
  vi.spyOn(motionEnvironment, 'requestFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(motionEnvironment, 'cancelFrame').mockImplementation((frame) => {
    frames.delete(frame);
  });

  return {
    advanceTo(time: number) {
      if (time < now) throw new Error('The motion clock cannot run backwards');
      now = time;
      const pending = [...frames.values()];
      frames.clear();
      act(() => pending.forEach((callback) => callback(now)));
    },
  };
}
