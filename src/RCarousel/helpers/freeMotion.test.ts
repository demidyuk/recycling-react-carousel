import { expect, test } from 'vitest';
import { freeMotion } from './freeMotion.js';

const loop = { min: -Infinity, max: Infinity };

test('coasts continuously with symmetric, bounded pixel velocity', () => {
  expect(freeMotion(2.25, -1, 250, loop, true)).toEqual({
    position: 2.75,
    duration: 250,
  });
  expect(freeMotion(2.25, 1, 250, loop, true)).toEqual({
    position: 1.75,
    duration: 250,
  });
  expect(freeMotion(0, -100, 250, loop, true)).toEqual(
    freeMotion(0, -3, 250, loop, true)
  );
  expect(freeMotion(2.25, 0, 250, loop, true)).toEqual({
    position: 2.25,
    duration: 0,
  });
});

test('stops at fractional finite edges and pulls resisted releases back inside', () => {
  const bounds = { min: 0, max: 2.5 };
  expect(freeMotion(2.4, -1, 250, bounds, true).position).toBe(2.5);
  expect(freeMotion(-0.3, 0, 250, bounds, true)).toEqual({
    position: 0,
    duration: 220,
  });
  expect(freeMotion(3, 0, 250, bounds, true)).toEqual({
    position: 2.5,
    duration: 220,
  });
});

test('disabled and reduced motion settle at the release point without inertia', () => {
  expect(freeMotion(2.25, -3, 250, loop, false)).toEqual({
    position: 2.25,
    duration: 0,
  });
  expect(freeMotion(-0.3, -3, 250, { min: 0, max: 2.5 }, false)).toEqual({
    position: 0,
    duration: 0,
  });
});
