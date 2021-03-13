export function classNames(classNames: any[]) {
  return classNames
    .reduce<string[]>((acc, cn) => {
      if (cn && (cn = cn.toString().trim())) {
        acc.push(cn);
      }
      return acc;
    }, [])
    .join(' ');
}
