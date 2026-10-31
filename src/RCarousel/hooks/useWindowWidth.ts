import { useSyncExternalStore } from 'react';

const getServerSnapshot = () => 0;
const getSnapshot = () => window.innerWidth;

const subscribe = (onStoreChange: () => void) => {
  let timeout: number | undefined;
  const resizeListener = () => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      timeout = undefined;
      onStoreChange();
    }, 60);
  };
  window.addEventListener('resize', resizeListener);

  return () => {
    window.clearTimeout(timeout);
    window.removeEventListener('resize', resizeListener);
  };
};

export function useWindowWidth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
