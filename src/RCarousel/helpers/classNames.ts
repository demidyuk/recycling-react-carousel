export function classNames(values: Array<string | false | null | undefined>) {
  return [...new Set(values)]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
}
