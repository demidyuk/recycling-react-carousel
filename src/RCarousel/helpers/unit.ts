import { Unit, UnitValue } from './types';

const supportedUnits = [Unit.PX, Unit.PCT];

export const parsePx = (value: UnitValue, totalPx: number = 0) => {
  if (typeof value === 'number') return value;
  const valueStr = value + '';
  const [unit] = supportedUnits.filter((unit) => valueStr.includes(unit));
  switch (unit) {
    case Unit.PX:
      return Number(valueStr.replace('px', ''));
    case Unit.PCT:
      return totalPx * (Number(valueStr.replace('%', '')) / 100);
    default:
      return Number(valueStr);
  }
};
