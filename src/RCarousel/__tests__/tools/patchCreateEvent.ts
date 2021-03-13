import { createEvent } from '@testing-library/react';

Object.keys(createEvent)
  .filter((key) => key.includes('pointer'))
  .forEach((key) => {
    const ce = createEvent as any;
    const fn = ce[key.replace('pointer', 'mouse')];
    if (fn) {
      ce[key] = (type: string, { _curEventTimeStamp, ...rest }: any = {}) => {
        const event = fn(type, rest);
        if (_curEventTimeStamp !== undefined) {
          event.__proto__ = {
            timeStamp: _curEventTimeStamp,
            __proto__: event.__proto__,
          };
        }
        event.pointerId = 1;
        return event;
      };
    }
  });
