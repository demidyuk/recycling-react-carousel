import { beforeEach, expect, test, vi } from 'vitest';
import reference from '../../../test-config/fixtures/motion-reference.json';
import { ScalarMotion, motionEnvironment } from './ScalarMotion.js';
import type { MotionConfig } from './ScalarMotion.js';

beforeEach(() => {
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(false);
  vi.spyOn(motionEnvironment, 'requestFrame').mockReturnValue(1);
  vi.spyOn(motionEnvironment, 'cancelFrame').mockImplementation(() => {});
});

// Keep the archived reference data intact; frequency and decay were internal
// compatibility modes that the public animation configuration cannot select.
test.each(
  reference.cases.filter(({ name }) => name !== 'frequency' && name !== 'decay')
)('preserves the previous $name trajectory', ({ name, config, samples }) => {
  const motion = new ScalarMotion(0);
  const settings =
    name === 'ease-out'
      ? { ...config, easing: (t: number) => 1 - (1 - t) ** 3 }
      : (config as MotionConfig);
  const callbacks = { onChange: vi.fn(), onRest: vi.fn() };
  motion.start(1, settings, callbacks);
  for (let frame = 1; frame <= 64; frame += 1) {
    if (name === 'reverse' && frame === 17)
      motion.start(-1, settings, callbacks);
    motion.advance(16);
    const sample = samples.find((sample) => sample.frame === frame);
    if (sample) expect(motion.get()).toBeCloseTo(sample.value, 10);
  }
  motion.stop();
});

test('retargeting preserves the current position and velocity and cancels stale completion', () => {
  const motion = new ScalarMotion(0);
  const oldRest = vi.fn();
  const newRest = vi.fn();
  motion.start(1, {}, { onChange: vi.fn(), onRest: oldRest });
  motion.advance(160);
  const position = motion.get();
  const velocity = motion.velocity;
  motion.start(-1, {}, { onChange: vi.fn(), onRest: newRest });
  expect(motion.get()).toBe(position);
  expect(motion.velocity).toBe(velocity);
  for (let i = 0; i < 200; i += 1) motion.advance(16);
  expect(motion.get()).toBe(-1);
  expect(oldRest).not.toHaveBeenCalled();
  expect(newRest).toHaveBeenCalledOnce();
});

test.each([false, true])(
  'pointer updates between frames preserve animation time (reverse: %s)',
  (reverse) => {
    let now = 0;
    let frame: FrameRequestCallback = () => {};
    vi.spyOn(motionEnvironment, 'now').mockImplementation(() => now);
    vi.spyOn(motionEnvironment, 'requestFrame').mockImplementation(
      (callback) => {
        frame = callback;
        return 1;
      }
    );
    const callbacks = { onChange: vi.fn(), onRest: vi.fn() };
    const reference = new ScalarMotion(0);
    const motion = new ScalarMotion(0);
    reference.start(1, {}, callbacks);
    motion.start(1, {}, callbacks);
    for (let index = 1; index <= 10; index += 1) {
      const target = reverse && index > 5 ? -1 : 1;
      reference.start(target, {}, callbacks);
      reference.advance(16);
      // Pointer input commonly arrives just before the display's next frame.
      now = index * 16 - 1;
      motion.start(target, {}, callbacks);
      now = index * 16;
      frame(now);
      expect(motion.get()).toBeCloseTo(reference.get(), 10);
    }
    motion.stop();
    reference.stop();
  }
);

test('a zero-time frame does not advance or prematurely finish duration motion', () => {
  const motion = new ScalarMotion(0);
  const onRest = vi.fn();
  motion.start(1, { duration: 120 }, { onChange: vi.fn(), onRest });
  motion.advance(0);
  expect(motion.get()).toBe(0);
  expect(onRest).not.toHaveBeenCalled();
  motion.advance(16);
  expect(motion.get()).toBeGreaterThan(0);
  expect(onRest).not.toHaveBeenCalled();
});

