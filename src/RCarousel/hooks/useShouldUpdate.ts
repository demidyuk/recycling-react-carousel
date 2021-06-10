import { usePrevious } from './usePrevious';
import isEqual from 'lodash/isEqual';

export function useShouldUpdate(...curDeps: any[]) {
  const prevDeps = usePrevious(curDeps);
  return !isEqual(curDeps, prevDeps);
}
