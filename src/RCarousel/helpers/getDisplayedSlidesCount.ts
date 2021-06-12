import { DisplayRule } from './types';

export const getDisplayedSlidesCount = (
  displayAtOnce: number | undefined | DisplayRule[],
  windowWidth: number
): DisplayRule | undefined => {
  const targetRule = { value: 1 };
  if (Array.isArray(displayAtOnce)) {
    const displayRule = displayAtOnce.reduce<DisplayRule>(
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
    return displayRule;
  }
  if (displayAtOnce !== undefined) return { value: displayAtOnce };
};
