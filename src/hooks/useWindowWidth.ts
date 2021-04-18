import { useEffect } from 'react';
import debounce from 'lodash/debounce';
import { useForceUpdate } from './useForceUpdate';

export function useWindowWidth() {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    const resizeListener = debounce(() => forceUpdate(), 60);
    window.addEventListener('resize', resizeListener);

    return () => window.removeEventListener('resize', resizeListener);
  }, [forceUpdate]);

  return window.innerWidth;
}
