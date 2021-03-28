export const getLocalIndex = (globalIndex: number, length: number) => {
  return length && ((globalIndex % length) + length) % length;
};
