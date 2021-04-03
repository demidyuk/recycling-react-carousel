const { animTo: originalAnimTo } = jest.requireActual('../animTo');

export function animTo(options: any) {
  const originalTo = originalAnimTo(options);
  return (index: number) => {
    return { ...originalTo(index), immediate: true };
  };
}
