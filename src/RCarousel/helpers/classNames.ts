export function classNames(classNames: any[] = []) {
  classNames = Array.from(new Set(classNames).values());
  return classNames
    .reduce<string[]>((acc, cn) => {
      if (cn && (cn = cn.toString().trim())) {
        acc.push(cn);
      }
      return acc;
    }, [])
    .join(' ');
}
