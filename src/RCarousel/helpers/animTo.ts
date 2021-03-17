import { ActorsCountConfig } from './types';

interface AnimToProps {
  delta: number;
  curRoles: number[];
  nextRoles: number[];
  actorsCountConfig: ActorsCountConfig;
  relocated: boolean;
}

export function animTo({
  curRoles,
  nextRoles,
  actorsCountConfig: { total, visible, invisible },
  delta,
  relocated,
}: AnimToProps) {
  return (index: number) => {
    const d =
      nextRoles.indexOf(index) -
      visible +
      Math.floor((visible - invisible) / 2);

    const immediate =
      delta >= 1
        ? curRoles.slice(0, invisible).includes(index)
        : curRoles.slice(total - invisible, total).includes(index);
    return {
      d,
      immediate: relocated || immediate,
    };
  };
}
