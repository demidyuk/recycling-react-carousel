// Numeric compatibility adapted from react-spring (MIT); see THIRD_PARTY_NOTICES.md.
/** Existing declaration shape retained by the type-only resolveAnimation export. */
export interface SpringConfig {
  tension?: number;
  friction?: number;
  mass?: number;
  frequency?: number;
  damping?: number;
  velocity?: number | number[];
  precision?: number;
  restVelocity?: number;
  duration?: number;
  progress?: number;
  easing?: (progress: number) => number;
  clamp?: boolean;
  bounce?: number;
  decay?: boolean | number;
  round?: number;
}

/** Runtime options reachable through the public carousel configuration. */
export type MotionConfig = Pick<
  SpringConfig,
  'tension' | 'friction' | 'mass' | 'duration' | 'easing'
>;

export const defaultSpringConfig = { tension: 170, friction: 26 };

// Read browser APIs when motion starts, so imports and server rendering stay safe.
export const motionEnvironment = {
  now: () => globalThis.performance.now(),
  requestFrame: (callback: FrameRequestCallback) =>
    globalThis.requestAnimationFrame(callback),
  cancelFrame: (frame: number) => globalThis.cancelAnimationFrame(frame),
  reducedMotion: () =>
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false,
};

const defaults = {
  ...defaultSpringConfig,
  mass: 1,
  easing: (progress: number) => progress,
};
type ResolvedConfig = MotionConfig & typeof defaults;

interface MotionCallbacks {
  onChange: () => void;
  onRest: () => void;
}

/** One scalar, one frame callback, and direct DOM subscribers. */
export class ScalarMotion {
  declare goal: number;
  declare config: ResolvedConfig;
  /** Velocity in slide units per millisecond. */
  declare velocity: number;
  declare private value: number;
  declare private position: number;
  declare private from: number;
  declare private elapsed: number;
  declare private lastTime: number;
  declare private frame: number | null;
  declare private running: boolean;
  declare private revision: number;
  declare private listeners: Set<() => void>;
  declare private onChange: (() => void) | undefined;
  declare private onRest: (() => void) | undefined;
  declare get: () => number;
  declare subscribe: (listener: () => void) => () => void;
  declare stop: () => void;
  declare set: (value: number, beforePublish?: () => void) => void;
  declare start: (
    target: number,
    config: MotionConfig,
    callbacks: MotionCallbacks,
    velocity?: number
  ) => void;
  declare private tick: () => void;

  constructor(value: number) {
    this.value = this.position = this.from = this.goal = value;
    // Explicit initialization avoids class-field lowering helpers at ES2018.
    this.config = { ...defaults };
    this.velocity = this.elapsed = this.lastTime = this.revision = 0;
    this.frame = null;
    this.running = false;
    this.listeners = new Set();
    this.onChange = this.onRest = undefined;

    this.get = () => this.value;
    this.subscribe = (listener) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    };
    this.stop = () => {
      this.revision += 1;
      if (this.frame !== null) motionEnvironment.cancelFrame(this.frame);
      this.frame = null;
      this.running = false;
      this.onChange = this.onRest = undefined;
    };
    this.set = (value, beforePublish) => {
      this.stop();
      this.velocity = 0;
      this.goal = this.position = this.value = value;
      beforePublish?.();
      this.publish();
    };
    this.start = (target, config, callbacks, velocity) => {
      const wasRunning = this.running;
      // Retarget the live channel without discarding its pending frame or time.
      // Pointer events can arrive immediately before every animation frame.
      this.revision += 1;
      this.config = {
        ...this.config,
        ...config,
        duration: config.duration,
        easing: config.easing ?? defaults.easing,
      };
      this.goal = target;
      this.from = this.position;
      if (velocity !== undefined) this.velocity = velocity;
      else if (!wasRunning) this.velocity = 0;
      this.elapsed = 0;
      this.onChange = callbacks.onChange;
      this.onRest = callbacks.onRest;
      this.running = true;
      if (
        motionEnvironment.reducedMotion() ||
        (this.config.duration !== undefined && this.config.duration <= 0) ||
        this.config.tension <= 0 ||
        (this.position === target && this.velocity === 0)
      ) {
        this.finish(target);
        return;
      }
      if (!wasRunning) this.lastTime = motionEnvironment.now();
      if (this.frame === null)
        this.frame = motionEnvironment.requestFrame(this.tick);
    };
    this.tick = () => {
      this.frame = null;
      // A delayed RAF can carry a timestamp from before a long browser task.
      // Use callback time so a subsequent retarget cannot inherit that old gap.
      const time = motionEnvironment.now();
      const elapsed = Math.max(0, Math.min(64, time - this.lastTime));
      this.lastTime = time;
      this.advance(elapsed);
      if (this.running && this.frame === null)
        this.frame = motionEnvironment.requestFrame(this.tick);
    };
  }

  private publish() {
    // Recycling commits the content and base coordinate before DOM subscribers
    // use this frame's offset. React only renders when the integer window moves.
    this.onChange?.();
    // Subscribers can change subscriptions while handling a frame. New listeners
    // belong to the next publication, not the Set iterator's current traversal.
    for (const listener of [...this.listeners])
      if (this.listeners.has(listener)) listener();
  }

  private finish(value: number) {
    const revision = this.revision;
    const onRest = this.onRest;
    this.position = this.value = value;
    this.velocity = 0;
    this.publish();
    if (revision !== this.revision) return;
    this.stop();
    onRest?.();
  }

  /** Advance a bounded time interval; also used for deterministic trajectory tests. */
  advance(milliseconds: number) {
    if (!this.running || milliseconds <= 0) return;
    const config = this.config;
    const previous = this.position;
    const precision = Math.max(
      Math.max(Math.abs(this.goal), Math.abs(this.from), 1) * Number.EPSILON,
      Math.min(1, Math.abs(this.goal - this.from) * 0.001) || 0.005
    );
    this.elapsed += milliseconds;
    let finished = false;
    if (config.duration !== undefined) {
      const progress = Math.max(0, Math.min(1, this.elapsed / config.duration));
      this.position =
        this.from + (this.goal - this.from) * config.easing(progress);
      this.velocity = milliseconds
        ? (this.position - previous) / milliseconds
        : 0;
      finished = progress === 1;
    } else {
      const restVelocity = precision / 10;
      // A millisecond step keeps stiff springs stable on slower displays too.
      for (let remaining = milliseconds; remaining > 0;) {
        const step = Math.min(1, remaining);
        const acceleration =
          (((this.goal - this.position) * config.tension) / 1_000_000 -
            (this.velocity * config.friction) / 1000) /
          config.mass;
        this.velocity += acceleration * step;
        this.position += this.velocity * step;
        remaining -= step;
        if (
          Math.abs(this.position - this.goal) <= precision &&
          Math.abs(this.velocity) <= restVelocity
        ) {
          finished = true;
          break;
        }
      }
    }
    if (!Number.isFinite(this.position)) {
      this.finish(this.goal);
    } else if (finished) {
      this.finish(this.goal);
    } else {
      this.value = this.position;
      this.publish();
    }
  }
}
