export function animTo({
  curRoles,
  nextRoles,
  totalItemsCount,
  delta,
  relocated,
}: any) {
  return (index: number) => {
    const visibleActors = totalItemsCount / 3;
    const d = nextRoles.indexOf(index) - visibleActors;
    const immediate =
      delta >= 1
        ? curRoles.slice(0, visibleActors).includes(index)
        : curRoles
            .slice(totalItemsCount - visibleActors, totalItemsCount)
            .includes(index);
    return {
      d,
      immediate: relocated || immediate,
    };
  };
}
