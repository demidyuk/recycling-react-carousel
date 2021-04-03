import createMockRaf from '@react-spring/mock-raf';
//@ts-ignore
import { Globals } from 'react-spring';

const mockRaf = createMockRaf();

Globals.injectFrame(mockRaf.raf, mockRaf.cancel);
Globals.injectNow(mockRaf.now);

export const finishAnim = (fn: any) => {
  const result = fn();
  mockRaf.flush();
  return result;
};
