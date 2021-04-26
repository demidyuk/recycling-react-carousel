import clamp from 'lodash/clamp';

export const clampCursor = (cursor: number, from = 0, to = 0) => {
  return clamp(cursor, from, to < 0 ? 0 : to);
};
