import { DisplayRule } from './types';

export const getDisplayedSlidesCount = (
  displayAtOnce: number | undefined | DisplayRule[],
  windowWidth: number
): number | undefined => {
  const targetRule = { value: 1 };
  if (Array.isArray(displayAtOnce)) {
    const { value } = displayAtOnce.reduce<DisplayRule>(
      (targetRule, curRule) => {
        const breakpoint = curRule.breakpoint ?? -Infinity;

        if (
          windowWidth >= breakpoint &&
          breakpoint >= (targetRule.breakpoint ?? -Infinity)
        ) {
          return curRule;
        }

        return targetRule;
      },
      targetRule
    );
    return value;
  }
  return displayAtOnce;
};
