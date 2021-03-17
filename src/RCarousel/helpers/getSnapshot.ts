import { ActorsCountConfig } from './types';

export function getSnapshot(
  cursor: number,
  delta: number,
  { total, visible, invisible }: ActorsCountConfig
) {
  const snapshot = [];
  const deltaSign = Math.sign(delta);
  const offset = deltaSign > 0 ? total - invisible : -invisible - 1;
  const startPoint = deltaSign > 0 ? 0 : total - 1;

  for (let i = 0; i < total; i++) {
    snapshot.push(
      cursor - invisible + i - Math.ceil((visible - invisible) / 2)
    );
  }

  for (let i = 0; i < Math.abs(delta); i++) {
    snapshot[startPoint + i * deltaSign] =
      cursor + offset + i * deltaSign - Math.ceil((visible - invisible) / 2);
  }

  return snapshot;
}
