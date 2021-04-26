import { render as tlRender } from '@testing-library/react';
import { finishAnim } from './springConfig';

export const render = ((...args: any[]) => {
  const renderResult = finishAnim(() =>
    // @ts-ignore
    tlRender(...args)
  );
  const originalRerender = renderResult.rerender;

  renderResult.rerender = (...args: any[]) =>
    // @ts-ignore
    finishAnim(() => originalRerender(...args));
  return renderResult;
}) as typeof tlRender;
