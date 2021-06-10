export interface DisplayRule {
  breakpoint?: number;
  value: number;
}

export enum ChangeReason {
  USER_SWIPE = 'user_swipe',
  SHIFT = 'shift',
}

export type Actor = {
  globalChildIndex: number;
  anim: {
    d: number;
    immediate: boolean;
  };
};

export type CalcResult = {
  actors: Actor[];
  actorsState: number;
  cursor?: number;
};

export enum Unit {
  PX = 'px',
  PCT = '%',
}

export type UnitValue = number | string;