test('constructor callbacks retain their binding when passed independently', () => {
  const motion = new ScalarMotion(0);
  const { get, set, start, stop, subscribe } = motion;
  const changed = vi.fn();
  const unsubscribe = subscribe(changed);
  set(0.25);
  expect(get()).toBe(0.25);
  start(1, { duration: 100 }, { onChange: vi.fn(), onRest: vi.fn() });
  motion.advance(50);
  expect(get()).toBe(0.625);
  expect(changed).toHaveBeenCalledTimes(2);
  unsubscribe();
  stop();
  motion.advance(100);
  expect(get()).toBe(0.625);
  set(0);
  expect(changed).toHaveBeenCalledTimes(2);
});

test('switching between spring and duration motion restores defaults and preserves live velocity', () => {
  const motion = new ScalarMotion(0);
  const callbacks = { onChange: vi.fn(), onRest: vi.fn() };
  motion.start(1, { tension: 60, friction: 12, mass: 1 }, callbacks);
  motion.advance(160);
  const springPosition = motion.get();
  const springVelocity = motion.velocity;
  motion.start(
    3,
    { duration: 100, easing: (t) => 1 - (1 - t) ** 3 },
    callbacks
  );
  expect(motion.get()).toBe(springPosition);
  expect(motion.velocity).toBe(springVelocity);
  motion.advance(25);
  expect(motion.get()).toBeCloseTo(
    springPosition + (3 - springPosition) * 0.578125,
    12
  );
  const durationPosition = motion.get();
  const durationVelocity = motion.velocity;
  motion.start(-1, { tension: 170, friction: 26, mass: 1 }, callbacks);
  expect(motion.config.duration).toBeUndefined();
  expect(motion.config.easing(0.25)).toBe(0.25);
  expect(motion.get()).toBe(durationPosition);
  expect(motion.velocity).toBe(durationVelocity);
  for (let frame = 0; frame < 200; frame++) motion.advance(16);
  expect(motion.get()).toBe(-1);
  expect(callbacks.onRest).toHaveBeenCalledOnce();
});

test('a delayed RAF timestamp does not charge an old browser stall to a new target', () => {
  let now = 0;
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(motionEnvironment, 'now').mockImplementation(() => now);
  vi.spyOn(motionEnvironment, 'requestFrame').mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  const motion = new ScalarMotion(0);
  const callbacks = { onChange: vi.fn(), onRest: vi.fn() };
  motion.start(1, { duration: 120 }, callbacks);
  // The browser had queued this frame before another task stalled its thread.
  now = 116;
  frame(16);
  const position = motion.get();
  expect(position).toBeCloseTo(64 / 120);
  now = 118;
  motion.start(2, { duration: 120 }, callbacks);
  now = 124;
  frame(124);
  expect(motion.get()).toBeCloseTo(position + ((2 - position) * 8) / 120);
  motion.stop();
});

test('stopping and reduced motion leave no scheduled work or stale callbacks', () => {
  const motion = new ScalarMotion(0);
  const onRest = vi.fn();
  motion.start(1, {}, { onChange: vi.fn(), onRest });
  motion.stop();
  motion.advance(1000);
  expect(motion.get()).toBe(0);
  expect(onRest).not.toHaveBeenCalled();
  vi.spyOn(motionEnvironment, 'reducedMotion').mockReturnValue(true);
  motion.start(2, {}, { onChange: vi.fn(), onRest });
  expect(motion.get()).toBe(2);
  expect(onRest).toHaveBeenCalledOnce();
  expect(motionEnvironment.requestFrame).toHaveBeenCalledOnce();
});

test('a new target started by a completion frame survives that frame', () => {
  const motion = new ScalarMotion(0);
  const oldRest = vi.fn();
  const newRest = vi.fn();
  motion.start(
    1,
    { duration: 16 },
    {
      onChange: () => {
        if (motion.get() === 1)
          motion.start(
            2,
            { duration: 16 },
            { onChange: vi.fn(), onRest: newRest }
          );
      },
      onRest: oldRest,
    }
  );
  motion.advance(16);
  motion.advance(16);
  expect(motion.get()).toBe(2);
  expect(oldRest).not.toHaveBeenCalled();
  expect(newRest).toHaveBeenCalledOnce();
});
