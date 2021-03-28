import { usePrevious } from './usePrevious';

export function useNeedUpdate(...deps: any[]) {
  const curToken = JSON.stringify(deps);
  const prevToken = usePrevious(curToken);
  return curToken !== prevToken;
}
