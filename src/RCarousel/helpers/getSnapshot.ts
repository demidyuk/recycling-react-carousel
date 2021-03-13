export function getSnapshot(
  cursor: number,
  delta: number,
  totalItemsCount: number
) {
  const snapshot = [];
  const deltaSign = Math.sign(delta);
  const visibleItemsCount = totalItemsCount / 3;
  const offset =
    deltaSign > 0
      ? totalItemsCount - visibleItemsCount
      : -visibleItemsCount - 1;
  const startPoint = deltaSign > 0 ? 0 : totalItemsCount - 1;

  for (let i = 0; i < totalItemsCount; i++) {
    snapshot.push(cursor - visibleItemsCount + i);
  }

  for (let i = 0; i < Math.abs(delta); i++) {
    snapshot[startPoint + i * deltaSign] = cursor + offset + i * deltaSign;
  }

  return snapshot;
}
