import { expect, test } from 'vitest';
import { interpolateSize } from './interpolateSize.js';

const height = (position: number) =>
  position === 0 ? 120 : position === 1 ? 320 : 200;

test('interpolates adjacent windows in both directions without reserving the tallest height', () => {
  expect(interpolateSize(0, 0, 2, height)).toBe(120);
  expect(interpolateSize(0.25, 0, 2, height)).toBe(170);
  expect(interpolateSize(0.75, 0, 2, height)).toBe(270);
  expect(interpolateSize(1, 0, 2, height)).toBe(320);
  expect(interpolateSize(1.5, 0, 2, height)).toBe(260);
  expect(interpolateSize(0.5, 0, 2, height)).toBe(220);
});

test('keeps resisted endpoints stable and fits a fractional final viewport', () => {
  expect(interpolateSize(-0.3, 0, 1.5, height)).toBe(120);
  expect(interpolateSize(1.25, 0, 1.5, height)).toBe(260);
  expect(interpolateSize(1.5, 0, 1.5, height)).toBe(200);
  expect(interpolateSize(1.8, 0, 1.5, height)).toBe(200);
});

test('supports negative loop positions and empty slides', () => {
  expect(interpolateSize(-0.5, -Infinity, Infinity, height)).toBe(160);
  expect(
    interpolateSize(0.5, 0, 2, (position) => (position === 0 ? 120 : 0))
  ).toBe(60);
  expect(
    interpolateSize(0.5, 0, 2, (position) => (position === 0 ? 0 : 320))
  ).toBe(160);
});

test('preserves a committed height when neighboring windows change, in either direction', () => {
  const anchor = { position: 0.25, size: 170 };
  const short = () => 120;
  expect(interpolateSize(0.25, 0, 2, short, anchor)).toBe(170);
  expect(interpolateSize(0.5, 0, 2, short, anchor)).toBeCloseTo(153.3333);
  expect(interpolateSize(0.125, 0, 2, short, anchor)).toBe(145);
  expect(interpolateSize(0, 0, 2, short, anchor)).toBe(120);
  expect(interpolateSize(1, 0, 2, short, anchor)).toBe(120);
  expect(interpolateSize(1.5, 0, 2, short, anchor)).toBe(120);
  expect(interpolateSize(0.375, 0, 0.5, short, anchor)).toBe(145);
  expect(interpolateSize(0.5, 0, 0.5, short, anchor)).toBe(120);
});
