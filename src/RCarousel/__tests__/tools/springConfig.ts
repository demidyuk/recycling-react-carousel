import createMockRaf from '@react-spring/mock-raf';
//@ts-ignore
import { Globals } from 'react-spring';

const mockRaf = createMockRaf();

Globals.injectFrame(mockRaf.raf, mockRaf.cancel);
Globals.injectNow(mockRaf.now);

export function finishAnim<T>(fn: () => T): T {
  const result = fn();
  mockRaf.flush();
  return result;
}
